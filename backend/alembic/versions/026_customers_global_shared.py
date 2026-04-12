"""Customers shared across all organisations (unique GSTIN globally)

Revision ID: 026_customers_global
Revises: 025_customers_gstin
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa


revision = "026_customers_global"
down_revision = "025_customers_gstin"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Keep one row per GSTIN (lowest id wins)
    op.execute(
        """
        DELETE FROM customers AS c1
        USING customers AS c2
        WHERE c1.gstin = c2.gstin AND c1.id > c2.id
        """
    )
    op.drop_constraint("uq_customers_org_gstin", "customers", type_="unique")
    op.drop_index("ix_customers_organisation_id", table_name="customers")
    op.drop_column("customers", "organisation_id")
    op.create_unique_constraint("uq_customers_gstin", "customers", ["gstin"])


def downgrade() -> None:
    op.drop_constraint("uq_customers_gstin", "customers", type_="unique")
    op.add_column(
        "customers",
        sa.Column("organisation_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "customers_organisation_id_fkey",
        "customers",
        "organisations",
        ["organisation_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index("ix_customers_organisation_id", "customers", ["organisation_id"], unique=False)
    op.create_unique_constraint("uq_customers_org_gstin", "customers", ["organisation_id", "gstin"])
