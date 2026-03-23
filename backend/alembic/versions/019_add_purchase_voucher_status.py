"""Add status column to purchase_voucher for soft cancel

Revision ID: 019_purchase_voucher_status
Revises: 018_fix_super_admin
Create Date: 2026-03-22

Adds status column (active/cancelled) to support cancelling vouchers
instead of hard delete.
"""
from alembic import op
import sqlalchemy as sa


revision = "019_purchase_voucher_status"
down_revision = "018_fix_super_admin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "purchase_voucher",
        sa.Column("status", sa.String(length=20), nullable=False, server_default="active"),
    )
    op.create_index("ix_purchase_voucher_status", "purchase_voucher", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_purchase_voucher_status", table_name="purchase_voucher")
    op.drop_column("purchase_voucher", "status")
