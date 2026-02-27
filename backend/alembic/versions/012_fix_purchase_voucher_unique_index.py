"""Ensure purchase voucher number is unique per organisation.

Revision ID: 012_fix_purchase_voucher_unique_index
Revises: 011_purchase_voucher_org_unique
Create Date: 2026-01-22 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "012_fix_purchase_voucher_unique_index"
down_revision = "011_purchase_voucher_org_unique"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    index_names = {index.get("name") for index in inspector.get_indexes("purchase_voucher")}

    if "ix_purchase_voucher_voucher_no" in index_names:
        op.drop_index("ix_purchase_voucher_voucher_no", table_name="purchase_voucher")

    if "ix_purchase_voucher_org_voucher_no" not in index_names:
        op.create_index(
            "ix_purchase_voucher_org_voucher_no",
            "purchase_voucher",
            ["organisation_id", "voucher_no"],
            unique=True,
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    index_names = {index.get("name") for index in inspector.get_indexes("purchase_voucher")}

    if "ix_purchase_voucher_org_voucher_no" in index_names:
        op.drop_index("ix_purchase_voucher_org_voucher_no", table_name="purchase_voucher")

    if "ix_purchase_voucher_voucher_no" not in index_names:
        op.create_index("ix_purchase_voucher_voucher_no", "purchase_voucher", ["voucher_no"], unique=True)
