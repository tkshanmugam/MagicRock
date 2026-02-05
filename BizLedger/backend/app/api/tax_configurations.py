"""
Tax configuration endpoints.
"""
from typing import List
from fastapi import APIRouter, Depends, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.api.dependencies import get_current_active_user
from app.models.user import User
from app.api.dependencies_rbac import RequirePermissionFromHeader
from app.api.schemas import TaxConfigurationCreate, TaxConfigurationUpdate, TaxConfigurationResponse
from app.services.tax_configuration_service import (
    list_tax_configurations,
    create_tax_configuration,
    update_tax_configuration,
    delete_tax_configuration,
    get_active_tax_configuration,
    get_tax_configuration,
)
from app.services.audit_service import AuditLogService

router = APIRouter(prefix="/tax-configurations", tags=["Tax Configurations"])


@router.get("", response_model=List[TaxConfigurationResponse])
async def list_configs(
    organisation_id: int | None = Query(default=None, alias="organisation_id"),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("TSETTINGS", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await list_tax_configurations(db, organisation_id=organisation_id)


@router.get("/active", response_model=TaxConfigurationResponse)
async def get_active_config(
    organisation_id: int = Query(..., alias="organisation_id"),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("TSETTINGS", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_active_tax_configuration(db, organisation_id=organisation_id)


@router.post("", response_model=TaxConfigurationResponse, status_code=status.HTTP_201_CREATED)
async def create_config(
    payload: TaxConfigurationCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("TSETTINGS", "create")),
    db: AsyncSession = Depends(get_db),
):
    config = await create_tax_configuration(db, payload)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AuditLogService.log_create(
        db=db,
        organisation_id=config.organisation_id,
        user_id=current_user.id,
        module_name="Settings",
        entity_name="tax_configuration",
        entity_id=config.id,
        new_value=AuditLogService.serialize_instance(config),
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return config


@router.put("/{config_id}", response_model=TaxConfigurationResponse)
async def update_config(
    config_id: int,
    payload: TaxConfigurationUpdate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("TSETTINGS", "update")),
    db: AsyncSession = Depends(get_db),
):
    existing = await get_tax_configuration(db, config_id)
    old_snapshot = AuditLogService.serialize_instance(existing)
    updated = await update_tax_configuration(db, config_id, payload)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AuditLogService.log_update(
        db=db,
        organisation_id=updated.organisation_id,
        user_id=current_user.id,
        module_name="Settings",
        entity_name="tax_configuration",
        entity_id=updated.id,
        old_value=old_snapshot,
        new_value=AuditLogService.serialize_instance(updated),
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return updated


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_config(
    config_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("TSETTINGS", "delete")),
    db: AsyncSession = Depends(get_db),
):
    existing = await get_tax_configuration(db, config_id)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AuditLogService.log_delete(
        db=db,
        organisation_id=existing.organisation_id,
        user_id=current_user.id,
        module_name="Settings",
        entity_name="tax_configuration",
        entity_id=existing.id,
        old_value=AuditLogService.serialize_instance(existing),
        ip_address=client_ip,
        user_agent=user_agent,
    )
    await delete_tax_configuration(db, config_id)
    return None
