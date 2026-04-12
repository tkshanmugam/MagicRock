"""Widen customers.gstin (Indian GSTIN is 15 chars; allow buffer for input errors)

Revision ID: 025_customers_gstin
Revises: 024_customers_state_code
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa


revision = "025_customers_gstin"
down_revision = "024_customers_state_code"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "customers",
        "gstin",
        existing_type=sa.String(length=20),
        type_=sa.String(length=50),
        existing_nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "customers",
        "gstin",
        existing_type=sa.String(length=50),
        type_=sa.String(length=20),
        existing_nullable=False,
    )
