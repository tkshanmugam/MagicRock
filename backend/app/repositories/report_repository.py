"""
Repository for report queries.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Optional, Sequence

from sqlalchemy import select, func, case, literal
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sales_invoice import SalesInvoice
from app.models.purchase_voucher import PurchaseVoucher


def _normalize_invoice_type(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip().upper()
    if normalized in {"TAX", "NON_TAX"}:
        return normalized
    return None


def _normalize_status(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip().upper()
    return normalized or None


def _sales_filters(
    organisation_id: Optional[int],
    status_filter: Optional[str],
    invoice_type: Optional[str],
    start_date,
    end_date,
) -> list:
    filters = [SalesInvoice.status != "CANCELLED"]
    if organisation_id is not None:
        filters.append(SalesInvoice.organisation_id == organisation_id)
    normalized_status = _normalize_status(status_filter)
    if normalized_status:
        filters.append(SalesInvoice.status == normalized_status)
    normalized_type = _normalize_invoice_type(invoice_type)
    if normalized_type == "TAX":
        filters.append(SalesInvoice.invoice_type == "TAX")
    elif normalized_type == "NON_TAX":
        filters.append(SalesInvoice.invoice_type != "TAX")
    if start_date:
        filters.append(SalesInvoice.invoice_date >= start_date)
    if end_date:
        filters.append(SalesInvoice.invoice_date <= end_date)
    return filters


async def fetch_sales_report_items(
    db: AsyncSession,
    organisation_id: Optional[int],
    status_filter: Optional[str],
    invoice_type: Optional[str],
    start_date,
    end_date,
    skip: int,
    limit: int,
) -> Sequence:
    filters = _sales_filters(organisation_id, status_filter, invoice_type, start_date, end_date)
    tax_amount = case(
        (SalesInvoice.invoice_type == "TAX", SalesInvoice.cgst_amount + SalesInvoice.sgst_amount + SalesInvoice.igst_amount),
        else_=literal(0),
    )
    report_invoice_type = case(
        (SalesInvoice.invoice_type == "TAX", literal("TAX")),
        else_=literal("NON_TAX"),
    )
    query = (
        select(
            SalesInvoice.invoice_date.label("invoice_date"),
            SalesInvoice.invoice_number.label("invoice_number"),
            report_invoice_type.label("invoice_type"),
            SalesInvoice.taxable_value.label("subtotal"),
            tax_amount.label("tax_amount"),
            SalesInvoice.round_off.label("round_off"),
            SalesInvoice.invoice_total.label("invoice_total"),
            SalesInvoice.customer_name.label("customer_name"),
        )
        .where(*filters)
        .order_by(SalesInvoice.invoice_date.desc(), SalesInvoice.invoice_number.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    return result.all()


async def fetch_sales_report_summary(
    db: AsyncSession,
    organisation_id: Optional[int],
    status_filter: Optional[str],
    invoice_type: Optional[str],
    start_date,
    end_date,
) -> dict:
    filters = _sales_filters(organisation_id, status_filter, invoice_type, start_date, end_date)
    taxable_sales = case((SalesInvoice.invoice_type == "TAX", SalesInvoice.taxable_value), else_=literal(0))
    non_tax_sales = case((SalesInvoice.invoice_type != "TAX", SalesInvoice.taxable_value), else_=literal(0))
    tax_amount = case(
        (SalesInvoice.invoice_type == "TAX", SalesInvoice.cgst_amount + SalesInvoice.sgst_amount + SalesInvoice.igst_amount),
        else_=literal(0),
    )
    query = select(
        func.coalesce(func.sum(taxable_sales), 0).label("total_taxable_sales"),
        func.coalesce(func.sum(non_tax_sales), 0).label("total_non_tax_sales"),
        func.coalesce(func.sum(tax_amount), 0).label("total_tax_collected"),
        func.coalesce(func.sum(SalesInvoice.invoice_total), 0).label("net_sales_value"),
    ).where(*filters)
    result = await db.execute(query)
    row = result.one()
    return dict(row._mapping)


async def fetch_sales_report_total(
    db: AsyncSession,
    organisation_id: Optional[int],
    status_filter: Optional[str],
    invoice_type: Optional[str],
    start_date,
    end_date,
) -> int:
    filters = _sales_filters(organisation_id, status_filter, invoice_type, start_date, end_date)
    result = await db.execute(select(func.count(SalesInvoice.id)).where(*filters))
    return int(result.scalar_one() or 0)


async def fetch_sales_party_report_items(
    db: AsyncSession,
    organisation_id: Optional[int],
    status_filter: Optional[str],
    invoice_type: Optional[str],
    start_date,
    end_date,
    party_name: Optional[str],
    skip: int,
    limit: int,
) -> Sequence:
    filters = _sales_filters(organisation_id, status_filter, invoice_type, start_date, end_date)
    if party_name:
        filters.append(SalesInvoice.customer_name.ilike(f"%{party_name.strip()}%"))
    tax_amount = case(
        (SalesInvoice.invoice_type == "TAX", SalesInvoice.cgst_amount + SalesInvoice.sgst_amount + SalesInvoice.igst_amount),
        else_=literal(0),
    )
    query = (
        select(
            SalesInvoice.customer_name.label("party_name"),
            func.count(SalesInvoice.id).label("invoice_count"),
            func.coalesce(func.sum(SalesInvoice.taxable_value), 0).label("taxable_amount"),
            func.coalesce(func.sum(tax_amount), 0).label("tax_amount"),
            func.coalesce(func.sum(SalesInvoice.invoice_total), 0).label("invoice_total"),
        )
        .where(*filters)
        .group_by(SalesInvoice.customer_name)
        .order_by(func.sum(SalesInvoice.invoice_total).desc(), SalesInvoice.customer_name.asc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    return result.all()


async def fetch_sales_party_report_total(
    db: AsyncSession,
    organisation_id: Optional[int],
    status_filter: Optional[str],
    invoice_type: Optional[str],
    start_date,
    end_date,
    party_name: Optional[str],
) -> int:
    filters = _sales_filters(organisation_id, status_filter, invoice_type, start_date, end_date)
    if party_name:
        filters.append(SalesInvoice.customer_name.ilike(f"%{party_name.strip()}%"))
    result = await db.execute(select(func.count(func.distinct(SalesInvoice.customer_name))).where(*filters))
    return int(result.scalar_one() or 0)


async def fetch_sales_party_report_summary(
    db: AsyncSession,
    organisation_id: Optional[int],
    status_filter: Optional[str],
    invoice_type: Optional[str],
    start_date,
    end_date,
    party_name: Optional[str],
) -> dict:
    filters = _sales_filters(organisation_id, status_filter, invoice_type, start_date, end_date)
    if party_name:
        filters.append(SalesInvoice.customer_name.ilike(f"%{party_name.strip()}%"))
    tax_amount = case(
        (SalesInvoice.invoice_type == "TAX", SalesInvoice.cgst_amount + SalesInvoice.sgst_amount + SalesInvoice.igst_amount),
        else_=literal(0),
    )
    query = select(
        func.coalesce(func.sum(SalesInvoice.taxable_value), 0).label("total_taxable_amount"),
        func.coalesce(func.sum(tax_amount), 0).label("total_tax_amount"),
        func.coalesce(func.sum(SalesInvoice.invoice_total), 0).label("total_invoice_amount"),
    ).where(*filters)
    result = await db.execute(query)
    row = result.one()
    return dict(row._mapping)


def _purchase_filters(
    organisation_id: Optional[int],
    supplier_name: Optional[str],
    start_date,
    end_date,
) -> list:
    filters = []
    if organisation_id is not None:
        filters.append(PurchaseVoucher.organisation_id == organisation_id)
    if supplier_name:
        filters.append(PurchaseVoucher.supplier_name.ilike(f"%{supplier_name.strip()}%"))
    if start_date:
        filters.append(PurchaseVoucher.voucher_date >= start_date)
    if end_date:
        filters.append(PurchaseVoucher.voucher_date <= end_date)
    return filters


async def fetch_purchase_report_items(
    db: AsyncSession,
    organisation_id: Optional[int],
    supplier_name: Optional[str],
    start_date,
    end_date,
    skip: int,
    limit: int,
) -> Sequence:
    filters = _purchase_filters(organisation_id, supplier_name, start_date, end_date)
    subtotal = func.coalesce(PurchaseVoucher.total_amount, 0)
    tax_amount = literal(0)
    invoice_total = subtotal
    query = (
        select(
            PurchaseVoucher.voucher_date.label("purchase_date"),
            PurchaseVoucher.voucher_no.label("purchase_invoice_number"),
            PurchaseVoucher.supplier_name.label("supplier_name"),
            subtotal.label("subtotal"),
            tax_amount.label("tax_amount"),
            invoice_total.label("invoice_total"),
        )
        .where(*filters)
        .order_by(PurchaseVoucher.voucher_date.desc(), PurchaseVoucher.voucher_no.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    return result.all()


async def fetch_purchase_report_summary(
    db: AsyncSession,
    organisation_id: Optional[int],
    supplier_name: Optional[str],
    start_date,
    end_date,
) -> dict:
    filters = _purchase_filters(organisation_id, supplier_name, start_date, end_date)
    subtotal = func.coalesce(PurchaseVoucher.total_amount, 0)
    tax_amount = literal(0)
    query = select(
        func.coalesce(func.sum(subtotal), 0).label("total_purchase_value"),
        func.coalesce(func.sum(tax_amount), 0).label("total_input_tax"),
        func.coalesce(func.sum(subtotal), 0).label("net_purchase_amount"),
    ).where(*filters)
    result = await db.execute(query)
    row = result.one()
    return dict(row._mapping)


async def fetch_purchase_report_total(
    db: AsyncSession,
    organisation_id: Optional[int],
    supplier_name: Optional[str],
    start_date,
    end_date,
) -> int:
    filters = _purchase_filters(organisation_id, supplier_name, start_date, end_date)
    result = await db.execute(select(func.count(PurchaseVoucher.id)).where(*filters))
    return int(result.scalar_one() or 0)


async def fetch_purchase_party_report_items(
    db: AsyncSession,
    organisation_id: Optional[int],
    supplier_name: Optional[str],
    start_date,
    end_date,
    skip: int,
    limit: int,
) -> Sequence:
    filters = _purchase_filters(organisation_id, supplier_name, start_date, end_date)
    subtotal_sum = func.coalesce(func.sum(PurchaseVoucher.total_amount), 0)
    tax_amount = literal(0)
    invoice_total = subtotal_sum
    query = (
        select(
            PurchaseVoucher.supplier_name.label("party_name"),
            func.count(PurchaseVoucher.id).label("invoice_count"),
            subtotal_sum.label("subtotal"),
            tax_amount.label("tax_amount"),
            invoice_total.label("invoice_total"),
        )
        .where(*filters)
        .group_by(PurchaseVoucher.supplier_name)
        .order_by(subtotal_sum.desc(), PurchaseVoucher.supplier_name.asc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    return result.all()


async def fetch_purchase_party_report_total(
    db: AsyncSession,
    organisation_id: Optional[int],
    supplier_name: Optional[str],
    start_date,
    end_date,
) -> int:
    filters = _purchase_filters(organisation_id, supplier_name, start_date, end_date)
    result = await db.execute(select(func.count(func.distinct(PurchaseVoucher.supplier_name))).where(*filters))
    return int(result.scalar_one() or 0)


async def fetch_purchase_party_report_summary(
    db: AsyncSession,
    organisation_id: Optional[int],
    supplier_name: Optional[str],
    start_date,
    end_date,
) -> dict:
    filters = _purchase_filters(organisation_id, supplier_name, start_date, end_date)
    subtotal_sum = func.coalesce(func.sum(PurchaseVoucher.total_amount), 0)
    tax_amount = literal(0)
    query = select(
        subtotal_sum.label("total_purchase_value"),
        tax_amount.label("total_input_tax"),
        subtotal_sum.label("net_purchase_amount"),
    ).where(*filters)
    result = await db.execute(query)
    row = result.one()
    return dict(row._mapping)


async def fetch_sales_tax_totals(
    db: AsyncSession,
    organisation_id: Optional[int],
    start_date,
    end_date,
) -> dict:
    filters = _sales_filters(organisation_id, None, None, start_date, end_date)
    query = select(
        func.coalesce(func.sum(case((SalesInvoice.invoice_type == "TAX", SalesInvoice.taxable_value), else_=literal(0))), 0).label(
            "taxable_amount"
        ),
        func.coalesce(func.sum(SalesInvoice.cgst_amount), 0).label("cgst_amount"),
        func.coalesce(func.sum(SalesInvoice.sgst_amount), 0).label("sgst_amount"),
        func.coalesce(func.sum(SalesInvoice.igst_amount), 0).label("igst_amount"),
    ).where(*filters)
    result = await db.execute(query)
    row = result.one()
    return dict(row._mapping)


async def fetch_sales_tax_totals_by_date(
    db: AsyncSession,
    organisation_id: Optional[int],
    start_date,
    end_date,
) -> Sequence:
    filters = _sales_filters(organisation_id, None, None, start_date, end_date)
    query = (
        select(
            SalesInvoice.invoice_date.label("invoice_date"),
            func.coalesce(
                func.sum(case((SalesInvoice.invoice_type == "TAX", SalesInvoice.taxable_value), else_=literal(0))), 0
            ).label("taxable_amount"),
            func.coalesce(func.sum(SalesInvoice.cgst_amount), 0).label("cgst_amount"),
            func.coalesce(func.sum(SalesInvoice.sgst_amount), 0).label("sgst_amount"),
        )
        .where(*filters)
        .group_by(SalesInvoice.invoice_date)
        .order_by(SalesInvoice.invoice_date.asc())
    )
    result = await db.execute(query)
    return result.all()


async def fetch_gst_summary_monthly(
    db: AsyncSession,
    organisation_id: Optional[int],
    start_date,
    end_date,
) -> Sequence:
    filters = _sales_filters(organisation_id, None, "TAX", start_date, end_date)
    report_year = func.extract("year", SalesInvoice.invoice_date).label("report_year")
    report_month = func.extract("month", SalesInvoice.invoice_date).label("report_month")
    query = (
        select(
            report_year,
            report_month,
            func.coalesce(func.sum(SalesInvoice.taxable_value), 0).label("taxable_amount"),
            func.coalesce(func.sum(SalesInvoice.cgst_amount), 0).label("cgst_amount"),
            func.coalesce(func.sum(SalesInvoice.sgst_amount), 0).label("sgst_amount"),
            func.coalesce(func.sum(SalesInvoice.igst_amount), 0).label("igst_amount"),
        )
        .where(*filters)
        .group_by(report_year, report_month)
        .order_by(report_year.asc(), report_month.asc())
    )
    result = await db.execute(query)
    return result.all()
