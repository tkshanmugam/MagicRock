"""Add purchase vouchers tables

Revision ID: 007_add_purchase_vouchers
Revises: 006_add_role_to_users
Create Date: 2026-01-20 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "007_add_purchase_vouchers"
down_revision = "006_add_role_to_users"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "purchase_voucher",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("voucher_no", sa.Integer(), nullable=False),
        sa.Column("voucher_date", sa.Date(), nullable=True),
        sa.Column("supplier_name", sa.String(length=255), nullable=True),
        sa.Column("supplier_mobile", sa.String(length=50), nullable=True),
        sa.Column("lorry_no", sa.String(length=100), nullable=True),
        sa.Column("total_bags", sa.Integer(), nullable=True),
        sa.Column("total_qtls", sa.Numeric(18, 3), nullable=True),
        sa.Column("total_kgs", sa.Numeric(18, 3), nullable=True),
        sa.Column("total_amount", sa.Numeric(18, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_purchase_voucher_voucher_no", "purchase_voucher", ["voucher_no"], unique=True)

    op.create_table(
        "purchase_voucher_items",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("purchase_voucher_id", sa.BigInteger(), sa.ForeignKey("purchase_voucher.id", ondelete="CASCADE"), nullable=False),
        sa.Column("rate", sa.Numeric(18, 2), nullable=True),
        sa.Column("particulars", sa.String(length=255), nullable=True),
        sa.Column("bags", sa.Integer(), nullable=True),
        sa.Column("qtls", sa.Numeric(18, 3), nullable=True),
        sa.Column("kgs", sa.Numeric(18, 3), nullable=True),
        sa.Column("amount", sa.Numeric(18, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_purchase_voucher_items_purchase_voucher_id", "purchase_voucher_items", ["purchase_voucher_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_purchase_voucher_items_purchase_voucher_id", table_name="purchase_voucher_items")
    op.drop_table("purchase_voucher_items")
    op.drop_index("ix_purchase_voucher_voucher_no", table_name="purchase_voucher")
    op.drop_table("purchase_voucher")
