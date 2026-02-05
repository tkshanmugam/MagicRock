"""Add organisations table

Revision ID: 003_organisations
Revises: 002_refresh_tokens
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '003_organisations'
down_revision = '002_refresh_tokens'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create organisations table
    op.create_table(
        'organisations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('is_valid', sa.Boolean(), nullable=False),
        sa.Column('created_date', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('modified_by', sa.Integer(), nullable=True),
        sa.Column('modified_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['modified_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_organisations_id', 'organisations', ['id'], unique=False)
    op.create_index('ix_organisations_name', 'organisations', ['name'], unique=False)
    op.create_index('ix_organisations_created_by', 'organisations', ['created_by'], unique=False)
    op.create_index('ix_organisations_modified_by', 'organisations', ['modified_by'], unique=False)


def downgrade() -> None:
    # Drop organisations table
    op.drop_index('ix_organisations_modified_by', table_name='organisations')
    op.drop_index('ix_organisations_created_by', table_name='organisations')
    op.drop_index('ix_organisations_name', table_name='organisations')
    op.drop_index('ix_organisations_id', table_name='organisations')
    op.drop_table('organisations')
