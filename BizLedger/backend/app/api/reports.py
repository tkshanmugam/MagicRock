"""
Report endpoints.
"""
from datetime import date
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_active_user
from app.api.dependencies_rbac import RequirePermissionFromHeader
from app.api.schemas import (
    SalesReportResponse,
    PurchaseReportResponse,
    TaxReportResponse,
    GstSummaryMonthlyResponse,
    SalesPartyReportResponse,
    PurchasePartyReportResponse,
)
from app.db.session import get_db
from app.services.report_service import (
    get_sales_report,
    get_purchase_report,
    get_tax_report,
    get_gst_summary_monthly,
    get_sales_party_report,
    get_purchase_party_report,
)

router = APIRouter(prefix="/reports", tags=["Reports"])


@router.get("/sales", response_model=SalesReportResponse)
async def sales_report(
    organisation_id: int = Query(..., alias="organisation_id"),
    start_date: date | None = Query(default=None, alias="from_date"),
    end_date: date | None = Query(default=None, alias="to_date"),
    invoice_type: str | None = Query(default=None, alias="invoice_type"),
    status_filter: str | None = Query(default=None, alias="status"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=2000),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("REPORTS", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_sales_report(
        db,
        organisation_id=organisation_id,
        start_date=start_date,
        end_date=end_date,
        invoice_type=invoice_type,
        status_filter=status_filter,
        skip=skip,
        limit=limit,
    )


@router.get("/purchase", response_model=PurchaseReportResponse)
async def purchase_report(
    organisation_id: int = Query(..., alias="organisation_id"),
    start_date: date | None = Query(default=None, alias="from_date"),
    end_date: date | None = Query(default=None, alias="to_date"),
    invoice_type: str | None = Query(default=None, alias="invoice_type"),
    supplier_name: str | None = Query(default=None, alias="supplier"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=2000),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("REPORTS", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_purchase_report(
        db,
        organisation_id=organisation_id,
        start_date=start_date,
        end_date=end_date,
        invoice_type=invoice_type,
        supplier_name=supplier_name,
        skip=skip,
        limit=limit,
    )


@router.get("/tax", response_model=TaxReportResponse)
async def tax_report(
    organisation_id: int = Query(..., alias="organisation_id"),
    start_date: date | None = Query(default=None, alias="from_date"),
    end_date: date | None = Query(default=None, alias="to_date"),
    tax_type: str | None = Query(default=None, alias="tax_type"),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("REPORTS", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_tax_report(
        db,
        organisation_id=organisation_id,
        start_date=start_date,
        end_date=end_date,
        tax_type=tax_type,
    )


@router.get("/gst-summary-monthly", response_model=GstSummaryMonthlyResponse)
async def gst_summary_monthly_report(
    organisation_id: int = Query(..., alias="organisation_id"),
    start_date: date | None = Query(default=None, alias="from_date"),
    end_date: date | None = Query(default=None, alias="to_date"),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("REPORTS", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_gst_summary_monthly(
        db,
        organisation_id=organisation_id,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/sales-party", response_model=SalesPartyReportResponse)
async def sales_party_report(
    organisation_id: int = Query(..., alias="organisation_id"),
    start_date: date | None = Query(default=None, alias="from_date"),
    end_date: date | None = Query(default=None, alias="to_date"),
    invoice_type: str | None = Query(default=None, alias="invoice_type"),
    status_filter: str | None = Query(default=None, alias="status"),
    party_name: str | None = Query(default=None, alias="party"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=2000),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("REPORTS", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_sales_party_report(
        db,
        organisation_id=organisation_id,
        start_date=start_date,
        end_date=end_date,
        invoice_type=invoice_type,
        status_filter=status_filter,
        party_name=party_name,
        skip=skip,
        limit=limit,
    )


@router.get("/purchase-party", response_model=PurchasePartyReportResponse)
async def purchase_party_report(
    organisation_id: int = Query(..., alias="organisation_id"),
    start_date: date | None = Query(default=None, alias="from_date"),
    end_date: date | None = Query(default=None, alias="to_date"),
    invoice_type: str | None = Query(default=None, alias="invoice_type"),
    party_name: str | None = Query(default=None, alias="party"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=2000),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("REPORTS", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_purchase_party_report(
        db,
        organisation_id=organisation_id,
        start_date=start_date,
        end_date=end_date,
        invoice_type=invoice_type,
        party_name=party_name,
        skip=skip,
        limit=limit,
    )
