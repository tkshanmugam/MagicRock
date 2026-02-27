"""
Organisation management endpoints.
"""
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pathlib import Path
from uuid import uuid4
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User
from app.models.organisation import Organisation
from app.models.user_organization import UserOrganization
from app.models.module import Module
from app.models.role_module_permission import RoleModulePermission
from app.api.schemas import (
    OrganisationCreate,
    OrganisationUpdate,
    OrganisationResponse,
    UserOrganizationCreate,
    UserOrganizationResponse,
    UserPermissionsResponse,
    ModulePermissionResponse,
)
from app.api.dependencies import require_admin, get_current_active_user
from app.core.rbac import is_superadmin
from app.core.config import settings

router = APIRouter(prefix="/organisations", tags=["Organisations"])


def _normalize_logo_extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def _validate_logo_file(file: UploadFile) -> None:
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo file is required"
        )

    extension = _normalize_logo_extension(file.filename)
    allowed_extensions = set(settings.org_logo_allowed_extensions_list)
    allowed_types = set(settings.org_logo_allowed_content_types_list)
    content_type = (file.content_type or "").lower()

    if extension not in allowed_extensions or content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PNG, JPG, JPEG files are allowed"
        )


def _get_uploads_root() -> Path:
    uploads_root = Path(settings.UPLOADS_DIR).resolve()
    uploads_root.mkdir(parents=True, exist_ok=True)
    return uploads_root


def _resolve_safe_path(base_dir: Path, target_path: Path) -> Path:
    resolved_target = target_path.resolve()
    if base_dir not in resolved_target.parents and resolved_target != base_dir:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path"
        )
    return resolved_target


async def _save_organisation_logo(
    organisation: Organisation,
    file: UploadFile,
    current_user: User,
    db: AsyncSession
) -> Organisation:
    _validate_logo_file(file)

    contents = await file.read()
    if len(contents) > settings.org_logo_max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Logo size must be less than or equal to 2 MB"
        )

    uploads_root = _get_uploads_root()
    org_dir = uploads_root / settings.ORG_LOGO_SUBDIR / str(organisation.id)
    org_dir.mkdir(parents=True, exist_ok=True)

    extension = _normalize_logo_extension(file.filename)
    new_filename = f"{uuid4().hex}{extension}"
    target_path = _resolve_safe_path(uploads_root, org_dir / new_filename)

    if organisation.logo_name:
        existing_path = _resolve_safe_path(uploads_root, uploads_root / organisation.logo_name)
        if existing_path.exists() and existing_path.is_file():
            existing_path.unlink()

    with open(target_path, "wb") as output_file:
        output_file.write(contents)

    relative_logo_path = Path(settings.ORG_LOGO_SUBDIR) / str(organisation.id) / new_filename
    organisation.logo_name = relative_logo_path.as_posix()
    organisation.modified_by = current_user.id
    organisation.modified_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(organisation)
    return organisation


@router.post("", response_model=OrganisationResponse, status_code=status.HTTP_201_CREATED)
async def create_organisation(
    organisation_data: OrganisationCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Create a new organisation (Admin only)."""
    # Check if organisation name already exists
    result = await db.execute(
        select(Organisation).where(Organisation.name == organisation_data.name)
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organisation name already exists"
        )
    
    # Create organisation
    new_organisation = Organisation(
        name=organisation_data.name,
        address=organisation_data.address,
        bank_name=organisation_data.bank_name,
        account_number=organisation_data.account_number,
        ifsc_code=organisation_data.ifsc_code,
        branch=organisation_data.branch,
        is_valid=organisation_data.is_valid,
        created_by=current_user.id
    )
    
    db.add(new_organisation)
    await db.commit()
    await db.refresh(new_organisation)
    
    return new_organisation


@router.get("", response_model=List[OrganisationResponse])
async def list_organisations(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List all organisations (Authenticated users)."""
    result = await db.execute(
        select(Organisation).offset(skip).limit(limit).order_by(Organisation.created_date.desc())
    )
    organisations = result.scalars().all()
    return organisations


@router.get("/me", response_model=List[OrganisationResponse])
async def list_my_organisations(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """List organisations for current user."""
    if is_superadmin(current_user.role):
        result = await db.execute(
            select(Organisation).order_by(Organisation.id)
        )
        return result.scalars().all()

    result = await db.execute(
        select(Organisation)
        .join(UserOrganization, UserOrganization.organization_id == Organisation.id)
        .where(
            UserOrganization.user_id == current_user.id,
            UserOrganization.status == "active"
        )
        .distinct()
    )
    return result.scalars().all()


@router.post("/from-organisation/{organisation_id}/users", response_model=UserOrganizationResponse, status_code=status.HTTP_201_CREATED)
async def assign_user_from_organisation(
    organisation_id: int,
    user_org_data: UserOrganizationCreate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Assign user to organisation using old organisation ID (Admin only)."""
    from app.api import organizations_rbac

    return await organizations_rbac.assign_user_from_old_organisation(
        organisation_id=organisation_id,
        user_org_data=user_org_data,
        current_user=current_user,
        db=db
    )


@router.get("/{organisation_id}/permissions/me", response_model=UserPermissionsResponse)
async def get_my_permissions(
    organisation_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's permissions for organisation."""
    result = await db.execute(
        select(Organisation).where(Organisation.id == organisation_id)
    )
    organisation = result.scalar_one_or_none()
    if not organisation:
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
            organizationId=organisation_id,
            modules=modules_permissions
        )

    result = await db.execute(
        select(UserOrganization).where(
            UserOrganization.user_id == current_user.id,
            UserOrganization.organization_id == organisation_id,
            UserOrganization.status == "active"
        )
    )
    user_org = result.scalar_one_or_none()
    if not user_org:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User does not belong to this organisation"
        )

    result = await db.execute(select(Module).order_by(Module.code))
    modules = result.scalars().all()

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
        organizationId=organisation_id,
        modules=modules_permissions
    )


@router.get("/{organisation_id}", response_model=OrganisationResponse)
async def get_organisation(
    organisation_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Get organisation by ID (Admin only)."""
    result = await db.execute(
        select(Organisation).where(Organisation.id == organisation_id)
    )
    organisation = result.scalar_one_or_none()
    
    if not organisation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found"
        )
    
    return organisation


@router.put("/{organisation_id}", response_model=OrganisationResponse)
async def update_organisation(
    organisation_id: int,
    organisation_data: OrganisationUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Update organisation (Admin only)."""
    result = await db.execute(
        select(Organisation).where(Organisation.id == organisation_id)
    )
    organisation = result.scalar_one_or_none()
    
    if not organisation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found"
        )
    
    # Check if name is being updated and if it already exists
    if organisation_data.name and organisation_data.name != organisation.name:
        result = await db.execute(
            select(Organisation).where(Organisation.name == organisation_data.name)
        )
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organisation name already exists"
            )
    
    # Update organisation fields
    update_data = organisation_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(organisation, field, value)
    
    # Update modified_by and modified_at
    organisation.modified_by = current_user.id
    organisation.modified_at = datetime.now(timezone.utc)
    
    await db.commit()
    await db.refresh(organisation)
    
    return organisation


@router.post("/{organisation_id}/logo", response_model=OrganisationResponse)
async def upload_organisation_logo(
    organisation_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Upload or replace organisation logo (Admin only)."""
    result = await db.execute(
        select(Organisation).where(Organisation.id == organisation_id)
    )
    organisation = result.scalar_one_or_none()

    if not organisation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found"
        )

    return await _save_organisation_logo(
        organisation=organisation,
        file=file,
        current_user=current_user,
        db=db
    )


@router.delete("/{organisation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organisation(
    organisation_id: int,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db)
):
    """Delete organisation (Admin only)."""
    result = await db.execute(
        select(Organisation).where(Organisation.id == organisation_id)
    )
    organisation = result.scalar_one_or_none()
    
    if not organisation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organisation not found"
        )
    
    await db.delete(organisation)
    await db.commit()
    
    return None
