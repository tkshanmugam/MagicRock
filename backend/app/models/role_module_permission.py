"""
RoleModulePermission model for RBAC system.
"""
from sqlalchemy import Column, Integer, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.session import Base


class RoleModulePermission(Base):
    """RoleModulePermission model - defines permissions for roles on modules."""
    __tablename__ = "role_module_permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False, index=True)
    can_view = Column(Boolean, default=False, nullable=False)
    can_create = Column(Boolean, default=False, nullable=False)
    can_update = Column(Boolean, default=False, nullable=False)
    can_delete = Column(Boolean, default=False, nullable=False)
    
    # Relationships
    role = relationship("Role", back_populates="role_module_permissions")
    module = relationship("Module", back_populates="role_module_permissions")
    
    # Unique constraint: one permission set per role-module combination
    __table_args__ = (
        UniqueConstraint('role_id', 'module_id', name='uq_role_module_permission'),
    )
    
    def __repr__(self):
        return f"<RoleModulePermission(id={self.id}, role_id={self.role_id}, module_id={self.module_id})>"
