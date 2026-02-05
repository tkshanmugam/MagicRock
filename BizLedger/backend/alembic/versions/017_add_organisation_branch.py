"""add_organisation_branch

Revision ID: 017_add_organisation_branch
Revises: 016_add_organisation_bank_details
Create Date: 2026-01-28
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "017_add_organisation_branch"
down_revision = "016_add_organisation_bank_details"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("organisations", sa.Column("branch", sa.String(length=255), nullable=True))


def downgrade() -> None:
    op.drop_column("organisations", "branch")
