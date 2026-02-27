"""
Roles API endpoints.
"""
from typing import List
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User
from app.models.role import Role
from app.models.module import Module
from app.models.user_organization import UserOrganization
from app.models.role_module_permission import RoleModulePermission
from app.api.schemas import (
    RoleResponse,
    RoleCreate,
    RoleUpdate,
    RoleModulePermissionBulkUpdate,
    RoleModulePermissionResponse,
)
from app.api.dependencies import get_current_active_user, require_admin
from app.api.dependencies_rbac import RequirePermissionFromHeader

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/roles", tags=["Roles"])


@router.get("", response_model=List[RoleResponse])
async def list_roles(
    current_user: User = Depends(get_current_active_user),
    _=Depends(RequirePermissionFromHeader("ROLES", "view")),
    db: AsyncSession = Depends(get_db)
):
    """List all available roles (Authenticated users)."""
    try:
        result = await db.execute(
            select(Role).order_by(Role.name)
        )
        roles = result.scalars().all()
        
        logger.info(f"Found {len(roles)} roles in database")
        
        # If no roles exist, seed them automatically
        if not roles:
            logger.info("No roles found. Seeding default roles...")
            from app.db.seed_rbac import seed_rbac_data
            await seed_rbac_data(db)
            # Fetch roles again after seeding
            result = await db.execute(
                select(Role).order_by(Role.name)
            )
            roles = result.scalars().all()
            logger.info(f"Seeded {len(roles)} roles successfully")
        
        # Log role details for debugging
        role_list = [{"id": r.id, "name": r.name} for r in roles]
        logger.debug(f"Returning roles: {role_list}")
        
        return roles
    except Exception as e:
        logger.error(f"Error fetching roles: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch roles: {str(e)}"
        )


@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_data: RoleCreate,
    current_user: User = Depends(require_admin),
    _=Depends(RequirePermissionFromHeader("ROLES", "create")),
    db: AsyncSession = Depends(get_db)
):
    """Create a new role (Admin only)."""
    name = role_data.name.strip()
    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Role name is required"
        )
    
    result = await db.execute(select(Role).where(Role.name == name))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role with name '{name}' already exists"
        )
    
    new_role = Role(name=name)
    db.add(new_role)
    await db.commit()
    await db.refresh(new_role)
    
    logger.info(f"Role '{new_role.name}' created by user {current_user.id}")
    return new_role


@router.get("/{role_id}", response_model=RoleResponse)
async def get_role(
    role_id: int,
    current_user: User = Depends(get_current_active_user),
    _=Depends(RequirePermissionFromHeader("ROLES", "view")),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific role by ID (Authenticated users)."""
    try:
        result = await db.execute(
            select(Role).where(Role.id == role_id)
        )
        role = result.scalar_one_or_none()
        
        if not role:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Role with ID {role_id} not found"
            )
        
        return role
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching role {role_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch role: {str(e)}"
        )


@router.put("/{role_id}", response_model=RoleResponse)
async def update_role(
    role_id: int,
    role_data: RoleUpdate,
    current_user: User = Depends(require_admin),
    _=Depends(RequirePermissionFromHeader("ROLES", "update")),
    db: AsyncSession = Depends(get_db)
):
    """Update role (Admin only)."""
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    if role_data.name is not None:
        name = role_data.name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Role name is required"
            )
        
        if name != role.name:
            result = await db.execute(select(Role).where(Role.name == name))
            existing = result.scalar_one_or_none()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Role with name '{name}' already exists"
                )
            role.name = name
    
    await db.commit()
    await db.refresh(role)
    
    logger.info(f"Role {role_id} updated by user {current_user.id}")
    return role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: int,
    current_user: User = Depends(require_admin),
    _=Depends(RequirePermissionFromHeader("ROLES", "delete")),
    db: AsyncSession = Depends(get_db)
):
    """Delete role (Admin only)."""
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Prevent deleting roles assigned to users
    user_roles_result = await db.execute(
        select(UserOrganization).where(UserOrganization.role_id == role_id)
    )
    user_roles = user_roles_result.scalars().all()
    if user_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete role: role is assigned to users"
        )
    
    # Remove role-module permissions
    try:
        perms_result = await db.execute(
            select(RoleModulePermission).where(RoleModulePermission.role_id == role_id)
        )
        perms = perms_result.scalars().all()
        if perms:
            for perm in perms:
                await db.delete(perm)
            await db.flush()
        
        await db.delete(role)
        await db.commit()
        
        logger.info(f"Role {role_id} deleted by user {current_user.id}")
        return None
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting role {role_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete role: {str(e)}"
        )


@router.get("/{role_id}/permissions", response_model=List[RoleModulePermissionResponse])
async def get_role_permissions(
    role_id: int,
    current_user: User = Depends(get_current_active_user),
    _=Depends(RequirePermissionFromHeader("ROLE_PERMISSIONS", "view")),
    db: AsyncSession = Depends(get_db)
):
    """Get role-module permissions for a role (Authenticated users)."""
    # Verify role exists
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    # Fetch all modules
    result = await db.execute(select(Module).order_by(Module.code))
    modules = result.scalars().all()

    # Fetch existing permissions for role
    result = await db.execute(
        select(RoleModulePermission).where(RoleModulePermission.role_id == role_id)
    )
    permissions = result.scalars().all()
    permission_map = {perm.module_id: perm for perm in permissions}

    response = []
    for module in modules:
        perm = permission_map.get(module.id)
        response.append(
            RoleModulePermissionResponse(
                id=perm.id if perm else None,
                role_id=role_id,
                module_id=module.id,
                module_code=module.code,
                module_name=module.name,
                can_view=perm.can_view if perm else False,
                can_create=perm.can_create if perm else False,
                can_update=perm.can_update if perm else False,
                can_delete=perm.can_delete if perm else False
            )
        )

    return response


@router.put("/{role_id}/permissions", response_model=List[RoleModulePermissionResponse])
async def update_role_permissions(
    role_id: int,
    permission_data: RoleModulePermissionBulkUpdate,
    current_user: User = Depends(require_admin),
    _=Depends(RequirePermissionFromHeader("ROLE_PERMISSIONS", "update")),
    db: AsyncSession = Depends(get_db)
):
    """Update role-module permissions in bulk (Admin only)."""
    # Verify role exists
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    module_ids = [item.module_id for item in permission_data.permissions]

    if module_ids:
        result = await db.execute(select(Module).where(Module.id.in_(module_ids)))
        modules = result.scalars().all()
        module_map = {module.id: module for module in modules}

        missing_module_ids = [module_id for module_id in module_ids if module_id not in module_map]
        if missing_module_ids:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Modules not found: {missing_module_ids}"
            )
    else:
        module_map = {}

    # Load existing permissions
    result = await db.execute(
        select(RoleModulePermission).where(RoleModulePermission.role_id == role_id)
    )
    existing_permissions = result.scalars().all()
    existing_map = {perm.module_id: perm for perm in existing_permissions}

    # Delete permissions not in payload
    incoming_module_ids = set(module_ids)
    for perm in existing_permissions:
        if perm.module_id not in incoming_module_ids:
            await db.delete(perm)

    # Upsert permissions
    for item in permission_data.permissions:
        perm = existing_map.get(item.module_id)
        if perm:
            perm.can_view = item.can_view
            perm.can_create = item.can_create
            perm.can_update = item.can_update
            perm.can_delete = item.can_delete
        else:
            perm = RoleModulePermission(
                role_id=role_id,
                module_id=item.module_id,
                can_view=item.can_view,
                can_create=item.can_create,
                can_update=item.can_update,
                can_delete=item.can_delete
            )
            db.add(perm)

    await db.commit()

    # Return updated permissions including modules without permissions
    result = await db.execute(select(Module).order_by(Module.code))
    all_modules = result.scalars().all()

    result = await db.execute(
        select(RoleModulePermission).where(RoleModulePermission.role_id == role_id)
    )
    updated_permissions = result.scalars().all()
    updated_map = {perm.module_id: perm for perm in updated_permissions}

    response = []
    for module in all_modules:
        perm = updated_map.get(module.id)
        response.append(
            RoleModulePermissionResponse(
                id=perm.id if perm else None,
                role_id=role_id,
                module_id=module.id,
                module_code=module.code,
                module_name=module.name,
                can_view=perm.can_view if perm else False,
                can_create=perm.can_create if perm else False,
                can_update=perm.can_update if perm else False,
                can_delete=perm.can_delete if perm else False
            )
        )

    logger.info(f"Role {role_id} permissions updated by user {current_user.id}")
    return response


@router.delete("/{role_id}/permissions/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role_permission(
    role_id: int,
    module_id: int,
    current_user: User = Depends(require_admin),
    _=Depends(RequirePermissionFromHeader("ROLE_PERMISSIONS", "delete")),
    db: AsyncSession = Depends(get_db)
):
    """Delete a role-module permission mapping (Admin only)."""
    # Verify role exists
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )

    # Verify module exists
    result = await db.execute(select(Module).where(Module.id == module_id))
    module = result.scalar_one_or_none()
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found"
        )

    # Delete permission if it exists
    result = await db.execute(
        select(RoleModulePermission).where(
            RoleModulePermission.role_id == role_id,
            RoleModulePermission.module_id == module_id
        )
    )
    permission = result.scalar_one_or_none()
    if permission:
        await db.delete(permission)
        await db.commit()
        logger.info(f"Deleted permission for role {role_id} on module {module_id} by user {current_user.id}")
    return None
