"""
Audit logging service for tracking system events.
"""
from __future__ import annotations

from typing import Any, Optional
from decimal import Decimal
from datetime import date, datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.inspection import inspect
from app.models.audit_log import AuditLog


SENSITIVE_FIELDS = {
    "password",
    "hashed_password",
    "token",
    "access_token",
    "refresh_token",
    "secret",
    "api_key",
}


def _mask_sensitive(data: Any) -> Any:
    if isinstance(data, dict):
        masked = {}
        for key, value in data.items():
            key_lower = str(key).lower()
            if any(field in key_lower for field in SENSITIVE_FIELDS):
                masked[key] = "***"
            else:
                masked[key] = _mask_sensitive(value)
        return masked
    if isinstance(data, list):
        return [_mask_sensitive(item) for item in data]
    return data


def _normalize_value(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    return value


def _serialize_model(instance: Any) -> dict:
    mapper = inspect(instance).mapper
    data = {}
    for column in mapper.columns:
        value = getattr(instance, column.key)
        data[column.key] = _normalize_value(value)
    return data


class AuditLogService:
    """Service for creating audit log entries."""

    @staticmethod
    async def log_create(
        db: AsyncSession,
        *,
        organisation_id: Optional[int],
        user_id: Optional[int],
        module_name: str,
        entity_name: str,
        entity_id: Optional[int],
        new_value: Any,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        remarks: Optional[str] = None,
    ) -> None:
        await AuditLogService._log(
            db=db,
            organisation_id=organisation_id,
            user_id=user_id,
            module_name=module_name,
            entity_name=entity_name,
            entity_id=entity_id,
            action="CREATE",
            old_value=None,
            new_value=new_value,
            ip_address=ip_address,
            user_agent=user_agent,
            remarks=remarks,
        )

    @staticmethod
    async def log_update(
        db: AsyncSession,
        *,
        organisation_id: Optional[int],
        user_id: Optional[int],
        module_name: str,
        entity_name: str,
        entity_id: Optional[int],
        old_value: Any,
        new_value: Any,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        remarks: Optional[str] = None,
    ) -> None:
        await AuditLogService._log(
            db=db,
            organisation_id=organisation_id,
            user_id=user_id,
            module_name=module_name,
            entity_name=entity_name,
            entity_id=entity_id,
            action="UPDATE",
            old_value=old_value,
            new_value=new_value,
            ip_address=ip_address,
            user_agent=user_agent,
            remarks=remarks,
        )

    @staticmethod
    async def log_delete(
        db: AsyncSession,
        *,
        organisation_id: Optional[int],
        user_id: Optional[int],
        module_name: str,
        entity_name: str,
        entity_id: Optional[int],
        old_value: Any,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        remarks: Optional[str] = None,
    ) -> None:
        await AuditLogService._log(
            db=db,
            organisation_id=organisation_id,
            user_id=user_id,
            module_name=module_name,
            entity_name=entity_name,
            entity_id=entity_id,
            action="DELETE",
            old_value=old_value,
            new_value=None,
            ip_address=ip_address,
            user_agent=user_agent,
            remarks=remarks,
        )

    @staticmethod
    async def log_action(
        db: AsyncSession,
        *,
        organisation_id: Optional[int],
        user_id: Optional[int],
        module_name: str,
        entity_name: Optional[str],
        entity_id: Optional[int],
        action: str,
        remarks: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> None:
        await AuditLogService._log(
            db=db,
            organisation_id=organisation_id,
            user_id=user_id,
            module_name=module_name,
            entity_name=entity_name,
            entity_id=entity_id,
            action=action,
            old_value=None,
            new_value=None,
            ip_address=ip_address,
            user_agent=user_agent,
            remarks=remarks,
        )

    @staticmethod
    def serialize_instance(instance: Any) -> dict:
        return _mask_sensitive(_serialize_model(instance))

    @staticmethod
    async def _log(
        db: AsyncSession,
        *,
        organisation_id: Optional[int],
        user_id: Optional[int],
        module_name: str,
        entity_name: Optional[str],
        entity_id: Optional[int],
        action: str,
        old_value: Any,
        new_value: Any,
        ip_address: Optional[str],
        user_agent: Optional[str],
        remarks: Optional[str],
    ) -> None:
        try:
            audit_log = AuditLog(
                organisation_id=organisation_id,
                user_id=user_id,
                module_name=module_name,
                entity_name=entity_name,
                entity_id=entity_id,
                action=action,
                old_value=_mask_sensitive(old_value) if old_value is not None else None,
                new_value=_mask_sensitive(new_value) if new_value is not None else None,
                ip_address=ip_address,
                user_agent=user_agent,
                remarks=remarks,
            )
            db.add(audit_log)
            await db.flush()
        except Exception:
            # Never break the primary flow due to audit log failure.
            return

