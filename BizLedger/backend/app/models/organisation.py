"""
Organisation model.
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.session import Base


class Organisation(Base):
    """Organisation model."""
    __tablename__ = "organisations"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    address = Column(Text, nullable=True)
    bank_name = Column(String(255), nullable=True)
    account_number = Column(String(64), nullable=True)
    ifsc_code = Column(String(32), nullable=True)
    branch = Column(String(255), nullable=True)
    logo_name = Column(String(255), nullable=True)
    is_valid = Column(Boolean, default=True, nullable=False)
    created_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    modified_by = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    modified_at = Column(DateTime(timezone=True), nullable=True, onupdate=func.now())
    
    # Relationships
    creator = relationship("User", foreign_keys=[created_by], backref="created_organisations")
    modifier = relationship("User", foreign_keys=[modified_by], backref="modified_organisations")
    
    def __repr__(self):
        return f"<Organisation(id={self.id}, name={self.name}, is_valid={self.is_valid})>"
