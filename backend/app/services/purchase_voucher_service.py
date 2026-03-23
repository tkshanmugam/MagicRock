"""
Service for purchase voucher operations.
"""
from decimal import Decimal
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from app.models.purchase_voucher import PurchaseVoucher, PurchaseVoucherItem
from app.api.schemas import PurchaseVoucherCreate, PurchaseVoucherUpdate, PurchaseVoucherItemCreate

PURCHASE_VOUCHER_STATUS_ACTIVE = "active"
PURCHASE_VOUCHER_STATUS_CANCELLED = "cancelled"


def _safe_decimal(value: Optional[Decimal]) -> Decimal:
    if value is None:
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _calculate_totals(items: List[PurchaseVoucherItemCreate]) -> dict:
    total_bags = 0
    total_qtls = Decimal("0")
    total_kgs = Decimal("0")
    total_amount = Decimal("0")

    for item in items:
        total_bags += int(item.bags or 0)
        total_qtls += _safe_decimal(item.qtls)
        total_kgs += _safe_decimal(item.kgs)
        total_amount += _safe_decimal(item.amount)

    return {
        "total_bags": total_bags,
        "total_qtls": total_qtls,
        "total_kgs": total_kgs,
        "total_amount": total_amount,
    }


async def _ensure_unique_voucher_no(
    db: AsyncSession,
    voucher_no: int,
    organisation_id: Optional[int] = None,
    voucher_id: Optional[int] = None,
) -> None:
    query = select(PurchaseVoucher).where(
        PurchaseVoucher.voucher_no == voucher_no,
        PurchaseVoucher.status == PURCHASE_VOUCHER_STATUS_ACTIVE,
    )
    if organisation_id is not None:
        query = query.where(PurchaseVoucher.organisation_id == organisation_id)
    if voucher_id is not None:
        query = query.where(PurchaseVoucher.id != voucher_id)
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Voucher number already exists")


async def create_purchase_voucher(db: AsyncSession, payload: PurchaseVoucherCreate) -> PurchaseVoucher:
    await _ensure_unique_voucher_no(db, payload.voucher_no, payload.organisation_id)

    totals = _calculate_totals(payload.items)

    voucher = PurchaseVoucher(
        organisation_id=payload.organisation_id,
        voucher_no=payload.voucher_no,
        voucher_date=payload.voucher_date,
        supplier_name=payload.supplier_name,
        supplier_mobile=payload.supplier_mobile,
        lorry_no=payload.lorry_no,
        **totals,
    )
    db.add(voucher)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Voucher number already exists")

    for item in payload.items:
        db.add(
            PurchaseVoucherItem(
                purchase_voucher_id=voucher.id,
                rate=item.rate,
                particulars=item.particulars,
                bags=item.bags,
                qtls=item.qtls,
                kgs=item.kgs,
                amount=item.amount,
            )
        )

    await db.refresh(voucher)
    return voucher


async def list_purchase_vouchers(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    organisation_id: Optional[int] = None,
    include_cancelled: bool = False,
) -> List[PurchaseVoucher]:
    query = select(PurchaseVoucher).order_by(PurchaseVoucher.created_at.desc())
    if organisation_id is not None:
        query = query.where(PurchaseVoucher.organisation_id == organisation_id)
    if not include_cancelled:
        query = query.where(PurchaseVoucher.status == PURCHASE_VOUCHER_STATUS_ACTIVE)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


async def get_next_voucher_number(db: AsyncSession, organisation_id: Optional[int] = None) -> int:
    query = select(func.max(PurchaseVoucher.voucher_no)).where(
        PurchaseVoucher.status == PURCHASE_VOUCHER_STATUS_ACTIVE
    )
    if organisation_id is not None:
        query = query.where(PurchaseVoucher.organisation_id == organisation_id)
    result = await db.execute(query)
    max_no = result.scalar_one_or_none()
    return int(max_no or 0) + 1


async def get_purchase_voucher(db: AsyncSession, voucher_id: int) -> PurchaseVoucher:
    result = await db.execute(select(PurchaseVoucher).where(PurchaseVoucher.id == voucher_id))
    voucher = result.scalar_one_or_none()
    if not voucher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Purchase voucher not found")
    return voucher


async def update_purchase_voucher(db: AsyncSession, voucher_id: int, payload: PurchaseVoucherUpdate) -> PurchaseVoucher:
    voucher = await get_purchase_voucher(db, voucher_id)
    if voucher.status == PURCHASE_VOUCHER_STATUS_CANCELLED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot update a cancelled voucher")

    if payload.voucher_no is not None:
        await _ensure_unique_voucher_no(db, payload.voucher_no, payload.organisation_id, voucher_id=voucher_id)

    if payload.voucher_no is not None:
        voucher.voucher_no = payload.voucher_no
    if payload.organisation_id is not None:
        voucher.organisation_id = payload.organisation_id
    if payload.voucher_date is not None:
        voucher.voucher_date = payload.voucher_date
    if payload.supplier_name is not None:
        voucher.supplier_name = payload.supplier_name
    if payload.supplier_mobile is not None:
        voucher.supplier_mobile = payload.supplier_mobile
    if payload.lorry_no is not None:
        voucher.lorry_no = payload.lorry_no

    if payload.items is not None:
        totals = _calculate_totals(payload.items)
        voucher.total_bags = totals["total_bags"]
        voucher.total_qtls = totals["total_qtls"]
        voucher.total_kgs = totals["total_kgs"]
        voucher.total_amount = totals["total_amount"]

        await db.execute(
            PurchaseVoucherItem.__table__.delete().where(PurchaseVoucherItem.purchase_voucher_id == voucher_id)
        )
        for item in payload.items:
            db.add(
                PurchaseVoucherItem(
                    purchase_voucher_id=voucher.id,
                    rate=item.rate,
                    particulars=item.particulars,
                    bags=item.bags,
                    qtls=item.qtls,
                    kgs=item.kgs,
                    amount=item.amount,
                )
            )

    await db.refresh(voucher)
    return voucher


async def cancel_purchase_voucher(db: AsyncSession, voucher_id: int) -> PurchaseVoucher:
    voucher = await get_purchase_voucher(db, voucher_id)
    if voucher.status == PURCHASE_VOUCHER_STATUS_CANCELLED:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Voucher is already cancelled")
    voucher.status = PURCHASE_VOUCHER_STATUS_CANCELLED
    await db.flush()
    await db.refresh(voucher)
    return voucher
