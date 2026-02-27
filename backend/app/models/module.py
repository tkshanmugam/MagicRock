"""
Module model for RBAC system.
"""
from sqlalchemy import Column, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base


class Module(Base):
    """Module model."""
    __tablename__ = "modules"
    
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    
    # Relationships
    role_module_permissions = relationship("RoleModulePermission", back_populates="module")
    
    def __repr__(self):
        return f"<Module(id={self.id}, code={self.code}, name={self.name})>"
