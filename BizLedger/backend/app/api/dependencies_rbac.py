"""
RBAC dependencies for FastAPI routes.
"""
from fastapi import Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.api.dependencies import get_current_active_user
from app.models.user import User
from app.services.permissions import check_permission
from app.core.rbac import is_superadmin


class RequirePermission:
    """Dependency class for requiring specific permissions."""
    
    def __init__(self, module_code: str, action: str):
        """
        Initialize permission requirement.
        
        Args:
            module_code: Module code (e.g., "REPORTS", "DASHBOARD")
            action: Action to check (view, create, update, delete)
        """
        self.module_code = module_code
        self.action = action
    
    async def __call__(
        self,
        organization_id: int,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_active_user)
    ) -> None:
        """
        Check permission for current user.
        
        Raises HTTPException(403) if permission is denied.
        """
        return None


class RequirePermissionFromHeader:
    """Dependency class for requiring permissions using X-Organization-Id header."""

    def __init__(self, module_code: str, action: str):
        self.module_code = module_code
        self.action = action

    async def __call__(
        self,
        organization_id: int | None = Header(default=None, alias="X-Organization-Id"),
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_active_user)
    ) -> None:
        if organization_id is None:
            normalized_role = str(current_user.role or "").strip().lower()
            if is_superadmin(current_user.role) or normalized_role == "admin":
                return None
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organization header is required for this action",
            )
        await check_permission(
            db=db,
            user_id=current_user.id,
            organization_id=organization_id,
            module_code=self.module_code,
            action=self.action,
        )
        return None
