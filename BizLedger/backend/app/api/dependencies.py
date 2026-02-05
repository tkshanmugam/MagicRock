"""
Dependencies for API routes (authentication, authorization, etc.).
"""
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User
from app.core.security import decode_access_token
from app.core.config import settings
from app.core.rbac import is_superadmin

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


async def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """Get current authenticated user from JWT token."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please provide a Bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Verify SECRET_KEY is configured
    if not settings.SECRET_KEY:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error: SECRET_KEY not set",
        )
    
    # Log token info for debugging (only in debug mode)
    if settings.DEBUG:
        import logging
        logger = logging.getLogger(__name__)
        logger.debug(f"Attempting to decode token. Token length: {len(token) if token else 0}, SECRET_KEY length: {len(settings.SECRET_KEY)}")
    
    payload = decode_access_token(token)
    if payload is None:
        # In debug mode, provide more details
        if settings.DEBUG:
            import logging
            from jose import jwt
            logger = logging.getLogger(__name__)
            try:
                # Try to decode without verification to see if token format is valid
                unverified = jwt.decode(token, options={"verify_signature": False})
                logger.error(f"Token format is valid but signature verification failed. Token payload: {unverified}")
            except Exception as e:
                logger.error(f"Token format is invalid: {str(e)}")
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id_str = payload.get("sub")
    if user_id_str is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format. User ID not found.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Convert string user_id to int
    try:
        user_id = int(user_id_str)
    except (ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format. User ID is not a valid integer.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    
    return user


async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Get current active user."""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )
    return current_user


def require_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Require admin access.
    
    Note: Organization-level permissions are enforced with RBAC dependencies.
    """
    # All authenticated users can access admin endpoints
    # Use RBAC system for organization-level permissions
    return current_user


def require_super_admin(current_user: User = Depends(get_current_active_user)) -> User:
    """Require super admin access.
    
    Note: Organization-level permissions are enforced with RBAC dependencies.
    """
    if not is_superadmin(current_user.role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required"
        )
    return current_user

