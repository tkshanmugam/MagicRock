"""
Permission service for RBAC system.
"""
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.models.module import Module
from app.models.role_module_permission import RoleModulePermission
from app.models.user_organization import UserOrganization
from app.core.rbac import is_superadmin
from app.db.seed_rbac import seed_rbac_data


async def check_permission(
    db: AsyncSession,
    user_id: int,
    organization_id: int,
    module_code: str,
    action: str  # view | create | update | delete
) -> None:
    """
    Check if user has permission to perform action on module in organization.
    
    Raises HTTPException(403) if permission is denied.
    
    Required checks:
    1. Super admin/Admin bypass (full access)
    2. Restrict non-admin users to view-only
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if is_superadmin(user.role) or str(user.role).strip().lower() == "admin":
        return None

    if not organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization is required for permission check"
        )

    result = await db.execute(
        select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.organization_id == organization_id,
            UserOrganization.status == "active"
        )
    )
    user_org = result.scalar_one_or_none()
    if not user_org:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organization"
        )

    normalized_code = module_code.strip().upper()
    result = await db.execute(select(Module).where(Module.code == normalized_code))
    module = result.scalar_one_or_none()
    if not module:
        # Attempt to seed RBAC defaults if modules are missing
        await seed_rbac_data(db)
        result = await db.execute(select(Module).where(Module.code == normalized_code))
        module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Module '{module_code}' not found"
        )

    result = await db.execute(
        select(RoleModulePermission).where(
            RoleModulePermission.role_id == user_org.role_id,
            RoleModulePermission.module_id == module.id
        )
    )
    permission = result.scalar_one_or_none()
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied: {action} on module '{module_code}'"
        )

    allowed = False
    if action == "view":
        allowed = permission.can_view
    elif action == "create":
        allowed = permission.can_create
    elif action == "update":
        allowed = permission.can_update
    elif action == "delete":
        allowed = permission.can_delete

    if allowed:
        return None

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Permission denied: {action} on module '{module_code}'"
    )
