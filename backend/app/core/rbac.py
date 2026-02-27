"""
RBAC utilities.
"""
import re
from typing import Optional


def is_superadmin(role: Optional[str]) -> bool:
    """Check if a role represents super admin."""
    if not role:
        return False
    role_value = getattr(role, "value", role)
    normalized = re.sub(r"[^a-z0-9]", "", str(role_value).strip().lower())
    return normalized == "superadmin"
