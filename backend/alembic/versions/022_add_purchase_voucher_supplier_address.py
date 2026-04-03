"""Add supplier_address to purchase_voucher

Revision ID: 022_purchase_supplier_address
Revises: 021_org_default_particulars_broaden
Create Date: 2026-04-03
"""
from alembic import op
import sqlalchemy as sa


revision = "022_purchase_supplier_address"
down_revision = "021_org_default_particulars_broaden"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "purchase_voucher",
        sa.Column("supplier_address", sa.String(length=500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("purchase_voucher", "supplier_address")
