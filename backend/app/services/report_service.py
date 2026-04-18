"""
Service layer for reports.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.tax_configuration import TaxConfiguration
from app.repositories.report_repository import (
    fetch_sales_report_items,
    fetch_sales_report_summary,
    fetch_sales_report_total,
    fetch_sales_party_report_items,
    fetch_sales_party_report_summary,
    fetch_sales_party_report_total,
    fetch_purchase_report_items,
    fetch_purchase_report_summary,
    fetch_purchase_report_total,
    fetch_purchase_party_report_items,
    fetch_purchase_party_report_summary,
    fetch_purchase_party_report_total,
    fetch_sales_tax_totals_by_date,
    fetch_gst_summary_monthly,
)
from app.services.tax_configuration_service import get_active_tax_configuration


def _normalize_invoice_type(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip().upper()
    if normalized in {"TAX", "NON_TAX"}:
        return normalized
    return None


def _normalize_tax_type(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip().upper()
    if normalized in {"CGST", "SGST", "ALL"}:
        return normalized
    return None


async def get_sales_report(
    db: AsyncSession,
    organisation_id: int,
    start_date,
    end_date,
    invoice_type: Optional[str],
    status_filter: Optional[str],
    skip: int,
    limit: int,
) -> dict:
    total = await fetch_sales_report_total(db, organisation_id, status_filter, invoice_type, start_date, end_date)
    items_raw = await fetch_sales_report_items(
        db,
        organisation_id,
        status_filter,
        invoice_type,
        start_date,
        end_date,
        skip,
        limit,
    )
    items = [dict(row._mapping) for row in items_raw]
    summary = await fetch_sales_report_summary(db, organisation_id, status_filter, invoice_type, start_date, end_date)
    return {"total": total, "items": items, "summary": summary}


async def _resolve_tax_config(db: AsyncSession, organisation_id: int) -> TaxConfiguration:
    try:
        return await get_active_tax_configuration(db, organisation_id)
    except HTTPException as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active tax configuration is required for tax-based reports",
        ) from exc


async def get_purchase_report(
    db: AsyncSession,
    organisation_id: int,
    start_date,
    end_date,
    invoice_type: Optional[str],
    supplier_name: Optional[str],
    skip: int,
    limit: int,
) -> dict:
    total = await fetch_purchase_report_total(db, organisation_id, supplier_name, start_date, end_date)
    items_raw = await fetch_purchase_report_items(
        db,
        organisation_id,
        supplier_name,
        start_date,
        end_date,
        skip,
        limit,
    )
    items = [dict(row._mapping) for row in items_raw]
    summary = await fetch_purchase_report_summary(
        db,
        organisation_id,
        supplier_name,
        start_date,
        end_date,
    )
    return {"total": total, "items": items, "summary": summary}


async def get_sales_party_report(
    db: AsyncSession,
    organisation_id: int,
    start_date,
    end_date,
    invoice_type: Optional[str],
    status_filter: Optional[str],
    party_name: Optional[str],
    skip: int,
    limit: int,
) -> dict:
    total = await fetch_sales_party_report_total(db, organisation_id, status_filter, invoice_type, start_date, end_date, party_name)
    items_raw = await fetch_sales_party_report_items(
        db,
        organisation_id,
        status_filter,
        invoice_type,
        start_date,
        end_date,
        party_name,
        skip,
        limit,
    )
    items = [dict(row._mapping) for row in items_raw]
    summary = await fetch_sales_party_report_summary(
        db,
        organisation_id,
        status_filter,
        invoice_type,
        start_date,
        end_date,
        party_name,
    )
    return {"total": total, "items": items, "summary": summary}


async def get_purchase_party_report(
    db: AsyncSession,
    organisation_id: int,
    start_date,
    end_date,
    invoice_type: Optional[str],
    party_name: Optional[str],
    skip: int,
    limit: int,
) -> dict:
    total = await fetch_purchase_party_report_total(db, organisation_id, party_name, start_date, end_date)
    items_raw = await fetch_purchase_party_report_items(
        db,
        organisation_id,
        party_name,
        start_date,
        end_date,
        skip,
        limit,
    )
    items = [dict(row._mapping) for row in items_raw]
    summary = await fetch_purchase_party_report_summary(
        db,
        organisation_id,
        party_name,
        start_date,
        end_date,
    )
    return {"total": total, "items": items, "summary": summary}


async def get_tax_report(
    db: AsyncSession,
    organisation_id: int,
    start_date,
    end_date,
    tax_type: Optional[str],
) -> dict:
    normalized_tax_type = _normalize_tax_type(tax_type) or "ALL"
    config = await _resolve_tax_config(db, organisation_id)
    date_rows = await fetch_sales_tax_totals_by_date(db, organisation_id, start_date, end_date)

    def build_item(report_date, taxable_amount: Decimal, cgst_amount: Decimal, sgst_amount: Decimal) -> dict:
        return {
            "report_date": report_date,
            "taxable_amount": taxable_amount,
            "cgst_amount": cgst_amount,
            "sgst_amount": sgst_amount,
            "total_tax_amount": cgst_amount + sgst_amount,
            "cgst_rate": Decimal(config.cgst_percentage or 0),
            "sgst_rate": Decimal(config.sgst_percentage or 0),
        }

    items: list[dict] = []
    for row in date_rows:
        row_data = dict(row._mapping)
        taxable_amount = Decimal(row_data.get("taxable_amount") or 0)
        cgst_amount = Decimal(row_data.get("cgst_amount") or 0)
        sgst_amount = Decimal(row_data.get("sgst_amount") or 0)
        if normalized_tax_type == "CGST":
            sgst_amount = Decimal("0")
        elif normalized_tax_type == "SGST":
            cgst_amount = Decimal("0")
        items.append(build_item(row_data.get("invoice_date"), taxable_amount, cgst_amount, sgst_amount))

    total_output_tax = sum(item["total_tax_amount"] for item in items)
    total_input_tax = Decimal("0")
    summary = {
        "total_output_tax": total_output_tax,
        "total_input_tax": total_input_tax,
        "net_tax_payable": total_output_tax - total_input_tax,
    }
    return {"items": items, "summary": summary}


async def get_gst_summary_monthly(
    db: AsyncSession,
    organisation_id: int,
    start_date,
    end_date,
) -> dict:
    rows = await fetch_gst_summary_monthly(db, organisation_id, start_date, end_date)
    items: list[dict] = []
    total_taxable = Decimal("0")
    total_output_tax = Decimal("0")
    for row in rows:
        row_data = dict(row._mapping)
        taxable_amount = Decimal(row_data.get("taxable_amount") or 0)
        cgst_amount = Decimal(row_data.get("cgst_amount") or 0)
        sgst_amount = Decimal(row_data.get("sgst_amount") or 0)
        igst_amount = Decimal(row_data.get("igst_amount") or 0)
        total_tax_amount = cgst_amount + sgst_amount + igst_amount
        items.append(
            {
                "report_year": int(row_data.get("report_year") or 0),
                "report_month": int(row_data.get("report_month") or 0),
                "taxable_amount": taxable_amount,
                "cgst_amount": cgst_amount,
                "sgst_amount": sgst_amount,
                "igst_amount": igst_amount,
                "total_tax_amount": total_tax_amount,
            }
        )
        total_taxable += taxable_amount
        total_output_tax += total_tax_amount
    summary = {
        "total_taxable_amount": total_taxable,
        "total_output_tax": total_output_tax,
        "total_input_tax": Decimal("0"),
        "net_tax_payable": total_output_tax,
    }
    return {"items": items, "summary": summary}
