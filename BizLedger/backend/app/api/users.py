"""
User management endpoints.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.user_organization import UserOrganization
from app.models.organisation import Organisation
from app.models.role import Role
from app.api.schemas import UserCreate, UserUpdate, UserResponse
from app.api.dependencies import require_admin, require_super_admin, get_current_active_user
from app.api.dependencies_rbac import RequirePermissionFromHeader
from app.core.security import get_password_hash
from app.services.audit_service import AuditLogService

router = APIRouter(prefix="/users", tags=["Users"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    request: Request,
    current_user: User = Depends(require_admin),
    _=Depends(RequirePermissionFromHeader("USERS", "create")),
    db: AsyncSession = Depends(get_db)
):
    """Create a new user (Admin only).
    
    Optionally assign the user to an organization with a role by providing
    organization_id and role_id. If both are provided, a user_organizations
    record will be created automatically.
    """
    # Check if username already exists
    result = await db.execute(
        select(User).where(User.username == user_data.username)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Validate organisation and role if provided (before creating user)
    if user_data.organization_id is not None and user_data.role_id is not None:
        # Verify organisation exists
        result = await db.execute(
            select(Organisation).where(Organisation.id == user_data.organization_id)
        )
        organisation = result.scalar_one_or_none()
        if not organisation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organisation not found"
            )
        
        # Verify role exists
        result = await db.execute(
            select(Role).where(Role.id == user_data.role_id)
        )
        role = result.scalar_one_or_none()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found"
        )
    
    # Create user
    # Generate a placeholder email since email is required in DB but not in API
    # Use a valid email format that passes Pydantic validation
    import uuid
    # Use a UUID-based email to ensure uniqueness and validity
    unique_suffix = str(uuid.uuid4())[:8]
    placeholder_email = f"{user_data.username}+{unique_suffix}@example.com"
    
    # Check if placeholder email already exists (very unlikely with UUID, but check anyway)
    result = await db.execute(
        select(User).where(User.email == placeholder_email)
    )
    if result.scalar_one_or_none():
        # If email exists (extremely rare), generate a new one
        unique_suffix = str(uuid.uuid4())[:8]
        placeholder_email = f"{user_data.username}+{unique_suffix}@example.com"
    
    try:
        # Organization-specific roles are assigned via RBAC when user is added to organizations
        new_user = User(
            username=user_data.username,
            email=placeholder_email,
            full_name=user_data.full_name,
            hashed_password=get_password_hash(user_data.password),
            role=UserRole.ORG_USER,
            is_active=True
        )
        
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        
        # Create user_organization record if organization_id and role_id are provided
        if user_data.organization_id is not None and user_data.role_id is not None:
            # Check if user already assigned to organization (shouldn't happen for new user, but check anyway)
            result = await db.execute(
                select(UserOrganization).where(
                    UserOrganization.user_id == new_user.id,
                    UserOrganization.organization_id == user_data.organization_id
                )
            )
            existing = result.scalar_one_or_none()
            
            if existing:
                # Update existing assignment
                existing.role_id = user_data.role_id
                existing.status = "active"
                await db.commit()
                await db.refresh(existing)
            else:
                # Create new assignment
                user_org = UserOrganization(
                    user_id=new_user.id,
                    organization_id=user_data.organization_id,
                    role_id=user_data.role_id,
                    status="active"
                )
                db.add(user_org)
                await db.commit()
        
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        await AuditLogService.log_create(
            db=db,
            organisation_id=user_data.organization_id,
            user_id=current_user.id,
            module_name="User",
            entity_name="user",
            entity_id=new_user.id,
            new_value=AuditLogService.serialize_instance(new_user),
            ip_address=client_ip,
            user_agent=user_agent,
        )
        
        return new_user
    except Exception as e:
        await db.rollback()
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Error creating user: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )


@router.get("", response_model=List[UserResponse])
async def list_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(require_admin),
    _=Depends(RequirePermissionFromHeader("USERS", "view")),
    db: AsyncSession = Depends(get_db)
):
    """List all users (Admin only)."""
    result = await db.execute(
        select(User).offset(skip).limit(limit)
    )
    users = result.scalars().all()
    
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Fetching users list, found {len(users)} users")
    
    # Fetch user organizations and roles for each user
    user_responses = []
    for user in users:
        # Get user's organizations and roles from user_organizations
        user_orgs_result = await db.execute(
            select(UserOrganization, Organisation, Role)
            .join(Organisation, UserOrganization.organization_id == Organisation.id)
            .join(Role, UserOrganization.role_id == Role.id)
            .where(
                UserOrganization.user_id == user.id,
                UserOrganization.status == "active"
            )
        )
        user_orgs = user_orgs_result.all()
        
        # Get organization IDs and primary role (first role found, or most common)
        # Map new organization IDs to old organisation IDs by matching names
        organisation_ids = []
        primary_role = None
        primary_role_id = None
        
        if user_orgs:
            logger.info(f"User {user.id} has {len(user_orgs)} organization assignments")
            for user_org, org, role in user_orgs:
                organisation_ids.append(org.id)
                
                # Use first role as primary (or you could use most common)
                if primary_role is None:
                    primary_role = role.name
                    primary_role_id = role.id
                    logger.debug(f"User {user.id} primary role: {role.name} (ID: {role.id})")
        else:
            logger.debug(f"User {user.id} has no organization assignments")
        
        # Create user response with role and organizations
        # Use UserResponse model to ensure proper serialization
        user_response = UserResponse(
            id=user.id,
            username=user.username,
            full_name=user.full_name,
            is_active=user.is_active,
            created_at=user.created_at,
            updated_at=user.updated_at,
            role=primary_role,
            role_id=primary_role_id,
            organisations=organisation_ids if organisation_ids else None
        )
        user_responses.append(user_response)
    
    return user_responses


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    _=Depends(RequirePermissionFromHeader("USERS", "view")),
    db: AsyncSession = Depends(get_db)
):
    """Get user by ID (Admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    request: Request,
    current_user: User = Depends(require_admin),
    _=Depends(RequirePermissionFromHeader("USERS", "update")),
    db: AsyncSession = Depends(get_db)
):
    """Update user (Admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update user fields
    old_snapshot = AuditLogService.serialize_instance(user)
    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await db.commit()
    await db.refresh(user)
    
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AuditLogService.log_update(
        db=db,
        organisation_id=None,
        user_id=current_user.id,
        module_name="User",
        entity_name="user",
        entity_id=user_id,
        old_value=old_snapshot,
        new_value=AuditLogService.serialize_instance(user),
        ip_address=client_ip,
        user_agent=user_agent,
    )
    
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_super_admin),
    _=Depends(RequirePermissionFromHeader("USERS", "delete")),
    db: AsyncSession = Depends(get_db)
):
    """Delete user (Super Admin only)."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent self-deletion
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Check for foreign key constraints - handle related records first
    try:
        import logging
        logger = logging.getLogger(__name__)
        logger.info(f"Attempting to delete user {user_id} (username: {user.username}) by user {current_user.id}")
        # Check if user has created or modified organisations
        from app.models.organisation import Organisation
        orgs_created_result = await db.execute(
            select(Organisation).where(Organisation.created_by == user_id)
        )
        orgs_created_list = orgs_created_result.scalars().all()
        
        orgs_modified = await db.execute(
            select(Organisation).where(Organisation.modified_by == user_id)
        )
        orgs_modified_list = orgs_modified.scalars().all()
        
        if orgs_created_list:
            # User has created organisations - reassign to current user or prevent deletion
            logger.info(f"Reassigning {len(orgs_created_list)} organisations created by user {user_id} to user {current_user.id}")
            for org in orgs_created_list:
                org.created_by = current_user.id
                if org.modified_by == user_id:
                    org.modified_by = current_user.id
        
        if orgs_modified_list:
            # Update modified_by for organisations modified by this user
            logger.info(f"Updating {len(orgs_modified_list)} organisations modified by user {user_id}")
            for org in orgs_modified_list:
                if org.modified_by == user_id:
                    org.modified_by = current_user.id
        
        # Flush changes to organisations before deleting user_organizations
        if orgs_created_list or orgs_modified_list:
            await db.flush()
        
        # Delete user_organizations records (cascade should handle this, but be explicit)
        user_orgs_result = await db.execute(
            select(UserOrganization).where(UserOrganization.user_id == user_id)
        )
        user_orgs = user_orgs_result.scalars().all()
        if user_orgs:
            logger.info(f"Deleting {len(user_orgs)} user_organization records for user {user_id}")
            for user_org in user_orgs:
                await db.delete(user_org)
            await db.flush()
        
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        await AuditLogService.log_delete(
            db=db,
            organisation_id=None,
            user_id=current_user.id,
            module_name="User",
            entity_name="user",
            entity_id=user_id,
            old_value=AuditLogService.serialize_instance(user),
            ip_address=client_ip,
            user_agent=user_agent,
        )
        
        # Delete the user (audit_logs and refresh_tokens have cascade delete)
        await db.delete(user)
        await db.commit()
    
        return None
    except HTTPException:
        # Re-raise HTTP exceptions (like self-deletion) as-is
        raise
    except Exception as e:
        await db.rollback()
        import logging
        logger = logging.getLogger(__name__)
        error_msg = str(e)
        logger.error(f"Error deleting user {user_id}: {error_msg}", exc_info=True)
        
        # Provide more specific error messages
        if "foreign key constraint" in error_msg.lower() or "violates foreign key" in error_msg.lower():
            detail = f"Cannot delete user: User is referenced by other records. {error_msg}"
        elif "permission" in error_msg.lower() or "access" in error_msg.lower():
            detail = f"Cannot delete user: Permission denied. {error_msg}"
        else:
            detail = f"Failed to delete user: {error_msg}"
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )

