"""Add sales invoices and tax configuration tables.

Revision ID: 013_add_sales_invoices_and_tax_config
Revises: 012_fix_purchase_voucher_unique_index
Create Date: 2026-01-22 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "013_add_sales_invoices_and_tax_config"
down_revision = "012_fix_purchase_voucher_unique_index"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tax_configuration",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("organisation_id", sa.Integer(), sa.ForeignKey("organisations.id"), nullable=False, index=True),
        sa.Column("sgst_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("cgst_percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("igst_percentage", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )
    op.create_index("ix_tax_configuration_org_active", "tax_configuration", ["organisation_id", "is_active"])

    op.create_table(
        "sales_invoice",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("organisation_id", sa.Integer(), sa.ForeignKey("organisations.id"), nullable=False, index=True),
        sa.Column("invoice_number", sa.String(length=50), nullable=False, index=True),
        sa.Column("invoice_date", sa.Date(), nullable=False, index=True),
        sa.Column("invoice_type", sa.String(length=20), nullable=False, server_default="TAX"),
        sa.Column("customer_name", sa.String(length=255), nullable=False),
        sa.Column("customer_address", sa.Text(), nullable=True),
        sa.Column("customer_state", sa.String(length=100), nullable=True),
        sa.Column("customer_state_code", sa.String(length=5), nullable=True),
        sa.Column("customer_gstin", sa.String(length=20), nullable=True),
        sa.Column("customer_contact", sa.String(length=20), nullable=True),
        sa.Column("place_of_supply", sa.String(length=100), nullable=True),
        sa.Column("vehicle_no", sa.String(length=30), nullable=True),
        sa.Column("taxable_value", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("cgst_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("sgst_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("igst_amount", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("other_charges", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("round_off", sa.Numeric(18, 2), nullable=False, server_default="0"),
        sa.Column("invoice_total", sa.Numeric(18, 2), nullable=False),
        sa.Column("invoice_value_words", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="ACTIVE"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("modified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("modified_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.UniqueConstraint("organisation_id", "invoice_number", name="uq_sales_invoice_org_number"),
    )

    op.create_table(
        "sales_invoice_item",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("sales_invoice_id", sa.BigInteger(), sa.ForeignKey("sales_invoice.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("item_id", sa.BigInteger(), nullable=True),
        sa.Column("item_name", sa.String(length=255), nullable=False),
        sa.Column("hsn_code", sa.String(length=20), nullable=True),
        sa.Column("quantity", sa.Numeric(18, 3), nullable=False),
        sa.Column("uom", sa.String(length=20), nullable=True),
        sa.Column("rate", sa.Numeric(18, 2), nullable=False),
        sa.Column("total_amount", sa.Numeric(18, 2), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("sales_invoice_item")
    op.drop_table("sales_invoice")
    op.drop_index("ix_tax_configuration_org_active", table_name="tax_configuration")
    op.drop_table("tax_configuration")
