"""add_organisation_bank_details

Revision ID: 016_add_organisation_bank_details
Revises: 015_add_audit_log_table
Create Date: 2026-01-28
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "016_add_organisation_bank_details"
down_revision = "015_add_audit_log_table"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("organisations", sa.Column("bank_name", sa.String(length=255), nullable=True))
    op.add_column("organisations", sa.Column("account_number", sa.String(length=64), nullable=True))
    op.add_column("organisations", sa.Column("ifsc_code", sa.String(length=32), nullable=True))


def downgrade() -> None:
    op.drop_column("organisations", "ifsc_code")
    op.drop_column("organisations", "account_number")
    op.drop_column("organisations", "bank_name")
