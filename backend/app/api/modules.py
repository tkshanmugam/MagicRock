"""
Modules API endpoints for CRUD operations.
"""
from typing import List
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User
from app.models.module import Module
from app.models.role_module_permission import RoleModulePermission
from app.api.schemas import ModuleCreate, ModuleUpdate, ModuleResponse
from app.api.dependencies import require_admin, get_current_active_user
from app.api.dependencies_rbac import RequirePermissionFromHeader

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/modules", tags=["Modules"])


@router.post("", response_model=ModuleResponse, status_code=status.HTTP_201_CREATED)
async def create_module(
    module_data: ModuleCreate,
    current_user: User = Depends(require_admin),
    _=Depends(RequirePermissionFromHeader("MODULES", "create")),
    db: AsyncSession = Depends(get_db)
):
    """Create a new module (Admin only)."""
    # Check if module code already exists
    result = await db.execute(
        select(Module).where(Module.code == module_data.code)
    )
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Module with code '{module_data.code}' already exists"
        )
    
    # Create new module
    new_module = Module(
        code=module_data.code,
        name=module_data.name
    )
    
    db.add(new_module)
    await db.commit()
    await db.refresh(new_module)
    
    logger.info(f"Module '{new_module.code}' created by user {current_user.id}")
    
    return new_module


@router.get("", response_model=List[ModuleResponse])
async def list_modules(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    _=Depends(RequirePermissionFromHeader("MODULES", "view")),
    db: AsyncSession = Depends(get_db)
):
    """List all modules (Authenticated users)."""
    result = await db.execute(
        select(Module).offset(skip).limit(limit).order_by(Module.code)
    )
    modules = result.scalars().all()
    return modules


@router.get("/{module_id}", response_model=ModuleResponse)
async def get_module(
    module_id: int,
    current_user: User = Depends(get_current_active_user),
    _=Depends(RequirePermissionFromHeader("MODULES", "view")),
    db: AsyncSession = Depends(get_db)
):
    """Get module by ID (Authenticated users)."""
    result = await db.execute(
        select(Module).where(Module.id == module_id)
    )
    module = result.scalar_one_or_none()
    
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found"
        )
    
    return module


@router.put("/{module_id}", response_model=ModuleResponse)
async def update_module(
    module_id: int,
    module_data: ModuleUpdate,
    current_user: User = Depends(require_admin),
    _=Depends(RequirePermissionFromHeader("MODULES", "update")),
    db: AsyncSession = Depends(get_db)
):
    """Update module (Admin only)."""
    result = await db.execute(
        select(Module).where(Module.id == module_id)
    )
    module = result.scalar_one_or_none()
    
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found"
        )
    
    # Check if new code conflicts with existing module
    if module_data.code and module_data.code != module.code:
        result = await db.execute(
            select(Module).where(Module.code == module_data.code)
        )
        existing = result.scalar_one_or_none()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Module with code '{module_data.code}' already exists"
            )
    
    # Update module fields
    if module_data.code is not None:
        module.code = module_data.code
    if module_data.name is not None:
        module.name = module_data.name
    
    await db.commit()
    await db.refresh(module)
    
    logger.info(f"Module {module_id} updated by user {current_user.id}")
    
    return module


@router.delete("/{module_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_module(
    module_id: int,
    current_user: User = Depends(require_admin),
    _=Depends(RequirePermissionFromHeader("MODULES", "delete")),
    db: AsyncSession = Depends(get_db)
):
    """Delete module (Admin only).
    
    Note: This will fail if the module is referenced by role_module_permissions.
    """
    result = await db.execute(
        select(Module).where(Module.id == module_id)
    )
    module = result.scalar_one_or_none()
    
    if not module:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Module not found"
        )
    
    # Check for foreign key constraints
    try:
        # Check if module is used in role_module_permissions
        role_perms_result = await db.execute(
            select(RoleModulePermission).where(RoleModulePermission.module_id == module_id)
        )
        role_perms = role_perms_result.scalars().all()
        
        if role_perms:
            # Delete role_module_permission references first
            logger.info(f"Deleting {len(role_perms)} role_module_permission references for module {module_id}")
            for role_perm in role_perms:
                await db.delete(role_perm)
            await db.flush()
        
        # Delete the module
        await db.delete(module)
        await db.commit()
        
        logger.info(f"Module {module_id} deleted by user {current_user.id}")
        
        return None
    except Exception as e:
        await db.rollback()
        logger.error(f"Error deleting module {module_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to delete module: {str(e)}"
        )
