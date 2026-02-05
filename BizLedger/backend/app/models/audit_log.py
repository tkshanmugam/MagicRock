"""
Audit log model for tracking system events.
"""
from sqlalchemy import Column, BigInteger, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.db.session import Base


class AuditLog(Base):
    """Audit log model."""
    __tablename__ = "audit_log"

    id = Column(BigInteger, primary_key=True, index=True)
    organisation_id = Column(BigInteger, ForeignKey("organisations.id"), nullable=True, index=True)
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=True, index=True)
    module_name = Column(String(100), nullable=False, index=True)
    entity_name = Column(String(100), nullable=True, index=True)
    entity_id = Column(BigInteger, nullable=True, index=True)
    action = Column(String(20), nullable=False, index=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    remarks = Column(Text, nullable=True)
    created_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)

    user = relationship("User", back_populates="audit_logs")

    def __repr__(self):
        return f"<AuditLog(id={self.id}, action={self.action}, user_id={self.user_id})>"

