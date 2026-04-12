"""Add customers table

Revision ID: 023_add_customers
Revises: 022_purchase_supplier_address
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa


revision = "023_add_customers"
down_revision = "022_purchase_supplier_address"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "customers",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("organisation_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("state", sa.String(length=100), nullable=True),
        sa.Column("state_code", sa.String(length=5), nullable=True),
        sa.Column("gstin", sa.String(length=20), nullable=False),
        sa.Column("contact_no", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organisation_id"], ["organisations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organisation_id", "gstin", name="uq_customers_org_gstin"),
    )
    op.create_index(op.f("ix_customers_organisation_id"), "customers", ["organisation_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_customers_organisation_id"), table_name="customers")
    op.drop_table("customers")
