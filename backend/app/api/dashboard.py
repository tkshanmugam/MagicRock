"""
Dashboard endpoints.
"""
from datetime import date
from fastapi import APIRouter, Depends, Query, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_active_user
from app.api.dependencies_rbac import RequirePermissionFromHeader
from app.api.schemas import (
    DashboardSummaryResponse,
    DashboardSalesTrendsResponse,
    DashboardTaxSummaryResponse,
)
from app.db.session import get_db
from app.services.dashboard_service import (
    get_dashboard_summary,
    get_dashboard_sales_trends,
    get_dashboard_tax_summary,
)

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
async def dashboard_summary(
    range_key: str = Query("month", alias="range"),
    start_date: date | None = Query(default=None, alias="start_date"),
    end_date: date | None = Query(default=None, alias="end_date"),
    organisation_id: int | None = Header(default=None, alias="X-Organization-Id"),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("DASHBOARD", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_dashboard_summary(
        db=db,
        organisation_id=organisation_id,
        range_key=range_key,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/sales-trends", response_model=DashboardSalesTrendsResponse)
async def dashboard_sales_trends(
    range_key: str = Query("month", alias="range"),
    start_date: date | None = Query(default=None, alias="start_date"),
    end_date: date | None = Query(default=None, alias="end_date"),
    organisation_id: int | None = Header(default=None, alias="X-Organization-Id"),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("DASHBOARD", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_dashboard_sales_trends(
        db=db,
        organisation_id=organisation_id,
        range_key=range_key,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/tax-summary", response_model=DashboardTaxSummaryResponse)
async def dashboard_tax_summary(
    range_key: str = Query("month", alias="range"),
    start_date: date | None = Query(default=None, alias="start_date"),
    end_date: date | None = Query(default=None, alias="end_date"),
    organisation_id: int | None = Header(default=None, alias="X-Organization-Id"),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("DASHBOARD", "view")),
    db: AsyncSession = Depends(get_db),
):
    return await get_dashboard_tax_summary(
        db=db,
        organisation_id=organisation_id,
        range_key=range_key,
        start_date=start_date,
        end_date=end_date,
    )
