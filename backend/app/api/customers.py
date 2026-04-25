"""

Customer master endpoints (global directory; RBAC still uses X-Organization-Id).

"""

from fastapi import APIRouter, Depends, status, Request, Header, Query

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

from app.api.dependencies import get_current_active_user

from app.models.user import User

from app.api.dependencies_rbac import RequirePermissionFromHeader

from app.api.schemas import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerListResponse

from app.services.customer_service import (

    list_customers,

    create_customer,

    update_customer,

    delete_customer,

    get_customer,

)

from app.services.audit_service import AuditLogService



router = APIRouter(prefix="/customers", tags=["Customers"])





@router.get("", response_model=CustomerListResponse)
async def list_customer_records(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=10000),
    search: str | None = Query(default=None, alias="search"),
    sort_by: str = Query("name", alias="sort_by"),
    sort_dir: str = Query("asc", alias="sort_dir"),
    _=Depends(get_current_active_user),
    __=Depends(RequirePermissionFromHeader("CUSTOMERS", "view")),
    db: AsyncSession = Depends(get_db),
):
    total, items = await list_customers(
        db,
        skip=skip,
        limit=limit,
        search=search,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )
    return CustomerListResponse(total=total, items=items)





@router.get("/{customer_id}", response_model=CustomerResponse)

async def get_customer_record(

    customer_id: int,

    _=Depends(get_current_active_user),

    __=Depends(RequirePermissionFromHeader("CUSTOMERS", "view")),

    db: AsyncSession = Depends(get_db),

):

    return await get_customer(db, customer_id)





@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)

async def create_customer_record(

    payload: CustomerCreate,

    request: Request,

    x_organization_id: int | None = Header(default=None, alias="X-Organization-Id"),

    current_user: User = Depends(get_current_active_user),

    __=Depends(RequirePermissionFromHeader("CUSTOMERS", "create")),

    db: AsyncSession = Depends(get_db),

):

    customer = await create_customer(db, payload)

    client_ip = request.client.host if request.client else None

    user_agent = request.headers.get("user-agent")

    await AuditLogService.log_create(

        db=db,

        organisation_id=x_organization_id,

        user_id=current_user.id,

        module_name="Customers",

        entity_name="customer",

        entity_id=customer.id,

        new_value=AuditLogService.serialize_instance(customer),

        ip_address=client_ip,

        user_agent=user_agent,

    )

    return customer





@router.put("/{customer_id}", response_model=CustomerResponse)

async def update_customer_record(

    customer_id: int,

    payload: CustomerUpdate,

    request: Request,

    x_organization_id: int | None = Header(default=None, alias="X-Organization-Id"),

    current_user: User = Depends(get_current_active_user),

    __=Depends(RequirePermissionFromHeader("CUSTOMERS", "update")),

    db: AsyncSession = Depends(get_db),

):

    existing = await get_customer(db, customer_id)

    old_snapshot = AuditLogService.serialize_instance(existing)

    updated = await update_customer(db, customer_id, payload)

    client_ip = request.client.host if request.client else None

    user_agent = request.headers.get("user-agent")

    await AuditLogService.log_update(

        db=db,

        organisation_id=x_organization_id,

        user_id=current_user.id,

        module_name="Customers",

        entity_name="customer",

        entity_id=updated.id,

        old_value=old_snapshot,

        new_value=AuditLogService.serialize_instance(updated),

        ip_address=client_ip,

        user_agent=user_agent,

    )

    return updated





@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)

async def delete_customer_record(

    customer_id: int,

    request: Request,

    x_organization_id: int | None = Header(default=None, alias="X-Organization-Id"),

    current_user: User = Depends(get_current_active_user),

    __=Depends(RequirePermissionFromHeader("CUSTOMERS", "delete")),

    db: AsyncSession = Depends(get_db),

):

    existing = await get_customer(db, customer_id)

    client_ip = request.client.host if request.client else None

    user_agent = request.headers.get("user-agent")

    await AuditLogService.log_delete(

        db=db,

        organisation_id=x_organization_id,

        user_id=current_user.id,

        module_name="Customers",

        entity_name="customer",

        entity_id=existing.id,

        old_value=AuditLogService.serialize_instance(existing),

        ip_address=client_ip,

        user_agent=user_agent,

    )

    await delete_customer(db, customer_id)

    return None

