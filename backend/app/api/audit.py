"""
Audit log endpoints.
"""
from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, delete
from app.db.session import get_db
from app.models.audit_log import AuditLog
from app.models.user import User
from app.models.organisation import Organisation
from app.api.schemas import (
    AuditLogItem,
    AuditLogListResponse,
    AuditLogBulkDeleteRequest,
    AuditLogBulkDeleteResponse,
)
from app.api.dependencies import require_admin
from datetime import datetime

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


@router.get("", response_model=AuditLogListResponse)
async def get_audit_logs(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=2000),
    action: Optional[str] = None,
    module_name: Optional[str] = None,
    user_id: Optional[int] = None,
    organisation_id: Optional[int] = None,
    entity_id: Optional[int] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    sort_by: Optional[str] = Query("created_date"),
    sort_dir: Optional[str] = Query("desc"),
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get audit logs with filtering (Admin only)."""
    base_query = (
        select(AuditLog, User.username, Organisation.name)
        .outerjoin(User, AuditLog.user_id == User.id)
        .outerjoin(Organisation, AuditLog.organisation_id == Organisation.id)
    )

    if action:
        base_query = base_query.where(AuditLog.action == action)
    if module_name:
        base_query = base_query.where(AuditLog.module_name == module_name)
    if user_id:
        base_query = base_query.where(AuditLog.user_id == user_id)
    if organisation_id:
        base_query = base_query.where(AuditLog.organisation_id == organisation_id)
    if entity_id:
        base_query = base_query.where(AuditLog.entity_id == entity_id)
    if start_date:
        base_query = base_query.where(AuditLog.created_date >= start_date)
    if end_date:
        base_query = base_query.where(AuditLog.created_date <= end_date)

    count_query = select(func.count(AuditLog.id))
    for criterion in base_query._where_criteria:
        count_query = count_query.where(criterion)

    sort_column = AuditLog.created_date if sort_by == "created_date" else AuditLog.id
    order = desc(sort_column) if sort_dir.lower() == "desc" else sort_column.asc()
    base_query = base_query.order_by(order).offset(skip).limit(limit)

    total_result = await db.execute(count_query)
    total = total_result.scalar_one() or 0

    result = await db.execute(base_query)
    rows = result.all()

    items = []
    for log, username, org_name in rows:
        items.append(
            AuditLogItem(
                id=log.id,
                organisation_id=log.organisation_id,
                organisation_name=org_name,
                user_id=log.user_id,
                user_name=username,
                module_name=log.module_name,
                entity_name=log.entity_name,
                entity_id=log.entity_id,
                action=log.action,
                old_value=log.old_value,
                new_value=log.new_value,
                ip_address=log.ip_address,
                user_agent=log.user_agent,
                remarks=log.remarks,
                created_date=log.created_date,
            )
        )

    return AuditLogListResponse(total=total, items=items)


@router.post("/bulk-delete", response_model=AuditLogBulkDeleteResponse)
async def bulk_delete_audit_logs(
    body: AuditLogBulkDeleteRequest,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple audit logs by ID (Admin only)."""
    if not body.ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No ids provided")
    unique_ids = list(dict.fromkeys(body.ids))
    if len(unique_ids) > 2000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Too many ids (max 2000 per request)",
        )
    result = await db.execute(delete(AuditLog).where(AuditLog.id.in_(unique_ids)))
    await db.commit()
    deleted = result.rowcount or 0
    return AuditLogBulkDeleteResponse(deleted=deleted)


@router.get("/{log_id}", response_model=AuditLogItem)
async def get_audit_log(
    log_id: int,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get specific audit log by ID (Admin only)."""
    result = await db.execute(
        select(AuditLog, User.username, Organisation.name)
        .outerjoin(User, AuditLog.user_id == User.id)
        .outerjoin(Organisation, AuditLog.organisation_id == Organisation.id)
        .where(AuditLog.id == log_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit log not found")
    log, username, org_name = row
    return AuditLogItem(
        id=log.id,
        organisation_id=log.organisation_id,
        organisation_name=org_name,
        user_id=log.user_id,
        user_name=username,
        module_name=log.module_name,
        entity_name=log.entity_name,
        entity_id=log.entity_id,
        action=log.action,
        old_value=log.old_value,
        new_value=log.new_value,
        ip_address=log.ip_address,
        user_agent=log.user_agent,
        remarks=log.remarks,
        created_date=log.created_date,
    )


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_audit_log(
    log_id: int,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single audit log by ID (Admin only)."""
    log = await db.get(AuditLog, log_id)
    if not log:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit log not found")
    await db.delete(log)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

