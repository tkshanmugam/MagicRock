"""Remove role column from users table

Revision ID: 005_remove_role
Revises: 004_rbac_system
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '005_remove_role'
down_revision = '004_rbac_system'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the role column from users table
    op.drop_column('users', 'role')
    
    # Drop the UserRole enum type if it exists (only if no other tables use it)
    # Note: This will fail if the enum is used elsewhere, so we'll catch and ignore
    try:
        op.execute("DROP TYPE IF EXISTS userrole")
    except Exception:
        # Enum might be used elsewhere or already dropped
        pass


def downgrade() -> None:
    # Recreate the UserRole enum type
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE userrole AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Add the role column back with default value
    op.add_column('users', sa.Column('role', postgresql.ENUM('SUPER_ADMIN', 'ADMIN', 'USER', name='userrole', create_type=False), nullable=False, server_default='USER'))
