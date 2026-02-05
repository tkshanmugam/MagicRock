"""
UserOrganization model for RBAC system.
"""
from sqlalchemy import Column, Integer, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base


class UserOrganization(Base):
    """UserOrganization model - links users to organizations with roles."""
    __tablename__ = "user_organizations"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    organization_id = Column(Integer, ForeignKey("organisations.id"), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False, index=True)
    status = Column(String(50), default="active", nullable=False)
    
    # Relationships
    user = relationship("User", backref="user_organizations")
    organization = relationship("Organisation", backref="user_organizations")
    role = relationship("Role", back_populates="user_organizations")
    
    # Unique constraint: one user can have one role per organisation
    __table_args__ = (
        UniqueConstraint('user_id', 'organization_id', name='uq_user_organisation'),
    )
    
    def __repr__(self):
        return f"<UserOrganization(id={self.id}, user_id={self.user_id}, organization_id={self.organization_id}, role_id={self.role_id})>"
