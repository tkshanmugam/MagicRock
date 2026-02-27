"""
Sales invoice endpoints.
"""
from datetime import date
from fastapi import APIRouter, Depends, status, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.api.dependencies import get_current_active_user
from app.api.dependencies_rbac import RequirePermissionFromHeader
from app.api.schemas import (
    SalesInvoiceCreate,
    SalesInvoiceUpdate,
    SalesInvoiceResponse,
    SalesInvoiceListResponse,
    SalesInvoiceNumberResponse,
)
from app.models.user import User
from app.services.sales_invoice_service import (
    create_sales_invoice,
    list_sales_invoices,
    get_sales_invoice,
    update_sales_invoice,
    cancel_sales_invoice,
    get_next_sales_invoice_number,
)
from app.services.audit_service import AuditLogService

router = APIRouter(prefix="/sales-invoices", tags=["Sales Invoices"])


@router.post("", response_model=SalesInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_invoice(
    payload: SalesInvoiceCreate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("SALES", "create")),
    db: AsyncSession = Depends(get_db),
):
    invoice = await create_sales_invoice(db, payload, user_id=current_user.id)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AuditLogService.log_create(
        db=db,
        organisation_id=invoice.organisation_id,
        user_id=current_user.id,
        module_name="Sales",
        entity_name="sales_invoice",
        entity_id=invoice.id,
        new_value=AuditLogService.serialize_instance(invoice),
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return invoice


@router.get("", response_model=SalesInvoiceListResponse)
async def list_invoices(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    organisation_id: int | None = Query(default=None, alias="organisation_id"),
    status_filter: str | None = Query(default=None, alias="status"),
    invoice_type: str | None = Query(default=None, alias="invoice_type"),
    start_date: date | None = Query(default=None, alias="start_date"),
    end_date: date | None = Query(default=None, alias="end_date"),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("SALES", "view")),
    db: AsyncSession = Depends(get_db),
):
    total, items = await list_sales_invoices(
        db,
        skip=skip,
        limit=limit,
        organisation_id=organisation_id,
        status_filter=status_filter,
        invoice_type=invoice_type,
        start_date=start_date,
        end_date=end_date,
    )
    return SalesInvoiceListResponse(total=total, items=items)


@router.get("/next-number", response_model=SalesInvoiceNumberResponse)
async def get_next_invoice_number(
    organisation_id: int = Query(..., alias="organisation_id"),
    db: AsyncSession = Depends(get_db),
):
    invoice_number = await get_next_sales_invoice_number(db, organisation_id=organisation_id)
    return SalesInvoiceNumberResponse(invoice_number=invoice_number)


@router.get("/{invoice_id}", response_model=SalesInvoiceResponse)
async def get_invoice(
    invoice_id: int,
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("SALES", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_sales_invoice(db, invoice_id)


@router.put("/{invoice_id}", response_model=SalesInvoiceResponse)
async def update_invoice(
    invoice_id: int,
    payload: SalesInvoiceUpdate,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("SALES", "update")),
    db: AsyncSession = Depends(get_db),
):
    existing = await get_sales_invoice(db, invoice_id)
    old_snapshot = AuditLogService.serialize_instance(existing)
    updated = await update_sales_invoice(db, invoice_id, payload, user_id=current_user.id)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AuditLogService.log_update(
        db=db,
        organisation_id=updated.organisation_id,
        user_id=current_user.id,
        module_name="Sales",
        entity_name="sales_invoice",
        entity_id=updated.id,
        old_value=old_snapshot,
        new_value=AuditLogService.serialize_instance(updated),
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return updated


@router.patch("/{invoice_id}/cancel", response_model=SalesInvoiceResponse)
async def cancel_invoice(
    invoice_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("SALES", "delete")),
    db: AsyncSession = Depends(get_db),
):
    existing = await get_sales_invoice(db, invoice_id)
    old_snapshot = AuditLogService.serialize_instance(existing)
    cancelled = await cancel_sales_invoice(db, invoice_id, user_id=current_user.id)
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    await AuditLogService.log_action(
        db=db,
        organisation_id=cancelled.organisation_id,
        user_id=current_user.id,
        module_name="Sales",
        entity_name="sales_invoice",
        entity_id=cancelled.id,
        action="CANCEL",
        remarks="Status changed to CANCELLED",
        ip_address=client_ip,
        user_agent=user_agent,
    )
    await AuditLogService.log_update(
        db=db,
        organisation_id=cancelled.organisation_id,
        user_id=current_user.id,
        module_name="Sales",
        entity_name="sales_invoice",
        entity_id=cancelled.id,
        old_value=old_snapshot,
        new_value=AuditLogService.serialize_instance(cancelled),
        ip_address=client_ip,
        user_agent=user_agent,
    )
    return cancelled
