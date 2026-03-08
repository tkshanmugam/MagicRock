"""Fix super admin role for users created before role column was re-added

Revision ID: 018_fix_super_admin
Revises: 017_add_organisation_branch
Create Date: 2026-03-03

Ensures the super admin user (from settings) has role SUPER_ADMIN.
Users with NULL role who match super admin username get updated.
"""
from alembic import op
from sqlalchemy import text
from app.core.config import settings


revision = "018_fix_super_admin"
down_revision = "017_add_organisation_branch"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Update super admin user to have SUPER_ADMIN role (fixes users with NULL role after migration 006)
    conn = op.get_bind()
    conn.execute(
        text("""
            UPDATE users
            SET role = 'SUPER_ADMIN'
            WHERE username = :username AND (role IS NULL OR role != 'SUPER_ADMIN')
        """),
        {"username": settings.SUPER_ADMIN_USERNAME}
    )


def downgrade() -> None:
    # No-op - we don't want to remove SUPER_ADMIN role on downgrade
    pass
