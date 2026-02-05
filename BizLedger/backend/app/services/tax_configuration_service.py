"""
Service for tax configuration operations.
"""
from typing import List, Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.models.tax_configuration import TaxConfiguration
from app.api.schemas import TaxConfigurationCreate, TaxConfigurationUpdate


async def list_tax_configurations(db: AsyncSession, organisation_id: Optional[int] = None) -> List[TaxConfiguration]:
    query = select(TaxConfiguration).order_by(TaxConfiguration.created_at.desc())
    if organisation_id is not None:
        query = query.where(TaxConfiguration.organisation_id == organisation_id)
    result = await db.execute(query)
    return result.scalars().all()


async def get_tax_configuration(db: AsyncSession, config_id: int) -> TaxConfiguration:
    result = await db.execute(select(TaxConfiguration).where(TaxConfiguration.id == config_id))
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tax configuration not found")
    return config


async def get_active_tax_configuration(db: AsyncSession, organisation_id: int) -> TaxConfiguration:
    result = await db.execute(
        select(TaxConfiguration).where(
            TaxConfiguration.organisation_id == organisation_id,
            TaxConfiguration.is_active.is_(True),
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active tax configuration not found")
    return config


async def create_tax_configuration(db: AsyncSession, payload: TaxConfigurationCreate) -> TaxConfiguration:
    if payload.is_active:
        await db.execute(
            update(TaxConfiguration)
            .where(TaxConfiguration.organisation_id == payload.organisation_id)
            .values(is_active=False)
        )

    config = TaxConfiguration(
        organisation_id=payload.organisation_id,
        sgst_percentage=payload.sgst_percentage,
        cgst_percentage=payload.cgst_percentage,
        igst_percentage=payload.igst_percentage or 0,
        is_active=payload.is_active if payload.is_active is not None else True,
    )
    db.add(config)
    await db.flush()
    await db.refresh(config)
    return config


async def update_tax_configuration(db: AsyncSession, config_id: int, payload: TaxConfigurationUpdate) -> TaxConfiguration:
    config = await get_tax_configuration(db, config_id)

    if payload.is_active:
        await db.execute(
            update(TaxConfiguration)
            .where(TaxConfiguration.organisation_id == config.organisation_id, TaxConfiguration.id != config_id)
            .values(is_active=False)
        )

    if payload.sgst_percentage is not None:
        config.sgst_percentage = payload.sgst_percentage
    if payload.cgst_percentage is not None:
        config.cgst_percentage = payload.cgst_percentage
    if payload.igst_percentage is not None:
        config.igst_percentage = payload.igst_percentage
    if payload.is_active is not None:
        config.is_active = payload.is_active

    await db.refresh(config)
    return config


async def delete_tax_configuration(db: AsyncSession, config_id: int) -> None:
    config = await get_tax_configuration(db, config_id)
    await db.delete(config)
