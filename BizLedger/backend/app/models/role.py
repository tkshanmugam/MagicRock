"""
Role model for RBAC system.
"""
from sqlalchemy import Column, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base


class Role(Base):
    """Role model."""
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    
    # Relationships
    user_organizations = relationship("UserOrganization", back_populates="role")
    role_module_permissions = relationship("RoleModulePermission", back_populates="role", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Role(id={self.id}, name={self.name})>"
