"""
Customer master (shared across all organisations; unique GSTIN).
"""
from sqlalchemy import Column, BigInteger, String, Text, DateTime, UniqueConstraint, func
from app.db.session import Base


class Customer(Base):
    """Global customer directory (one row per GSTIN)."""

    __tablename__ = "customers"
    __table_args__ = (UniqueConstraint("gstin", name="uq_customers_gstin"),)

    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    address = Column(Text, nullable=True)
    state = Column(String(100), nullable=True)
    state_code = Column(String(100), nullable=True)
    gstin = Column(String(50), nullable=False)
    contact_no = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
