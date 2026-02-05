"""
Repository queries for dashboard metrics.
"""
from __future__ import annotations

from typing import Optional, Sequence

from sqlalchemy import select, func, case, literal
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.sales_invoice import SalesInvoice, SalesInvoiceItem
from app.models.purchase_voucher import PurchaseVoucher


def _sales_filters(
    organisation_id: Optional[int],
    start_date,
    end_date,
) -> list:
    filters = [SalesInvoice.status != "CANCELLED"]
    if organisation_id is not None:
        filters.append(SalesInvoice.organisation_id == organisation_id)
    if start_date:
        filters.append(SalesInvoice.invoice_date >= start_date)
    if end_date:
        filters.append(SalesInvoice.invoice_date <= end_date)
    return filters


def _purchase_filters(
    organisation_id: Optional[int],
    start_date,
    end_date,
) -> list:
    filters = [PurchaseVoucher.voucher_date.isnot(None)]
    if organisation_id is not None:
        filters.append(PurchaseVoucher.organisation_id == organisation_id)
    if start_date:
        filters.append(PurchaseVoucher.voucher_date >= start_date)
    if end_date:
        filters.append(PurchaseVoucher.voucher_date <= end_date)
    return filters


async def fetch_sales_aggregate(
    db: AsyncSession,
    organisation_id: Optional[int],
    start_date,
    end_date,
) -> dict:
    filters = _sales_filters(organisation_id, start_date, end_date)
    tax_amount = case(
        (SalesInvoice.invoice_type == "TAX", SalesInvoice.cgst_amount + SalesInvoice.sgst_amount + SalesInvoice.igst_amount),
        else_=literal(0),
    )
    query = select(
        func.coalesce(func.sum(SalesInvoice.invoice_total), 0).label("total_sales"),
        func.coalesce(func.sum(tax_amount), 0).label("total_tax"),
        func.coalesce(func.count(SalesInvoice.id), 0).label("invoice_count"),
    ).where(*filters)
    result = await db.execute(query)
    row = result.one()
    return dict(row._mapping)


async def fetch_purchase_aggregate(
    db: AsyncSession,
    organisation_id: Optional[int],
    start_date,
    end_date,
) -> dict:
    filters = _purchase_filters(organisation_id, start_date, end_date)
    query = select(
        func.coalesce(func.sum(PurchaseVoucher.total_amount), 0).label("total_purchases"),
        func.coalesce(func.count(PurchaseVoucher.id), 0).label("invoice_count"),
    ).where(*filters)
    result = await db.execute(query)
    row = result.one()
    return dict(row._mapping)


async def fetch_sales_tax_summary(
    db: AsyncSession,
    organisation_id: Optional[int],
    start_date,
    end_date,
) -> dict:
    filters = _sales_filters(organisation_id, start_date, end_date)
    filters.append(SalesInvoice.invoice_type == "TAX")
    query = select(
        func.coalesce(func.sum(SalesInvoice.cgst_amount), 0).label("cgst"),
        func.coalesce(func.sum(SalesInvoice.sgst_amount), 0).label("sgst"),
        func.coalesce(func.sum(SalesInvoice.igst_amount), 0).label("igst"),
    ).where(*filters)
    result = await db.execute(query)
    row = result.one()
    return dict(row._mapping)


async def fetch_top_customers(
    db: AsyncSession,
    organisation_id: Optional[int],
    start_date,
    end_date,
    limit: int = 5,
) -> Sequence:
    filters = _sales_filters(organisation_id, start_date, end_date)
    query = (
        select(
            SalesInvoice.customer_name.label("name"),
            func.coalesce(func.sum(SalesInvoice.invoice_total), 0).label("total_value"),
            func.count(SalesInvoice.id).label("invoice_count"),
        )
        .where(*filters)
        .group_by(SalesInvoice.customer_name)
        .order_by(func.sum(SalesInvoice.invoice_total).desc())
        .limit(limit)
    )
    result = await db.execute(query)
    return result.all()


async def fetch_top_products(
    db: AsyncSession,
    organisation_id: Optional[int],
    start_date,
    end_date,
    limit: int = 5,
) -> Sequence:
    filters = _sales_filters(organisation_id, start_date, end_date)
    query = (
        select(
            SalesInvoiceItem.item_name.label("name"),
            func.coalesce(func.sum(SalesInvoiceItem.quantity), 0).label("quantity"),
            func.coalesce(func.sum(SalesInvoiceItem.total_amount), 0).label("total_value"),
        )
        .join(SalesInvoice, SalesInvoice.id == SalesInvoiceItem.sales_invoice_id)
        .where(*filters)
        .group_by(SalesInvoiceItem.item_name)
        .order_by(func.sum(SalesInvoiceItem.total_amount).desc())
        .limit(limit)
    )
    result = await db.execute(query)
    return result.all()


async def fetch_sales_trends(
    db: AsyncSession,
    organisation_id: Optional[int],
    start_date,
    end_date,
) -> Sequence:
    filters = _sales_filters(organisation_id, start_date, end_date)
    query = (
        select(
            SalesInvoice.invoice_date.label("date"),
            func.coalesce(func.sum(SalesInvoice.invoice_total), 0).label("total"),
        )
        .where(*filters)
        .group_by(SalesInvoice.invoice_date)
        .order_by(SalesInvoice.invoice_date.asc())
    )
    result = await db.execute(query)
    return result.all()


async def fetch_purchase_trends(
    db: AsyncSession,
    organisation_id: Optional[int],
    start_date,
    end_date,
) -> Sequence:
    filters = _purchase_filters(organisation_id, start_date, end_date)
    query = (
        select(
            PurchaseVoucher.voucher_date.label("date"),
            func.coalesce(func.sum(PurchaseVoucher.total_amount), 0).label("total"),
        )
        .where(*filters)
        .group_by(PurchaseVoucher.voucher_date)
        .order_by(PurchaseVoucher.voucher_date.asc())
    )
    result = await db.execute(query)
    return result.all()


async def fetch_outstanding_sales_total(
    db: AsyncSession,
    organisation_id: Optional[int],
) -> dict:
    filters = _sales_filters(organisation_id, None, None)
    query = select(
        func.coalesce(func.sum(SalesInvoice.invoice_total), 0).label("total_receivables")
    ).where(*filters)
    result = await db.execute(query)
    row = result.one()
    return dict(row._mapping)


async def fetch_outstanding_purchase_total(
    db: AsyncSession,
    organisation_id: Optional[int],
) -> dict:
    filters = _purchase_filters(organisation_id, None, None)
    query = select(
        func.coalesce(func.sum(PurchaseVoucher.total_amount), 0).label("total_payables")
    ).where(*filters)
    result = await db.execute(query)
    row = result.one()
    return dict(row._mapping)
