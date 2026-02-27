"""
Service layer for dashboard metrics.
"""
from __future__ import annotations

from datetime import date
from typing import Optional, Tuple
import time

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.dashboard_repository import (
    fetch_sales_aggregate,
    fetch_purchase_aggregate,
    fetch_sales_tax_summary,
    fetch_top_customers,
    fetch_top_products,
    fetch_sales_trends,
    fetch_purchase_trends,
    fetch_outstanding_sales_total,
    fetch_outstanding_purchase_total,
)


_CACHE_TTL_SECONDS = 60
_CACHE: dict[tuple, tuple[float, dict]] = {}


def _get_cached(key: tuple) -> Optional[dict]:
    cached = _CACHE.get(key)
    if not cached:
        return None
    expires_at, payload = cached
    if time.time() > expires_at:
        _CACHE.pop(key, None)
        return None
    return payload


def _set_cached(key: tuple, payload: dict) -> None:
    _CACHE[key] = (time.time() + _CACHE_TTL_SECONDS, payload)


def _resolve_range(
    range_key: str,
    start_date: Optional[date],
    end_date: Optional[date],
) -> Tuple[date, date]:
    today = date.today()
    normalized = (range_key or "month").strip().lower()
    if normalized == "today":
        return today, today
    if normalized == "month":
        return today.replace(day=1), today
    if normalized == "custom":
        if not start_date or not end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="start_date and end_date are required for custom range",
            )
        return start_date, end_date
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Invalid range. Use today, month, or custom",
    )


async def get_dashboard_summary(
    db: AsyncSession,
    organisation_id: Optional[int],
    range_key: str,
    start_date: Optional[date],
    end_date: Optional[date],
) -> dict:
    range_start, range_end = _resolve_range(range_key, start_date, end_date)
    cache_key = ("summary", organisation_id, range_key, range_start, range_end)
    cached = _get_cached(cache_key)
    if cached:
        return cached

    today = date.today()
    month_start = today.replace(day=1)

    sales_today = await fetch_sales_aggregate(db, organisation_id, today, today)
    sales_month = await fetch_sales_aggregate(db, organisation_id, month_start, today)
    sales_range = await fetch_sales_aggregate(db, organisation_id, range_start, range_end)

    purchase_today = await fetch_purchase_aggregate(db, organisation_id, today, today)
    purchase_month = await fetch_purchase_aggregate(db, organisation_id, month_start, today)
    purchase_range = await fetch_purchase_aggregate(db, organisation_id, range_start, range_end)

    tax_today = await fetch_sales_tax_summary(db, organisation_id, today, today)
    tax_month = await fetch_sales_tax_summary(db, organisation_id, month_start, today)
    tax_range = await fetch_sales_tax_summary(db, organisation_id, range_start, range_end)

    receivables = await fetch_outstanding_sales_total(db, organisation_id)
    payables = await fetch_outstanding_purchase_total(db, organisation_id)

    top_customers_rows = await fetch_top_customers(db, organisation_id, range_start, range_end)
    top_products_rows = await fetch_top_products(db, organisation_id, range_start, range_end)

    payload = {
        "range": {
            "mode": range_key,
            "start_date": range_start,
            "end_date": range_end,
        },
        "kpis": {
            "sales": {
                "today": sales_today["total_sales"],
                "month": sales_month["total_sales"],
                "range": sales_range["total_sales"],
            },
            "purchases": {
                "today": purchase_today["total_purchases"],
                "month": purchase_month["total_purchases"],
                "range": purchase_range["total_purchases"],
            },
            "net_revenue": {
                "today": sales_today["total_sales"] - purchase_today["total_purchases"] - tax_today["cgst"] - tax_today["sgst"] - tax_today["igst"],
                "month": sales_month["total_sales"] - purchase_month["total_purchases"] - tax_month["cgst"] - tax_month["sgst"] - tax_month["igst"],
                "range": sales_range["total_sales"] - purchase_range["total_purchases"] - tax_range["cgst"] - tax_range["sgst"] - tax_range["igst"],
            },
            "tax": {
                "today": tax_today["cgst"] + tax_today["sgst"] + tax_today["igst"],
                "month": tax_month["cgst"] + tax_month["sgst"] + tax_month["igst"],
                "range": tax_range["cgst"] + tax_range["sgst"] + tax_range["igst"],
            },
            "receivables": receivables["total_receivables"],
            "payables": payables["total_payables"],
            "invoice_counts": {
                "sales": sales_range["invoice_count"],
                "purchases": purchase_range["invoice_count"],
            },
        },
        "top_customers": [
            {
                "name": row.name,
                "total_value": row.total_value,
                "invoice_count": row.invoice_count,
            }
            for row in top_customers_rows
        ],
        "top_products": [
            {
                "name": row.name,
                "quantity": row.quantity,
                "total_value": row.total_value,
            }
            for row in top_products_rows
        ],
    }

    _set_cached(cache_key, payload)
    return payload


async def get_dashboard_sales_trends(
    db: AsyncSession,
    organisation_id: Optional[int],
    range_key: str,
    start_date: Optional[date],
    end_date: Optional[date],
) -> dict:
    range_start, range_end = _resolve_range(range_key, start_date, end_date)
    cache_key = ("trends", organisation_id, range_key, range_start, range_end)
    cached = _get_cached(cache_key)
    if cached:
        return cached

    sales_rows = await fetch_sales_trends(db, organisation_id, range_start, range_end)
    purchase_rows = await fetch_purchase_trends(db, organisation_id, range_start, range_end)

    series_map: dict[date, dict] = {}
    for row in sales_rows:
        series_map.setdefault(row.date, {"date": row.date, "sales": 0, "purchases": 0})
        series_map[row.date]["sales"] = row.total
    for row in purchase_rows:
        series_map.setdefault(row.date, {"date": row.date, "sales": 0, "purchases": 0})
        series_map[row.date]["purchases"] = row.total

    data = [series_map[key] for key in sorted(series_map.keys())]
    payload = {
        "range": {
            "mode": range_key,
            "start_date": range_start,
            "end_date": range_end,
        },
        "data": data,
    }
    _set_cached(cache_key, payload)
    return payload


async def get_dashboard_tax_summary(
    db: AsyncSession,
    organisation_id: Optional[int],
    range_key: str,
    start_date: Optional[date],
    end_date: Optional[date],
) -> dict:
    range_start, range_end = _resolve_range(range_key, start_date, end_date)
    cache_key = ("tax", organisation_id, range_key, range_start, range_end)
    cached = _get_cached(cache_key)
    if cached:
        return cached

    tax = await fetch_sales_tax_summary(db, organisation_id, range_start, range_end)
    payload = {
        "range": {
            "mode": range_key,
            "start_date": range_start,
            "end_date": range_end,
        },
        "cgst": tax["cgst"],
        "sgst": tax["sgst"],
        "igst": tax["igst"],
        "total": tax["cgst"] + tax["sgst"] + tax["igst"],
    }
    _set_cached(cache_key, payload)
    return payload
