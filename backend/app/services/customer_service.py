"""
Customer CRUD (global directory; unique GSTIN across all organisations).
"""
from typing import List
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.models.customer import Customer
from app.api.schemas import CustomerCreate, CustomerUpdate


def _normalize_gstin(value: str) -> str:
    return (value or "").strip().upper()


async def list_customers(db: AsyncSession) -> List[Customer]:
    result = await db.execute(select(Customer).order_by(Customer.name.asc(), Customer.id.asc()))
    return list(result.scalars().all())


async def get_customer(db: AsyncSession, customer_id: int) -> Customer:
    result = await db.execute(select(Customer).where(Customer.id == customer_id))
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer


async def create_customer(db: AsyncSession, payload: CustomerCreate) -> Customer:
    gstin = _normalize_gstin(payload.gstin)

    customer = Customer(
        name=(payload.name or "").strip(),
        address=(payload.address or "").strip() or None,
        state=(payload.state or "").strip() or None,
        state_code=(payload.state_code or "").strip() or None,
        gstin=gstin,
        contact_no=(payload.contact_no or "").strip() or None,
    )
    db.add(customer)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A customer with this GSTIN already exists.",
        ) from None
    await db.refresh(customer)
    return customer


async def update_customer(
    db: AsyncSession,
    customer_id: int,
    payload: CustomerUpdate,
) -> Customer:
    customer = await get_customer(db, customer_id)

    if payload.name is not None:
        customer.name = payload.name.strip()
    if payload.address is not None:
        customer.address = payload.address.strip() or None
    if payload.state is not None:
        customer.state = payload.state.strip() or None
    if payload.state_code is not None:
        customer.state_code = payload.state_code.strip() or None
    if payload.contact_no is not None:
        customer.contact_no = payload.contact_no.strip() or None
    if payload.gstin is not None:
        customer.gstin = _normalize_gstin(payload.gstin)
        if not customer.gstin:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="GSTIN is required")

    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A customer with this GSTIN already exists.",
        ) from None
    await db.refresh(customer)
    return customer


async def delete_customer(db: AsyncSession, customer_id: int) -> None:
    customer = await get_customer(db, customer_id)
    await db.delete(customer)
