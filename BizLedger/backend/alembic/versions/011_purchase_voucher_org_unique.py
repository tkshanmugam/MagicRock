"""Make purchase voucher number unique per organisation

Revision ID: 011_purchase_voucher_org_unique
Revises: 010_fix_organization_table_refs
Create Date: 2026-01-21 00:00:00.000000
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "011_purchase_voucher_org_unique"
down_revision = "010_fix_organization_table_refs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_index("ix_purchase_voucher_voucher_no", table_name="purchase_voucher")
    op.create_index(
        "ix_purchase_voucher_org_voucher_no",
        "purchase_voucher",
        ["organisation_id", "voucher_no"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_purchase_voucher_org_voucher_no", table_name="purchase_voucher")
    op.create_index("ix_purchase_voucher_voucher_no", "purchase_voucher", ["voucher_no"], unique=True)
