"""
Purchase voucher models.
"""
from sqlalchemy import Column, BigInteger, Integer, String, Date, DateTime, Numeric, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from app.db.session import Base


class PurchaseVoucher(Base):
    """Purchase voucher header."""

    __tablename__ = "purchase_voucher"

    id = Column(BigInteger, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=True, index=True)
    voucher_no = Column(Integer, nullable=False, index=True)
    voucher_date = Column(Date, nullable=True, index=True)
    supplier_name = Column(String(255), nullable=True)
    supplier_mobile = Column(String(50), nullable=True)
    lorry_no = Column(String(100), nullable=True)
    total_bags = Column(Integer, nullable=True)
    total_qtls = Column(Numeric(18, 3), nullable=True)
    total_kgs = Column(Numeric(18, 3), nullable=True)
    total_amount = Column(Numeric(18, 2), nullable=True)
    status = Column(String(20), nullable=False, server_default="active", index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    items = relationship(
        "PurchaseVoucherItem",
        back_populates="voucher",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("organisation_id", "voucher_no", name="uq_purchase_voucher_org_voucher_no"),
    )


class PurchaseVoucherItem(Base):
    """Purchase voucher item row."""

    __tablename__ = "purchase_voucher_items"

    id = Column(BigInteger, primary_key=True, index=True)
    purchase_voucher_id = Column(BigInteger, ForeignKey("purchase_voucher.id", ondelete="CASCADE"), nullable=False, index=True)
    rate = Column(Numeric(18, 2), nullable=True)
    particulars = Column(String(255), nullable=True)
    bags = Column(Integer, nullable=True)
    qtls = Column(Numeric(18, 3), nullable=True)
    kgs = Column(Numeric(18, 3), nullable=True)
    amount = Column(Numeric(18, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    voucher = relationship("PurchaseVoucher", back_populates="items")
