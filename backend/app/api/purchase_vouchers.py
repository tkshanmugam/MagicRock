"""
Purchase voucher endpoints.
"""
from fastapi import APIRouter, Depends, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.api.dependencies import get_current_active_user
from app.models.user import User
from app.api.dependencies_rbac import RequirePermissionFromHeader
from app.api.schemas import (
    PurchaseVoucherCreate,
    PurchaseVoucherUpdate,
    PurchaseVoucherResponse,
    PurchaseVoucherListResponse,
)
from app.services.purchase_voucher_service import (
    create_purchase_voucher,
    list_purchase_vouchers,
    get_purchase_voucher,
    get_next_voucher_number,
    update_purchase_voucher,
    cancel_purchase_voucher,
)
from app.services.audit_service import AuditLogService

router = APIRouter(prefix="/purchase-vouchers", tags=["Purchase Vouchers"])


@router.post("", response_model=PurchaseVoucherResponse, status_code=status.HTTP_201_CREATED)
async def create_voucher(
    payload: PurchaseVoucherCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("PURCHASE", "create")),
    db: AsyncSession = Depends(get_db),
):
    voucher = await create_purchase_voucher(db, payload)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AuditLogService.log_create(
        db=db,
        organisation_id=voucher.organisation_id,
        user_id=current_user.id,
        module_name="Purchase",
        entity_name="purchase_voucher",
        entity_id=voucher.id,
        new_value=AuditLogService.serialize_instance(voucher),
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return voucher


@router.get("", response_model=PurchaseVoucherListResponse)
async def list_vouchers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    organisation_id: int | None = Query(default=None, alias="organisation_id"),
    include_cancelled: bool = Query(False, alias="include_cancelled"),
    search: str | None = Query(default=None, alias="search"),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("PURCHASE", "view")),
    db: AsyncSession = Depends(get_db),
):
    total, items = await list_purchase_vouchers(
        db,
        skip=skip,
        limit=limit,
        organisation_id=organisation_id,
        include_cancelled=include_cancelled,
        search=search,
    )
    return PurchaseVoucherListResponse(total=total, items=items)


@router.get("/next-number")
async def next_voucher_number(
    organisation_id: int | None = Query(default=None, alias="organisation_id"),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("PURCHASE", "view")),
    db: AsyncSession = Depends(get_db),
):
    return {"voucher_no": await get_next_voucher_number(db, organisation_id=organisation_id)}


@router.get("/{voucher_id}", response_model=PurchaseVoucherResponse)
async def get_voucher(
    voucher_id: int,
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("PURCHASE", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_purchase_voucher(db, voucher_id)


@router.put("/{voucher_id}", response_model=PurchaseVoucherResponse)
async def update_voucher(
    voucher_id: int,
    payload: PurchaseVoucherUpdate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("PURCHASE", "update")),
    db: AsyncSession = Depends(get_db),
):
    existing = await get_purchase_voucher(db, voucher_id)
    old_snapshot = AuditLogService.serialize_instance(existing)
    updated = await update_purchase_voucher(db, voucher_id, payload)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AuditLogService.log_update(
        db=db,
        organisation_id=updated.organisation_id,
        user_id=current_user.id,
        module_name="Purchase",
        entity_name="purchase_voucher",
        entity_id=updated.id,
        old_value=old_snapshot,
        new_value=AuditLogService.serialize_instance(updated),
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return updated


@router.post("/{voucher_id}/cancel", response_model=PurchaseVoucherResponse)
async def cancel_voucher(
    voucher_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("PURCHASE", "update")),
    db: AsyncSession = Depends(get_db),
):
    existing = await get_purchase_voucher(db, voucher_id)
    old_snapshot = AuditLogService.serialize_instance(existing)
    cancelled = await cancel_purchase_voucher(db, voucher_id)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AuditLogService.log_update(
        db=db,
        organisation_id=cancelled.organisation_id,
        user_id=current_user.id,
        module_name="Purchase",
        entity_name="purchase_voucher",
        entity_id=cancelled.id,
        old_value=old_snapshot,
        new_value=AuditLogService.serialize_instance(cancelled),
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return cancelled
