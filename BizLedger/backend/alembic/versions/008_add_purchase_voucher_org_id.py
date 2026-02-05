"""Add organisation_id to purchase voucher

Revision ID: 008_add_purchase_voucher_org_id
Revises: 007_add_purchase_vouchers
Create Date: 2026-01-20 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "008_add_purchase_voucher_org_id"
down_revision = "007_add_purchase_vouchers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("purchase_voucher", sa.Column("organisation_id", sa.Integer(), nullable=True))
    op.create_index("ix_purchase_voucher_organisation_id", "purchase_voucher", ["organisation_id"], unique=False)
    op.create_foreign_key(
        "fk_purchase_voucher_organisation_id",
        "purchase_voucher",
        "organisations",
        ["organisation_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_purchase_voucher_organisation_id", "purchase_voucher", type_="foreignkey")
    op.drop_index("ix_purchase_voucher_organisation_id", table_name="purchase_voucher")
    op.drop_column("purchase_voucher", "organisation_id")
