"""Add default_particulars to organisations

Revision ID: 020_org_default_particulars
Revises: 019_purchase_voucher_status
Create Date: 2026-03-22

Adds default_particulars column for organisation-specific default
particulars in purchase vouchers. Pre-populates known organisations.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


revision = "020_org_default_particulars"
down_revision = "019_purchase_voucher_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organisations",
        sa.Column("default_particulars", sa.String(length=255), nullable=True),
    )
    conn = op.get_bind()
    conn.execute(
        text("UPDATE organisations SET default_particulars = 'Coconut''s husk' WHERE LOWER(TRIM(name)) LIKE 'amman%'")
    )
    conn.execute(
        text("UPDATE organisations SET default_particulars = 'Coconuts' WHERE LOWER(TRIM(name)) LIKE 'jaswanth%' OR LOWER(TRIM(name)) LIKE 'jaswant%'")
    )
    conn.execute(
        text("UPDATE organisations SET default_particulars = 'Coconut''s Shell' WHERE LOWER(TRIM(name)) LIKE 'kumaran%'")
    )


def downgrade() -> None:
    op.drop_column("organisations", "default_particulars")
