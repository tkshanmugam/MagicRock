"""
Authentication endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.db.session import get_db
from app.models.user import User
from app.models.user_organization import UserOrganization
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_refresh_token
from app.api.schemas import LoginRequest, Token, RefreshTokenRequest
from app.models.refresh_token import RefreshToken
from datetime import datetime, timedelta
from app.core.config import settings
from app.api.dependencies import get_current_active_user
from app.core.rbac import is_superadmin as is_superadmin_role
from app.services.audit_service import AuditLogService

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
async def login(
    login_data: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user and return JWT token."""
    try:
        # Get client info
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        
        # Find user
        result = await db.execute(
            select(User).where(User.username == login_data.username)
        )
        user = result.scalars().first()
        
        # Verify credentials
        if not user or not verify_password(login_data.password, user.hashed_password):
            await AuditLogService.log_action(
                db=db,
                organisation_id=None,
                user_id=user.id if user else None,
                module_name="Authentication",
                entity_name="user",
                entity_id=user.id if user else None,
                action="LOGIN",
                remarks="FAILURE: Invalid credentials",
                ip_address=client_ip,
                user_agent=user_agent,
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Check if user is active
        if not user.is_active:
            await AuditLogService.log_action(
                db=db,
                organisation_id=None,
                user_id=user.id,
                module_name="Authentication",
                entity_name="user",
                entity_id=user.id,
                action="LOGIN",
                remarks="FAILURE: Account inactive",
                ip_address=client_ip,
                user_agent=user_agent,
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive"
            )
        
        is_superadmin = is_superadmin_role(user.role)

        if not is_superadmin:
            # Ensure user is mapped to at least one active organization
            result = await db.execute(
                select(UserOrganization)
                .where(
                    UserOrganization.user_id == user.id,
                    UserOrganization.status == "active"
                )
                .limit(1)
            )
            user_org = result.scalars().first()
            if not user_org:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User is not assigned to any organization"
                )

        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id), "username": user.username, "role": user.role},
            expires_delta=access_token_expires
        )
        
        # Create refresh token
        refresh_token_data = {"sub": str(user.id), "username": user.username}
        refresh_token_jwt = create_refresh_token(refresh_token_data)
        
        # Store refresh token in database
        try:
            refresh_token_expires = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
            refresh_token_db = RefreshToken(
                user_id=user.id,
                token=refresh_token_jwt,
                expires_at=refresh_token_expires,
                is_revoked=False
            )
            db.add(refresh_token_db)
            await db.commit()
        except Exception as e:
            # Rollback on error
            await db.rollback()
            import logging
            logging.getLogger("error").error(f"Failed to store refresh token: {str(e)}")
            # Still return tokens even if refresh token storage fails
            # (refresh token can be stored in client-side only if needed)
        
        await AuditLogService.log_action(
            db=db,
            organisation_id=None,
            user_id=user.id,
            module_name="Authentication",
            entity_name="user",
            entity_id=user.id,
            action="LOGIN",
            remarks="SUCCESS",
            ip_address=client_ip,
            user_agent=user_agent,
        )
        
        return {
            "access_token": access_token,
            "refresh_token": refresh_token_jwt,
            "token_type": "bearer"
        }
    except HTTPException:
        # Re-raise HTTP exceptions (401, 403, etc.)
        raise
    except Exception as e:
        # Log unexpected errors
        import logging
        logger = logging.getLogger("error")
        logger.error(f"Unexpected error in login endpoint: {str(e)}", exc_info=True)
        # Raise as 500 error (will be caught by exception handler with CORS headers)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during login. Please try again." if not settings.DEBUG else str(e)
        )


@router.post("/refresh", response_model=Token)
async def refresh_token(
    refresh_data: RefreshTokenRequest,
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """Refresh access token using refresh token."""
    # Decode refresh token
    payload = decode_refresh_token(refresh_data.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Convert string user_id to int
    try:
        user_id: int = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token format"
        )
    
    # Check if refresh token exists in database and is not revoked
    result = await db.execute(
        select(RefreshToken).where(
            and_(
                RefreshToken.token == refresh_data.refresh_token,
                RefreshToken.user_id == user_id,
                RefreshToken.is_revoked == False,
                RefreshToken.expires_at > datetime.utcnow()
            )
        )
    )
    refresh_token_db = result.scalar_one_or_none()
    
    if refresh_token_db is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token is invalid or expired"
        )
    
    # Get user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Create new access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "role": user.role},
        expires_delta=access_token_expires
    )
    
    # Optionally rotate refresh token (create new one and revoke old)
    # For now, we'll keep the same refresh token
    new_refresh_token_jwt = create_refresh_token({
        "sub": str(user.id),
        "username": user.username
    })
    
    # Revoke old refresh token
    refresh_token_db.is_revoked = True
    
    # Create new refresh token
    refresh_token_expires = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    new_refresh_token_db = RefreshToken(
        user_id=user.id,
        token=new_refresh_token_jwt,
        expires_at=refresh_token_expires,
        is_revoked=False
    )
    db.add(new_refresh_token_db)
    await db.commit()
    
    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token_jwt,
        "token_type": "bearer"
    }


@router.post("/logout")
async def logout(
    refresh_data: RefreshTokenRequest,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke refresh token (logout)."""
    # Revoke the refresh token
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token == refresh_data.refresh_token,
            RefreshToken.user_id == current_user.id
        )
    )
    refresh_token_db = result.scalar_one_or_none()
    
    if refresh_token_db:
        refresh_token_db.is_revoked = True
        await db.commit()
    
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    organisation_id = request.headers.get("X-Organization-Id")
    await AuditLogService.log_action(
        db=db,
        organisation_id=int(organisation_id) if organisation_id and organisation_id.isdigit() else None,
        user_id=current_user.id,
        module_name="Authentication",
        entity_name="user",
        entity_id=current_user.id,
        action="LOGOUT",
        remarks="SUCCESS",
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user)
):
    """Get current authenticated user information."""
    return {
        "id": current_user.id,
        "username": current_user.username,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "is_active": current_user.is_active,
        "created_at": current_user.created_at,
        "updated_at": current_user.updated_at
    }

