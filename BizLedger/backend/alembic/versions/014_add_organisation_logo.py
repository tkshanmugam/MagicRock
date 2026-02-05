"""Add logo name to organisations.

Revision ID: 014_add_organisation_logo
Revises: 013_add_sales_invoices_and_tax_config
Create Date: 2026-01-24 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "014_add_organisation_logo"
down_revision = "013_add_sales_invoices_and_tax_config"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("organisations", sa.Column("logo_name", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("organisations", "logo_name")
