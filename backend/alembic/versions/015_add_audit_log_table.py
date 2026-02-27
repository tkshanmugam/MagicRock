"""add_audit_log_table

Revision ID: 015_add_audit_log_table
Revises: 014_add_organisation_logo
Create Date: 2026-01-26
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "015_add_audit_log_table"
down_revision = "014_add_organisation_logo"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "audit_log",
        sa.Column("id", sa.BigInteger(), primary_key=True),
        sa.Column("organisation_id", sa.BigInteger(), sa.ForeignKey("organisations.id"), nullable=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("module_name", sa.String(length=100), nullable=False),
        sa.Column("entity_name", sa.String(length=100), nullable=True),
        sa.Column("entity_id", sa.BigInteger(), nullable=True),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("old_value", sa.JSON(), nullable=True),
        sa.Column("new_value", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.Text(), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("created_date", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_audit_log_id", "audit_log", ["id"])
    op.create_index("ix_audit_log_organisation_id", "audit_log", ["organisation_id"])
    op.create_index("ix_audit_log_user_id", "audit_log", ["user_id"])
    op.create_index("ix_audit_log_module_name", "audit_log", ["module_name"])
    op.create_index("ix_audit_log_entity_name", "audit_log", ["entity_name"])
    op.create_index("ix_audit_log_entity_id", "audit_log", ["entity_id"])
    op.create_index("ix_audit_log_action", "audit_log", ["action"])
    op.create_index("ix_audit_log_created_date", "audit_log", ["created_date"])


def downgrade() -> None:
    op.drop_index("ix_audit_log_created_date", table_name="audit_log")
    op.drop_index("ix_audit_log_action", table_name="audit_log")
    op.drop_index("ix_audit_log_entity_id", table_name="audit_log")
    op.drop_index("ix_audit_log_entity_name", table_name="audit_log")
    op.drop_index("ix_audit_log_module_name", table_name="audit_log")
    op.drop_index("ix_audit_log_user_id", table_name="audit_log")
    op.drop_index("ix_audit_log_organisation_id", table_name="audit_log")
    op.drop_index("ix_audit_log_id", table_name="audit_log")
    op.drop_table("audit_log")
