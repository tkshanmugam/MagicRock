"""
Seed script for RBAC system default data.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from app.models.role import Role
from app.models.module import Module
from app.models.role_module_permission import RoleModulePermission


async def seed_rbac_data(db: AsyncSession) -> None:
    """Seed default roles, modules, and permissions."""
    
    # Seed default roles
    roles_data = [
        {"name": "Admin"},
        {"name": "Manager"},
        {"name": "Viewer"},
    ]
    
    roles_map = {}
    for role_data in roles_data:
        result = await db.execute(
            select(Role).where(Role.name == role_data["name"])
        )
        role = result.scalar_one_or_none()
        
        if not role:
            role = Role(**role_data)
            db.add(role)
            await db.flush()
        
        roles_map[role_data["name"]] = role
    
    await db.commit()
    
    # Seed default modules
    modules_data = [
        {"code": "DASHBOARD", "name": "Dashboard"},
        {"code": "REPORTS", "name": "Reports"},
        {"code": "BILLING", "name": "Billing"},
        {"code": "SALES", "name": "Sales"},
        {"code": "PURCHASE", "name": "Purchase"},
        {"code": "USERS", "name": "Users"},
        {"code": "ROLES", "name": "Roles"},
        {"code": "MODULES", "name": "Modules"},
        {"code": "ROLE_PERMISSIONS", "name": "Role Permissions"},
        {"code": "ORGANIZATIONS", "name": "Organizations"},
    ]
    
    modules_map = {}
    for module_data in modules_data:
        result = await db.execute(
            select(Module).where(Module.code == module_data["code"])
        )
        module = result.scalar_one_or_none()
        
        if not module:
            module = Module(**module_data)
            db.add(module)
            await db.flush()
        
        modules_map[module_data["code"]] = module
    
    await db.commit()
    
    # Seed permissions
    # Admin: Full permissions on all modules
    admin_role = roles_map["Admin"]
    for module_code, module in modules_map.items():
        result = await db.execute(
            select(RoleModulePermission).where(
                RoleModulePermission.role_id == admin_role.id,
                RoleModulePermission.module_id == module.id
            )
        )
        perm = result.scalar_one_or_none()
        
        if not perm:
            perm = RoleModulePermission(
                role_id=admin_role.id,
                module_id=module.id,
                can_view=True,
                can_create=True,
                can_update=True,
                can_delete=True
            )
            db.add(perm)
    
    # Manager: Limited permissions (view, create, update, no delete)
    manager_role = roles_map["Manager"]
    for module_code, module in modules_map.items():
        result = await db.execute(
            select(RoleModulePermission).where(
                RoleModulePermission.role_id == manager_role.id,
                RoleModulePermission.module_id == module.id
            )
        )
        perm = result.scalar_one_or_none()
        
        if not perm:
            perm = RoleModulePermission(
                role_id=manager_role.id,
                module_id=module.id,
                can_view=True,
                can_create=True,
                can_update=True,
                can_delete=False
            )
            db.add(perm)
    
    # Viewer: Read-only permissions
    viewer_role = roles_map["Viewer"]
    for module_code, module in modules_map.items():
        result = await db.execute(
            select(RoleModulePermission).where(
                RoleModulePermission.role_id == viewer_role.id,
                RoleModulePermission.module_id == module.id
            )
        )
        perm = result.scalar_one_or_none()
        
        if not perm:
            perm = RoleModulePermission(
                role_id=viewer_role.id,
                module_id=module.id,
                can_view=True,
                can_create=False,
                can_update=False,
                can_delete=False
            )
            db.add(perm)
    
    await db.commit()
    print("✓ RBAC seed data created successfully.")


async def seed_rbac_data_if_needed(db: AsyncSession) -> None:
    """Seed RBAC data only if it doesn't exist."""
    # Check if roles already exist
    result = await db.execute(select(Role))
    existing_roles = result.scalars().all()
    
    if not existing_roles:
        await seed_rbac_data(db)
    else:
        print("✓ RBAC seed data already exists. Skipping.")
