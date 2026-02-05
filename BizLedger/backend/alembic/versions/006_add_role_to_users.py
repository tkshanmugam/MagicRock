"""Add role column to users table

Revision ID: 006_add_role_to_users
Revises: 005_remove_role
Create Date: 2026-01-17 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "006_add_role_to_users"
down_revision = "005_remove_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("role", sa.String(length=50), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "role")
