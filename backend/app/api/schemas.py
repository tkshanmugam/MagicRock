"""
Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal


# Auth Schemas
class Token(BaseModel):
    """Token response schema."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    """Refresh token request schema."""
    refresh_token: str


class TokenData(BaseModel):
    """Token data schema."""
    user_id: Optional[int] = None


class LoginRequest(BaseModel):
    """Login request schema."""
    username: str
    password: str


# User Schemas
class UserBase(BaseModel):
    """Base user schema."""
    username: str
    email: EmailStr
    full_name: Optional[str] = None


class UserCreate(BaseModel):
    """User creation schema."""
    username: str
    full_name: Optional[str] = None
    password: str
    organization_id: Optional[int] = None
    role_id: Optional[int] = None


class UserUpdate(BaseModel):
    """User update schema."""
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    """User response schema (email excluded)."""
    id: int
    username: str
    full_name: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime
    role: Optional[str] = None  # Role name
    role_id: Optional[int] = None  # Role ID
    organisations: Optional[List[int]] = None  # List of organization IDs
    
    class Config:
        from_attributes = True


# Audit Log Schemas
class AuditLogItem(BaseModel):
    """Audit log item response schema."""
    id: int
    organisation_id: Optional[int]
    organisation_name: Optional[str] = None
    user_id: Optional[int]
    user_name: Optional[str] = None
    module_name: str
    entity_name: Optional[str] = None
    entity_id: Optional[int] = None
    action: str
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    remarks: Optional[str] = None
    created_date: datetime


class AuditLogListResponse(BaseModel):
    total: int
    items: List[AuditLogItem]


class AuditLogBulkDeleteRequest(BaseModel):
    """Bulk delete audit log rows by ID."""
    ids: List[int]


class AuditLogBulkDeleteResponse(BaseModel):
    deleted: int


# Organisation Schemas
class OrganisationBase(BaseModel):
    """Base organisation schema."""
    name: str
    address: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    branch: Optional[str] = None
    default_particulars: Optional[str] = None
    is_valid: bool = True


class OrganisationCreate(OrganisationBase):
    """Organisation creation schema."""
    pass


class OrganisationUpdate(BaseModel):
    """Organisation update schema."""
    name: Optional[str] = None
    address: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    branch: Optional[str] = None
    default_particulars: Optional[str] = None
    is_valid: Optional[bool] = None


class OrganisationResponse(OrganisationBase):
    """Organisation response schema."""
    id: int
    created_date: datetime
    created_by: int
    modified_by: Optional[int] = None
    modified_at: Optional[datetime] = None
    logo_name: Optional[str] = None
    default_particulars: Optional[str] = None

    class Config:
        from_attributes = True


# RBAC Schemas
class OrganizationCreate(BaseModel):
    """Organization creation schema."""
    name: str


class OrganizationResponse(BaseModel):
    """Organization response schema."""
    id: int
    name: str
    status: str
    address: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserOrganizationCreate(BaseModel):
    """User-Organization assignment schema."""
    user_id: int
    role_id: Optional[int] = None


class UserOrganizationUpdate(BaseModel):
    """User-Organization role update schema."""
    role_id: int


class UserOrganizationResponse(BaseModel):
    """User-Organization response schema."""
    id: int
    user_id: int
    organization_id: int
    role_id: int
    status: str
    
    class Config:
        from_attributes = True


class ModulePermissionResponse(BaseModel):
    """Module permission response schema."""
    code: str
    name: str
    canView: bool
    canCreate: bool
    canUpdate: bool
    canDelete: bool


class UserPermissionsResponse(BaseModel):
    """User permissions response schema."""
    organizationId: int
    modules: List[ModulePermissionResponse]


class RoleResponse(BaseModel):
    """Role response schema."""
    id: int
    name: str
    
    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    """Role creation schema."""
    name: str


class RoleUpdate(BaseModel):
    """Role update schema."""
    name: Optional[str] = None


class RoleModulePermissionItem(BaseModel):
    """Role-module permission item for updates."""
    module_id: int
    can_view: bool
    can_create: bool
    can_update: bool
    can_delete: bool


# Purchase Voucher Schemas
class PurchaseVoucherItemBase(BaseModel):
    rate: Optional[Decimal] = None
    particulars: Optional[str] = None
    bags: Optional[int] = None
    qtls: Optional[Decimal] = None
    kgs: Optional[Decimal] = None
    amount: Optional[Decimal] = None


class PurchaseVoucherItemCreate(PurchaseVoucherItemBase):
    pass


class PurchaseVoucherItemResponse(PurchaseVoucherItemBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PurchaseVoucherBase(BaseModel):
    organisation_id: Optional[int] = None
    voucher_no: int
    voucher_date: Optional[date] = None
    supplier_name: Optional[str] = None
    supplier_address: Optional[str] = None
    supplier_mobile: Optional[str] = None
    lorry_no: Optional[str] = None


class PurchaseVoucherCreate(PurchaseVoucherBase):
    items: List[PurchaseVoucherItemCreate]

    @validator("items")
    def validate_items(cls, value: List[PurchaseVoucherItemCreate]) -> List[PurchaseVoucherItemCreate]:
        if not value:
            raise ValueError("At least one item is required")
        return value


class PurchaseVoucherUpdate(BaseModel):
    organisation_id: Optional[int] = None
    voucher_no: Optional[int] = None
    voucher_date: Optional[date] = None
    supplier_name: Optional[str] = None
    supplier_address: Optional[str] = None
    supplier_mobile: Optional[str] = None
    lorry_no: Optional[str] = None
    items: Optional[List[PurchaseVoucherItemCreate]] = None


class PurchaseVoucherResponse(PurchaseVoucherBase):
    id: int
    total_bags: Optional[int] = None
    total_qtls: Optional[Decimal] = None
    total_kgs: Optional[Decimal] = None
    total_amount: Optional[Decimal] = None
    status: Optional[str] = "active"
    created_at: datetime
    updated_at: datetime
    items: List[PurchaseVoucherItemResponse] = []

    class Config:
        from_attributes = True


class PurchaseVoucherListResponse(BaseModel):
    total: int
    items: List[PurchaseVoucherResponse]


# Tax Configuration Schemas
class TaxConfigurationBase(BaseModel):
    organisation_id: int
    sgst_percentage: Decimal
    cgst_percentage: Decimal
    igst_percentage: Optional[Decimal] = Decimal("0")
    is_active: Optional[bool] = True

    @validator("sgst_percentage", "cgst_percentage", "igst_percentage")
    def validate_tax_percentage(cls, value: Decimal) -> Decimal:
        if value is None:
            return Decimal("0")
        if value < 0 or value > 100:
            raise ValueError("Tax percentage must be between 0 and 100")
        return value


class TaxConfigurationCreate(TaxConfigurationBase):
    pass


class TaxConfigurationUpdate(BaseModel):
    sgst_percentage: Optional[Decimal] = None
    cgst_percentage: Optional[Decimal] = None
    igst_percentage: Optional[Decimal] = None
    is_active: Optional[bool] = None

    @validator("sgst_percentage", "cgst_percentage", "igst_percentage")
    def validate_tax_percentage(cls, value: Optional[Decimal]) -> Optional[Decimal]:
        if value is None:
            return value
        if value < 0 or value > 100:
            raise ValueError("Tax percentage must be between 0 and 100")
        return value


class TaxConfigurationResponse(TaxConfigurationBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Customer master (global directory; one row per GSTIN)
class CustomerBase(BaseModel):
    name: str
    address: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None
    gstin: str
    contact_no: Optional[str] = None

    @validator("name")
    def validate_name(cls, value: str) -> str:
        stripped = (value or "").strip()
        if not stripped:
            raise ValueError("Name is required")
        return stripped

    @validator("gstin")
    def validate_gstin(cls, value: str) -> str:
        stripped = (value or "").strip().upper()
        if not stripped:
            raise ValueError("GSTIN is required")
        if len(stripped) > 50:
            raise ValueError("GSTIN must be at most 50 characters")
        return stripped

    @validator("address", "state", "contact_no")
    def optional_strings(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        s = value.strip()
        return s or None

    @validator("state_code")
    def optional_state_code(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        s = value.strip()
        if not s:
            return None
        if len(s) > 100:
            raise ValueError("state_code must be at most 100 characters")
        return s


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = None
    state_code: Optional[str] = None
    gstin: Optional[str] = None
    contact_no: Optional[str] = None

    @validator("name")
    def update_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        s = value.strip()
        if not s:
            raise ValueError("Name cannot be empty")
        return s

    @validator("gstin")
    def update_gstin(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        s = value.strip().upper()
        if not s:
            raise ValueError("GSTIN cannot be empty")
        if len(s) > 50:
            raise ValueError("GSTIN must be at most 50 characters")
        return s

    @validator("address", "state", "contact_no")
    def strip_optional(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        s = value.strip()
        return s or None

    @validator("state_code")
    def strip_state_code(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        s = value.strip()
        if not s:
            return None
        if len(s) > 100:
            raise ValueError("state_code must be at most 100 characters")
        return s


class CustomerResponse(CustomerBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomerListResponse(BaseModel):
    total: int
    items: List[CustomerResponse]


# Sales Invoice Schemas
class SalesInvoiceItemBase(BaseModel):
    item_id: Optional[int] = None
    item_name: str
    hsn_code: Optional[str] = None
    quantity: Decimal
    uom: Optional[str] = None
    rate: Decimal
    total_amount: Optional[Decimal] = None

    @validator("quantity", "rate")
    def validate_positive_amount(cls, value: Decimal) -> Decimal:
        if value is None or value <= 0:
            raise ValueError("Quantity and rate must be greater than 0")
        return value


class SalesInvoiceItemCreate(SalesInvoiceItemBase):
    pass


class SalesInvoiceItemResponse(SalesInvoiceItemBase):
    id: int

    class Config:
        from_attributes = True


class SalesInvoiceBase(BaseModel):
    organisation_id: int
    invoice_number: Optional[str] = None
    invoice_date: date
    invoice_type: Optional[str] = "TAX"
    customer_name: str
    customer_address: Optional[str] = None
    customer_state: Optional[str] = None
    customer_state_code: Optional[str] = None
    customer_gstin: Optional[str] = None
    customer_contact: Optional[str] = None
    place_of_supply: Optional[str] = None
    vehicle_no: Optional[str] = None
    other_charges: Optional[Decimal] = Decimal("0")
    round_off: Optional[Decimal] = Decimal("0")


class SalesInvoiceCreate(SalesInvoiceBase):
    items: List[SalesInvoiceItemCreate]

    @validator("items")
    def validate_items(cls, value: List[SalesInvoiceItemCreate]) -> List[SalesInvoiceItemCreate]:
        if not value:
            raise ValueError("At least one item is required")
        return value


class SalesInvoiceUpdate(BaseModel):
    organisation_id: Optional[int] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    invoice_type: Optional[str] = None
    customer_name: Optional[str] = None
    customer_address: Optional[str] = None
    customer_state: Optional[str] = None
    customer_state_code: Optional[str] = None
    customer_gstin: Optional[str] = None
    customer_contact: Optional[str] = None
    place_of_supply: Optional[str] = None
    vehicle_no: Optional[str] = None
    other_charges: Optional[Decimal] = None
    round_off: Optional[Decimal] = None
    items: Optional[List[SalesInvoiceItemCreate]] = None


class SalesInvoiceResponse(SalesInvoiceBase):
    id: int
    invoice_number: str
    taxable_value: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    invoice_total: Decimal
    invoice_value_words: Optional[str] = None
    status: str
    created_at: datetime
    created_by: int
    modified_at: Optional[datetime] = None
    modified_by: Optional[int] = None
    items: List[SalesInvoiceItemResponse] = []

    class Config:
        from_attributes = True


class OrganisationShareProfile(BaseModel):
    """Public seller details embedded in invoice share responses (no auth)."""

    id: int
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    branch: Optional[str] = None
    logo_name: Optional[str] = None
    gstin: Optional[str] = None
    pan: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    tagline: Optional[str] = None
    upi_id: Optional[str] = None


class SalesInvoiceShareResponse(SalesInvoiceResponse):
    organisation_profile: Optional[OrganisationShareProfile] = None


class SalesInvoiceListResponse(BaseModel):
    total: int
    items: List[SalesInvoiceResponse]


class SalesInvoiceNumberResponse(BaseModel):
    invoice_number: str

class RoleModulePermissionBulkUpdate(BaseModel):
    """Bulk update schema for role-module permissions."""
    permissions: List[RoleModulePermissionItem]


class RoleModulePermissionResponse(BaseModel):
    """Role-module permission response schema."""
    id: Optional[int] = None
    role_id: int
    module_id: int
    module_code: str
    module_name: str
    can_view: bool
    can_create: bool
    can_update: bool
    can_delete: bool


class ModuleCreate(BaseModel):
    """Module creation schema."""
    code: str
    name: str


class ModuleUpdate(BaseModel):
    """Module update schema."""
    code: Optional[str] = None
    name: Optional[str] = None


class ModuleResponse(BaseModel):
    """Module response schema."""
    id: int
    code: str
    name: str
    
    class Config:
        from_attributes = True


# Health Check Schema
class HealthResponse(BaseModel):
    """Health check response schema."""
    status: str
    version: str
    uptime_seconds: float
    database: str
    timestamp: datetime


# Report Schemas
class SalesReportItem(BaseModel):
    invoice_date: date
    invoice_number: str
    invoice_type: str
    subtotal: Decimal
    tax_amount: Decimal
    round_off: Decimal
    invoice_total: Decimal
    customer_name: Optional[str] = None


class SalesReportSummary(BaseModel):
    total_taxable_sales: Decimal
    total_non_tax_sales: Decimal
    total_tax_collected: Decimal
    net_sales_value: Decimal


class SalesReportResponse(BaseModel):
    total: int
    items: List[SalesReportItem]
    summary: SalesReportSummary


class PurchaseReportItem(BaseModel):
    purchase_date: Optional[date] = None
    purchase_invoice_number: int
    supplier_name: Optional[str] = None
    subtotal: Decimal
    tax_amount: Decimal
    invoice_total: Decimal


class PurchaseReportSummary(BaseModel):
    total_purchase_value: Decimal
    total_input_tax: Decimal
    net_purchase_amount: Decimal


class PurchaseReportResponse(BaseModel):
    total: int
    items: List[PurchaseReportItem]
    summary: PurchaseReportSummary


class TaxReportItem(BaseModel):
    report_date: date
    taxable_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    total_tax_amount: Decimal
    cgst_rate: Decimal
    sgst_rate: Decimal


class TaxReportSummary(BaseModel):
    total_output_tax: Decimal
    total_input_tax: Decimal
    net_tax_payable: Decimal


class TaxReportResponse(BaseModel):
    items: List[TaxReportItem]
    summary: TaxReportSummary


class GstSummaryMonthlyItem(BaseModel):
    report_year: int
    report_month: int
    taxable_amount: Decimal
    cgst_amount: Decimal
    sgst_amount: Decimal
    igst_amount: Decimal
    total_tax_amount: Decimal


class GstSummaryMonthlySummary(BaseModel):
    total_taxable_amount: Decimal
    total_output_tax: Decimal
    total_input_tax: Decimal
    net_tax_payable: Decimal


class GstSummaryMonthlyResponse(BaseModel):
    items: List[GstSummaryMonthlyItem]
    summary: GstSummaryMonthlySummary


class SalesPartyReportItem(BaseModel):
    party_name: Optional[str] = None
    invoice_count: int
    taxable_amount: Decimal
    tax_amount: Decimal
    invoice_total: Decimal


class SalesPartyReportSummary(BaseModel):
    total_taxable_amount: Decimal
    total_tax_amount: Decimal
    total_invoice_amount: Decimal


class SalesPartyReportResponse(BaseModel):
    total: int
    items: List[SalesPartyReportItem]
    summary: SalesPartyReportSummary


class PurchasePartyReportItem(BaseModel):
    party_name: Optional[str] = None
    invoice_count: int
    subtotal: Decimal
    tax_amount: Decimal
    invoice_total: Decimal


class PurchasePartyReportSummary(BaseModel):
    total_purchase_value: Decimal
    total_input_tax: Decimal
    net_purchase_amount: Decimal


class PurchasePartyReportResponse(BaseModel):
    total: int
    items: List[PurchasePartyReportItem]
    summary: PurchasePartyReportSummary


# Dashboard Schemas
class DashboardRange(BaseModel):
    mode: str
    start_date: date
    end_date: date


class DashboardKpiRange(BaseModel):
    today: Decimal
    month: Decimal
    range: Decimal


class DashboardInvoiceCounts(BaseModel):
    sales: int
    purchases: int


class DashboardKpis(BaseModel):
    sales: DashboardKpiRange
    purchases: DashboardKpiRange
    net_revenue: DashboardKpiRange
    tax: DashboardKpiRange
    receivables: Decimal
    payables: Decimal
    invoice_counts: DashboardInvoiceCounts


class DashboardTopCustomer(BaseModel):
    name: Optional[str] = None
    total_value: Decimal
    invoice_count: int


class DashboardTopProduct(BaseModel):
    name: Optional[str] = None
    quantity: Decimal
    total_value: Decimal


class DashboardSummaryResponse(BaseModel):
    range: DashboardRange
    kpis: DashboardKpis
    top_customers: List[DashboardTopCustomer]
    top_products: List[DashboardTopProduct]


class DashboardTrendPoint(BaseModel):
    date: date
    sales: Decimal
    purchases: Decimal


class DashboardSalesTrendsResponse(BaseModel):
    range: DashboardRange
    data: List[DashboardTrendPoint]


class DashboardTaxSummaryResponse(BaseModel):
    range: DashboardRange
    cgst: Decimal
    sgst: Decimal
    igst: Decimal
    total: Decimal

