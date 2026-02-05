"""
Sales invoice models.
"""
from sqlalchemy import Column, BigInteger, Integer, String, Date, DateTime, Numeric, ForeignKey, Text, func, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base


class SalesInvoice(Base):
    """Sales invoice header."""

    __tablename__ = "sales_invoice"

    id = Column(BigInteger, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False, index=True)
    invoice_number = Column(String(50), nullable=False, index=True)
    invoice_date = Column(Date, nullable=False, index=True)
    invoice_type = Column(String(20), nullable=False, default="TAX")
    customer_name = Column(String(255), nullable=False)
    customer_address = Column(Text, nullable=True)
    customer_state = Column(String(100), nullable=True)
    customer_state_code = Column(String(5), nullable=True)
    customer_gstin = Column(String(20), nullable=True)
    customer_contact = Column(String(20), nullable=True)
    place_of_supply = Column(String(100), nullable=True)
    vehicle_no = Column(String(30), nullable=True)
    taxable_value = Column(Numeric(18, 2), nullable=False, server_default="0")
    cgst_amount = Column(Numeric(18, 2), nullable=False, server_default="0")
    sgst_amount = Column(Numeric(18, 2), nullable=False, server_default="0")
    igst_amount = Column(Numeric(18, 2), nullable=False, server_default="0")
    other_charges = Column(Numeric(18, 2), nullable=False, server_default="0")
    round_off = Column(Numeric(18, 2), nullable=False, server_default="0")
    invoice_total = Column(Numeric(18, 2), nullable=False)
    invoice_value_words = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="ACTIVE", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    modified_at = Column(DateTime(timezone=True), nullable=True, onupdate=func.now())
    modified_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    items = relationship(
        "SalesInvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("organisation_id", "invoice_number", name="uq_sales_invoice_org_number"),
    )


class SalesInvoiceItem(Base):
    """Sales invoice item row."""

    __tablename__ = "sales_invoice_item"

    id = Column(BigInteger, primary_key=True, index=True)
    sales_invoice_id = Column(BigInteger, ForeignKey("sales_invoice.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(BigInteger, nullable=True)
    item_name = Column(String(255), nullable=False)
    hsn_code = Column(String(20), nullable=True)
    quantity = Column(Numeric(18, 3), nullable=False)
    uom = Column(String(20), nullable=True)
    rate = Column(Numeric(18, 2), nullable=False)
    total_amount = Column(Numeric(18, 2), nullable=False)

    invoice = relationship("SalesInvoice", back_populates="items")
