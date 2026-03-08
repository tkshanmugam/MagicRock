"""
Service for sales invoice operations.
"""
from decimal import Decimal
from typing import List, Optional
from datetime import date
from sqlalchemy import select, func, cast, Integer, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from app.models.sales_invoice import SalesInvoice, SalesInvoiceItem
from app.models.tax_configuration import TaxConfiguration
from app.api.schemas import SalesInvoiceCreate, SalesInvoiceUpdate, SalesInvoiceItemCreate
from app.services.number_to_words import amount_to_words


ALLOWED_INVOICE_TYPES = {"TAX", "BILL_OF_SUPPLY", "EXPORT"}


def _safe_decimal(value: Optional[Decimal]) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _normalize_invoice_type(value: Optional[str]) -> str:
    invoice_type = (value or "TAX").strip().upper()
    if invoice_type not in ALLOWED_INVOICE_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid invoice type")
    return invoice_type


def _validate_items(items: List[SalesInvoiceItemCreate]) -> None:
    if not items:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one item is required")
    for item in items:
        if item.quantity <= 0 or item.rate <= 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Quantity and rate must be greater than 0")


async def _get_active_tax_config(db: AsyncSession, organisation_id: int) -> TaxConfiguration:
    result = await db.execute(
        select(TaxConfiguration).where(
            TaxConfiguration.organisation_id == organisation_id,
            TaxConfiguration.is_active.is_(True),
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Active tax configuration is required for TAX invoices",
        )
    return config


def _calculate_totals(
    items: List[SalesInvoiceItemCreate],
    invoice_type: str,
    tax_config: Optional[TaxConfiguration],
    other_charges: Decimal,
    round_off: Decimal,
) -> dict:
    subtotal = Decimal("0")
    cgst_total = Decimal("0")
    sgst_total = Decimal("0")
    igst_total = Decimal("0")

    cgst_rate = _safe_decimal(tax_config.cgst_percentage) if tax_config else Decimal("0")
    sgst_rate = _safe_decimal(tax_config.sgst_percentage) if tax_config else Decimal("0")
    igst_rate = _safe_decimal(tax_config.igst_percentage) if tax_config else Decimal("0")

    for item in items:
        base_amount = _safe_decimal(item.quantity) * _safe_decimal(item.rate)
        subtotal += base_amount
        if invoice_type == "TAX":
            cgst_total += (base_amount * cgst_rate) / Decimal("100")
            sgst_total += (base_amount * sgst_rate) / Decimal("100")
            igst_total += (base_amount * igst_rate) / Decimal("100")

    if abs(round_off) > subtotal:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Round off cannot exceed subtotal")

    total_tax = cgst_total + sgst_total + igst_total
    invoice_total = subtotal + total_tax + other_charges - round_off

    return {
        "subtotal": subtotal.quantize(Decimal("0.01")),
        "cgst": cgst_total.quantize(Decimal("0.01")),
        "sgst": sgst_total.quantize(Decimal("0.01")),
        "igst": igst_total.quantize(Decimal("0.01")),
        "invoice_total": invoice_total.quantize(Decimal("0.01")),
    }


async def _ensure_unique_invoice_number(
    db: AsyncSession,
    invoice_number: str,
    organisation_id: int,
    invoice_id: Optional[int] = None,
) -> None:
    query = select(SalesInvoice).where(
        SalesInvoice.invoice_number == invoice_number,
        SalesInvoice.organisation_id == organisation_id,
    )
    if invoice_id is not None:
        query = query.where(SalesInvoice.id != invoice_id)
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invoice number already exists")


async def get_next_sales_invoice_number(db: AsyncSession, organisation_id: int) -> str:
    numeric_invoice = case(
        (
            SalesInvoice.invoice_number.op("~")(r"^[0-9]+$"),
            cast(SalesInvoice.invoice_number, Integer),
        ),
        else_=None,
    )
    result = await db.execute(
        select(func.max(numeric_invoice)).where(SalesInvoice.organisation_id == organisation_id)
    )
    max_value = result.scalar_one() or 0
    return str(max_value + 1)


async def create_sales_invoice(db: AsyncSession, payload: SalesInvoiceCreate, user_id: int) -> SalesInvoice:
    _validate_items(payload.items)
    invoice_type = _normalize_invoice_type(payload.invoice_type)
    invoice_number = await get_next_sales_invoice_number(db, payload.organisation_id)
    await _ensure_unique_invoice_number(db, invoice_number, payload.organisation_id)

    tax_config = None
    if invoice_type == "TAX":
        tax_config = await _get_active_tax_config(db, payload.organisation_id)

    other_charges = _safe_decimal(payload.other_charges)
    round_off = _safe_decimal(payload.round_off)
    totals = _calculate_totals(payload.items, invoice_type, tax_config, other_charges, round_off)

    invoice = SalesInvoice(
        organisation_id=payload.organisation_id,
        invoice_number=invoice_number,
        invoice_date=payload.invoice_date,
        invoice_type=invoice_type,
        customer_name=payload.customer_name,
        customer_address=payload.customer_address,
        customer_state=payload.customer_state,
        customer_state_code=payload.customer_state_code,
        customer_gstin=payload.customer_gstin,
        customer_contact=payload.customer_contact,
        place_of_supply=payload.place_of_supply,
        vehicle_no=payload.vehicle_no,
        taxable_value=totals["subtotal"],
        cgst_amount=totals["cgst"],
        sgst_amount=totals["sgst"],
        igst_amount=totals["igst"],
        other_charges=other_charges,
        round_off=round_off,
        invoice_total=totals["invoice_total"],
        invoice_value_words=amount_to_words(totals["invoice_total"]),
        status="ACTIVE",
        created_by=user_id,
    )

    db.add(invoice)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invoice number already exists")

    for item in payload.items:
        base_amount = _safe_decimal(item.quantity) * _safe_decimal(item.rate)
        db.add(
            SalesInvoiceItem(
                sales_invoice_id=invoice.id,
                item_id=item.item_id,
                item_name=item.item_name,
                hsn_code=item.hsn_code,
                quantity=item.quantity,
                uom=item.uom,
                rate=item.rate,
                total_amount=base_amount.quantize(Decimal("0.01")),
            )
        )

    await db.refresh(invoice)
    return invoice


async def list_sales_invoices(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    organisation_id: Optional[int] = None,
    status_filter: Optional[str] = None,
    invoice_type: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> tuple[int, List[SalesInvoice]]:
    query = select(SalesInvoice)
    count_query = select(func.count(SalesInvoice.id))

    if organisation_id is not None:
        query = query.where(SalesInvoice.organisation_id == organisation_id)
        count_query = count_query.where(SalesInvoice.organisation_id == organisation_id)
    if status_filter:
        query = query.where(SalesInvoice.status == status_filter)
        count_query = count_query.where(SalesInvoice.status == status_filter)
    if invoice_type:
        query = query.where(SalesInvoice.invoice_type == invoice_type)
        count_query = count_query.where(SalesInvoice.invoice_type == invoice_type)
    if start_date:
        query = query.where(SalesInvoice.invoice_date >= start_date)
        count_query = count_query.where(SalesInvoice.invoice_date >= start_date)
    if end_date:
        query = query.where(SalesInvoice.invoice_date <= end_date)
        count_query = count_query.where(SalesInvoice.invoice_date <= end_date)

    query = query.order_by(SalesInvoice.created_at.desc()).offset(skip).limit(limit)

    total_result = await db.execute(count_query)
    total = total_result.scalar_one() or 0

    result = await db.execute(query)
    return total, result.scalars().all()


async def get_sales_invoice(db: AsyncSession, invoice_id: int) -> SalesInvoice:
    result = await db.execute(select(SalesInvoice).where(SalesInvoice.id == invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sales invoice not found")
    return invoice


async def update_sales_invoice(
    db: AsyncSession,
    invoice_id: int,
    payload: SalesInvoiceUpdate,
    user_id: int,
) -> SalesInvoice:
    invoice = await get_sales_invoice(db, invoice_id)
    if invoice.status == "CANCELLED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cancelled invoices cannot be edited")

    if payload.invoice_number is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invoice number is read-only")

    if payload.organisation_id is not None:
        invoice.organisation_id = payload.organisation_id
    if payload.invoice_date is not None:
        invoice.invoice_date = payload.invoice_date
    if payload.invoice_type is not None:
        invoice.invoice_type = _normalize_invoice_type(payload.invoice_type)
    if payload.customer_name is not None:
        invoice.customer_name = payload.customer_name
    if payload.customer_address is not None:
        invoice.customer_address = payload.customer_address
    if payload.customer_state is not None:
        invoice.customer_state = payload.customer_state
    if payload.customer_state_code is not None:
        invoice.customer_state_code = payload.customer_state_code
    if payload.customer_gstin is not None:
        invoice.customer_gstin = payload.customer_gstin
    if payload.customer_contact is not None:
        invoice.customer_contact = payload.customer_contact
    if payload.place_of_supply is not None:
        invoice.place_of_supply = payload.place_of_supply
    if payload.vehicle_no is not None:
        invoice.vehicle_no = payload.vehicle_no
    if payload.other_charges is not None:
        invoice.other_charges = payload.other_charges
    if payload.round_off is not None:
        invoice.round_off = payload.round_off

    invoice.modified_by = user_id

    items_changed = payload.items is not None
    totals_need_update = items_changed or payload.invoice_type is not None or payload.other_charges is not None or payload.round_off is not None

    if totals_need_update:
        items_source = payload.items if payload.items is not None else invoice.items
        _validate_items(items_source)
        invoice_type = _normalize_invoice_type(invoice.invoice_type)
        tax_config = None
        if invoice_type == "TAX":
            tax_config = await _get_active_tax_config(db, invoice.organisation_id)
        other_charges = _safe_decimal(invoice.other_charges)
        round_off = _safe_decimal(invoice.round_off)
        totals = _calculate_totals(items_source, invoice_type, tax_config, other_charges, round_off)
        invoice.taxable_value = totals["subtotal"]
        invoice.cgst_amount = totals["cgst"]
        invoice.sgst_amount = totals["sgst"]
        invoice.igst_amount = totals["igst"]
        invoice.invoice_total = totals["invoice_total"]
        invoice.invoice_value_words = amount_to_words(totals["invoice_total"])

    if items_changed:
        await db.execute(
            SalesInvoiceItem.__table__.delete().where(SalesInvoiceItem.sales_invoice_id == invoice_id)
        )
        for item in payload.items or []:
            base_amount = _safe_decimal(item.quantity) * _safe_decimal(item.rate)
            db.add(
                SalesInvoiceItem(
                    sales_invoice_id=invoice.id,
                    item_id=item.item_id,
                    item_name=item.item_name,
                    hsn_code=item.hsn_code,
                    quantity=item.quantity,
                    uom=item.uom,
                    rate=item.rate,
                    total_amount=base_amount.quantize(Decimal("0.01")),
                )
            )
        await db.flush()

    await db.refresh(invoice)
    return invoice


async def cancel_sales_invoice(db: AsyncSession, invoice_id: int, user_id: int) -> SalesInvoice:
    invoice = await get_sales_invoice(db, invoice_id)
    if invoice.status == "CANCELLED":
        return invoice
    invoice.status = "CANCELLED"
    invoice.modified_by = user_id
    await db.flush()
    await db.refresh(invoice)
    return invoice
