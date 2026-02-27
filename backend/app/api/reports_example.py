"""
Example protected route using RBAC system.
This demonstrates how to use RequirePermission dependency.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.api.dependencies_rbac import RequirePermission

router = APIRouter(prefix="/reports", tags=["Reports (Example)"])


@router.get("")
async def get_reports(
    organization_id: int = Query(..., description="Organization ID"),
    _=Depends(RequirePermission("REPORTS", "view")),
    db: AsyncSession = Depends(get_db)
):
    """
    Example protected endpoint that requires 'view' permission on 'REPORTS' module.
    
    The RequirePermission dependency automatically:
    1. Verifies user belongs to organization
    2. Checks module is enabled for organization
    3. Validates user's role has 'view' permission on REPORTS module
    4. Raises 403 if any check fails
    """
    return {
        "message": "Reports data",
        "organization_id": organization_id,
        "note": "This endpoint is protected by RBAC. Only users with 'view' permission on REPORTS module can access it."
    }


@router.post("")
async def create_report(
    organization_id: int = Query(..., description="Organization ID"),
    _=Depends(RequirePermission("REPORTS", "create")),
    db: AsyncSession = Depends(get_db)
):
    """
    Example protected endpoint that requires 'create' permission on 'REPORTS' module.
    """
    return {
        "message": "Report created",
        "organization_id": organization_id,
        "note": "This endpoint requires 'create' permission on REPORTS module."
    }


@router.put("/{report_id}")
async def update_report(
    report_id: int,
    organization_id: int = Query(..., description="Organization ID"),
    _=Depends(RequirePermission("REPORTS", "update")),
    db: AsyncSession = Depends(get_db)
):
    """
    Example protected endpoint that requires 'update' permission on 'REPORTS' module.
    """
    return {
        "message": f"Report {report_id} updated",
        "organization_id": organization_id,
        "note": "This endpoint requires 'update' permission on REPORTS module."
    }


@router.delete("/{report_id}")
async def delete_report(
    report_id: int,
    organization_id: int = Query(..., description="Organization ID"),
    _=Depends(RequirePermission("REPORTS", "delete")),
    db: AsyncSession = Depends(get_db)
):
    """
    Example protected endpoint that requires 'delete' permission on 'REPORTS' module.
    """
    return {
        "message": f"Report {report_id} deleted",
        "organization_id": organization_id,
        "note": "This endpoint requires 'delete' permission on REPORTS module."
    }
