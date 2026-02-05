"""
RBAC Organizations API endpoints.
"""
from typing import List
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User
from app.models.organisation import Organisation
from app.models.user_organization import UserOrganization
from app.models.module import Module
from app.models.role import Role
from app.models.role_module_permission import RoleModulePermission
from app.api.schemas import (
    OrganizationCreate, OrganizationResponse,
    UserOrganizationCreate, UserOrganizationUpdate, UserOrganizationResponse,
    UserPermissionsResponse, ModulePermissionResponse,
    RoleResponse, ModuleResponse
)
from app.api.dependencies import require_admin, get_current_active_user
from app.core.rbac import is_superadmin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/organizations", tags=["Organizations (RBAC)"])


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    organization_data: OrganizationCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new organization (Admin only)."""
    # Check if organisation name already exists
    result = await db.execute(
        select(Organisation).where(Organisation.name == organization_data.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization name already exists"
        )
    
    # Create organisation (legacy table)
    new_organization = Organisation(
        name=organization_data.name,
        address=None,
        is_valid=True,
        created_by=current_user.id,
    )

    db.add(new_organization)
    await db.flush()  # Flush to get the ID
    await db.commit()
    await db.refresh(new_organization)
    
    return new_organization


async def _format_organisations(organisations: List[Organisation]) -> List[dict]:
    return [
        {
            "id": org.id,
            "name": org.name,
            "status": "active" if org.is_valid else "inactive",
            "address": org.address,
            "created_at": org.created_date,
        }
        for org in organisations
    ]


@router.get("", response_model=List[OrganizationResponse])
async def list_organizations(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List all organizations (Authenticated users)."""
    result = await db.execute(
        select(Organisation).order_by(Organisation.id)
    )
    organisations = result.scalars().all()
    logger.info(f"Returning {len(organisations)} organisations for user {current_user.id}")
    return await _format_organisations(organisations)


@router.get("/me", response_model=List[OrganizationResponse])
async def get_my_organizations(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all organizations for current user."""
    if is_superadmin(current_user.role):
        result = await db.execute(
            select(Organisation).order_by(Organisation.id)
        )
        organisations = result.scalars().all()
        return await _format_organisations(organisations)

    result = await db.execute(
        select(Organisation)
        .join(UserOrganization, UserOrganization.organization_id == Organisation.id)
        .where(
            UserOrganization.user_id == current_user.id,
            UserOrganization.status == "active"
        )
        .distinct()
    )
    organisations = result.scalars().all()
    return await _format_organisations(organisations)


@router.post("/from-organisation/{organisation_id}/users", response_model=UserOrganizationResponse, status_code=status.HTTP_201_CREATED)
async def assign_user_from_old_organisation(
    organisation_id: int,
    user_org_data: UserOrganizationCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Assign user to organization using old organisation ID (Admin only).
    
    This endpoint accepts an organisation_id from the old organisations table,
    finds or creates the corresponding organization in the RBAC system,
    and assigns the user to it.
    
    If role_id is not provided, defaults to "Viewer" role.
    """
    # Get old organisation
    result = await db.execute(
        select(Organisation).where(Organisation.id == organisation_id)
    )
    old_org = result.scalar_one_or_none()
    if not old_org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found"
        )
    
    organization = old_org
    
    # Now delegate to the main assignment endpoint logic
    # Verify user exists
    result = await db.execute(
        select(User).where(User.id == user_org_data.user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get role_id - use provided role_id or default to "Viewer"
    role_id = user_org_data.role_id
    if role_id is None:
        # Get default "Viewer" role
        result = await db.execute(
            select(Role).where(Role.name == "Viewer")
        )
        viewer_role = result.scalar_one_or_none()
        if not viewer_role:
            # If Viewer role doesn't exist, seed RBAC data
            from app.db.seed_rbac import seed_rbac_data
            await seed_rbac_data(db)
            # Try again
            result = await db.execute(
                select(Role).where(Role.name == "Viewer")
            )
            viewer_role = result.scalar_one_or_none()
            if not viewer_role:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Default Viewer role not found and could not be created"
                )
        role_id = viewer_role.id
    
    # Verify role exists
    result = await db.execute(
        select(Role).where(Role.id == role_id)
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Check if user already assigned to organization
    result = await db.execute(
        select(UserOrganization).where(
            UserOrganization.user_id == user_org_data.user_id,
            UserOrganization.organization_id == organization.id
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        # Update existing assignment
        existing.role_id = role_id
        existing.status = "active"
        await db.commit()
        await db.refresh(existing)
        return existing
    
    # Create new assignment
    user_org = UserOrganization(
        user_id=user_org_data.user_id,
        organization_id=organization.id,
        role_id=role_id,
        status="active"
    )
    
    db.add(user_org)
    await db.commit()
    await db.refresh(user_org)
    
    return user_org


@router.post("/{organization_id}/users", response_model=UserOrganizationResponse, status_code=status.HTTP_201_CREATED)
async def assign_user_to_organization(
    organization_id: int,
    user_org_data: UserOrganizationCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Assign user to organization with role (Admin only).
    
    If role_id is not provided, defaults to "Viewer" role.
    """
    # Verify organisation exists
    result = await db.execute(
        select(Organisation).where(Organisation.id == organization_id)
    )
    organization = result.scalar_one_or_none()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found"
        )
    
    # Verify user exists
    result = await db.execute(
        select(User).where(User.id == user_org_data.user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get role_id - use provided role_id or default to "Viewer"
    role_id = user_org_data.role_id
    if role_id is None:
        # Get default "Viewer" role
        result = await db.execute(
            select(Role).where(Role.name == "Viewer")
        )
        viewer_role = result.scalar_one_or_none()
        if not viewer_role:
            # If Viewer role doesn't exist, seed RBAC data
            from app.db.seed_rbac import seed_rbac_data
            await seed_rbac_data(db)
            # Try again
            result = await db.execute(
                select(Role).where(Role.name == "Viewer")
            )
            viewer_role = result.scalar_one_or_none()
            if not viewer_role:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Default Viewer role not found and could not be created"
                )
        role_id = viewer_role.id
    
    # Verify role exists
    result = await db.execute(
        select(Role).where(Role.id == role_id)
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Check if user already assigned to organization
    result = await db.execute(
        select(UserOrganization).where(
            UserOrganization.user_id == user_org_data.user_id,
            UserOrganization.organization_id == organization_id
        )
    )
    existing = result.scalar_one_or_none()
    
    if existing:
        # Update existing assignment
        existing.role_id = role_id
        existing.status = "active"
        await db.commit()
        await db.refresh(existing)
        return existing
    
    # Create new assignment
    user_org = UserOrganization(
        user_id=user_org_data.user_id,
        organization_id=organization_id,
        role_id=role_id,
        status="active"
    )
    
    db.add(user_org)
    await db.commit()
    await db.refresh(user_org)
    
    return user_org


@router.put("/{organization_id}/users/{user_id}/role", response_model=UserOrganizationResponse)
async def update_user_role_in_organization(
    organization_id: int,
    user_id: int,
    role_data: UserOrganizationUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update user role in organization (Admin only)."""
    # Verify role exists
    result = await db.execute(
        select(Role).where(Role.id == role_data.role_id)
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Role not found"
        )
    
    # Find user-organization assignment
    result = await db.execute(
        select(UserOrganization).where(
            UserOrganization.user_id == user_id,
            UserOrganization.organization_id == organization_id
        )
    )
    user_org = result.scalar_one_or_none()
    
    if not user_org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not assigned to this organization"
        )
    
    # Update role
    user_org.role_id = role_data.role_id
    await db.commit()
    await db.refresh(user_org)
    
    return user_org


@router.get("/{organization_id}/permissions/me", response_model=UserPermissionsResponse)
async def get_my_permissions(
    organization_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's permissions for organization."""
    result = await db.execute(
        select(Organisation).where(Organisation.id == organization_id)
    )
    organization = result.scalar_one_or_none()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found"
        )

    if is_superadmin(current_user.role) or str(current_user.role).strip().lower() == "admin":
        result = await db.execute(select(Module).order_by(Module.code))
        modules = result.scalars().all()
        modules_permissions = [
            ModulePermissionResponse(
                code=module.code,
                name=module.name,
                canView=True,
                canCreate=True,
                canUpdate=True,
                canDelete=True
            )
            for module in modules
        ]
        return UserPermissionsResponse(
            organizationId=organization_id,
            modules=modules_permissions
        )

    # Get user's role in organization
    result = await db.execute(
        select(UserOrganization).where(
            UserOrganization.user_id == current_user.id,
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
    
    # Get all modules (all organizations have access by default)
    result = await db.execute(
        select(Module).order_by(Module.code)
    )
    modules = result.scalars().all()

    # Get permissions for user's role
    modules_permissions = []
    for module in modules:
        result = await db.execute(
            select(RoleModulePermission).where(
                RoleModulePermission.role_id == user_org.role_id,
                RoleModulePermission.module_id == module.id
            )
        )
        permission = result.scalar_one_or_none()
        
        if permission:
            modules_permissions.append(
                ModulePermissionResponse(
                    code=module.code,
                    name=module.name,
                    canView=permission.can_view,
                    canCreate=permission.can_create,
                    canUpdate=permission.can_update,
                    canDelete=permission.can_delete
                )
            )
    
    return UserPermissionsResponse(
        organizationId=organization_id,
        modules=modules_permissions
    )


@router.get("/roles", response_model=List[RoleResponse])
async def list_roles_org(
    current_user: User = Depends(get_current_active_user),
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


@router.get("/role", response_model=List[RoleResponse])
async def list_roles_singular(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List all available roles - alias for /roles (Authenticated users)."""
    # Reuse the same logic as /roles endpoint
    return await list_roles_org(current_user, db)


@router.get("/role/{role_id}", response_model=RoleResponse)
async def get_role_org(
    role_id: int,
    current_user: User = Depends(get_current_active_user),
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


@router.get("/modules", response_model=List[ModuleResponse])
async def list_modules(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List all available modules (Authenticated users)."""
    result = await db.execute(
        select(Module).order_by(Module.code)
    )
    modules = result.scalars().all()
    return modules
