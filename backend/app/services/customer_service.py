"""
Customer CRUD (global directory; unique GSTIN across all organisations).
"""
from typing import List, Optional, Tuple
from sqlalchemy import select, func, or_, cast, String, asc, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.models.customer import Customer
from app.api.schemas import CustomerCreate, CustomerUpdate


_CUSTOMER_SORT_COLUMNS = {
    "name": Customer.name,
    "gstin": Customer.gstin,
    "contact_no": Customer.contact_no,
    "state": Customer.state,
    "updated_at": Customer.updated_at,
    "created_at": Customer.created_at,
    "id": Customer.id,
}


def _normalize_gstin(value: str) -> str:
    return (value or "").strip().upper()


async def list_customers(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    sort_by: str = "name",
    sort_dir: str = "asc",
) -> Tuple[int, List[Customer]]:
    sort_col = _CUSTOMER_SORT_COLUMNS.get((sort_by or "name").lower(), Customer.name)
    ascending = (sort_dir or "asc").lower() != "desc"
    primary = asc(sort_col) if ascending else desc(sort_col)
    tie = Customer.id.asc() if ascending else Customer.id.desc()

    query = select(Customer)
    count_query = select(func.count(Customer.id))

    term = (search or "").strip()
    if term:
        pattern = f"%{term}%"
        clause = or_(
            Customer.name.ilike(pattern),
            Customer.gstin.ilike(pattern),
            Customer.contact_no.ilike(pattern),
            Customer.state.ilike(pattern),
            cast(Customer.id, String).ilike(pattern),
        )
        query = query.where(clause)
        count_query = count_query.where(clause)

    query = query.order_by(primary, tie).offset(skip).limit(limit)

    total_result = await db.execute(count_query)
    total = int(total_result.scalar_one() or 0)

    result = await db.execute(query)
    return total, list(result.scalars().all())


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
