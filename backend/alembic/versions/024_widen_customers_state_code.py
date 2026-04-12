"""Widen customers.state_code for longer values

Revision ID: 024_customers_state_code
Revises: 023_add_customers
Create Date: 2026-04-10
"""
from alembic import op
import sqlalchemy as sa


revision = "024_customers_state_code"
down_revision = "023_add_customers"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column(
        "customers",
        "state_code",
        existing_type=sa.String(length=5),
        type_=sa.String(length=100),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "customers",
        "state_code",
        existing_type=sa.String(length=100),
        type_=sa.String(length=5),
        existing_nullable=True,
    )
