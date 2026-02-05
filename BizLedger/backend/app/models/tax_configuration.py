"""
Tax configuration model for GST settings.
"""
from sqlalchemy import Column, BigInteger, Integer, Numeric, Boolean, DateTime, ForeignKey, func
from app.db.session import Base


class TaxConfiguration(Base):
    """Organisation-specific tax configuration."""

    __tablename__ = "tax_configuration"

    id = Column(BigInteger, primary_key=True, index=True)
    organisation_id = Column(Integer, ForeignKey("organisations.id"), nullable=False, index=True)
    sgst_percentage = Column(Numeric(5, 2), nullable=False)
    cgst_percentage = Column(Numeric(5, 2), nullable=False)
    igst_percentage = Column(Numeric(5, 2), nullable=False, server_default="0")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

