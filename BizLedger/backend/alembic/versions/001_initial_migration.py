"""Initial migration: create tables and seed super admin

Revision ID: 001_initial
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text
from passlib.context import CryptContext
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

# Import settings and models
from app.core.config import settings
from app.models.user import UserRole

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def truncate_password_to_72_bytes(password: str) -> str:
    """Truncate password to exactly 72 bytes or less for bcrypt compatibility.
    
    This function ensures the password, when encoded to UTF-8, is <= 72 bytes.
    It handles UTF-8 encoding safely to avoid cutting multi-byte characters incorrectly.
    """
    password_bytes = password.encode('utf-8')
    if len(password_bytes) <= 72:
        return password
    
    # Truncate to 72 bytes
    truncated_bytes = password_bytes[:72]
    
    # Decode back to string, handling any incomplete UTF-8 sequences
    # If we cut in the middle of a multi-byte character, decode will handle it
    password = truncated_bytes.decode('utf-8', errors='ignore')
    
    # Final safety check: re-encode and ensure it's still <= 72 bytes
    # This handles edge cases where decoding might add replacement characters
    final_bytes = password.encode('utf-8')
    if len(final_bytes) > 72:
        # If somehow still too long, truncate again (shouldn't happen, but be safe)
        password = final_bytes[:72].decode('utf-8', errors='ignore')
    
    return password

# revision identifiers, used by Alembic.
revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create UserRole enum type
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE userrole AS ENUM ('SUPER_ADMIN', 'ADMIN', 'USER');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Create AuditAction enum type
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE auditaction AS ENUM (
                'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'USER_CREATED', 
                'USER_UPDATED', 'USER_DELETED', 'ROLE_CHANGED', 
                'CONFIG_CHANGED', 'SUPER_ADMIN_ACTION'
            );
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Create AuditStatus enum type
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE auditstatus AS ENUM ('SUCCESS', 'FAILURE');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(length=50), nullable=False),
        sa.Column('email', sa.String(length=100), nullable=False),
        sa.Column('hashed_password', sa.String(length=255), nullable=False),
        sa.Column('full_name', sa.String(length=100), nullable=True),
        sa.Column('role', postgresql.ENUM('SUPER_ADMIN', 'ADMIN', 'USER', name='userrole', create_type=False), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_id', 'users', ['id'], unique=False)
    op.create_index('ix_users_username', 'users', ['username'], unique=True)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    
    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', postgresql.ENUM(
            'LOGIN_SUCCESS', 'LOGIN_FAILURE', 'USER_CREATED', 
            'USER_UPDATED', 'USER_DELETED', 'ROLE_CHANGED', 
            'CONFIG_CHANGED', 'SUPER_ADMIN_ACTION',
            name='auditaction', create_type=False
        ), nullable=False),
        sa.Column('entity', sa.String(length=50), nullable=True),
        sa.Column('entity_id', sa.String(length=50), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('status', postgresql.ENUM('SUCCESS', 'FAILURE', name='auditstatus', create_type=False), nullable=False),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_audit_logs_id', 'audit_logs', ['id'], unique=False)
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'], unique=False)
    op.create_index('ix_audit_logs_action', 'audit_logs', ['action'], unique=False)
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'], unique=False)
    
    # Seed super admin user (idempotent)
    connection = op.get_bind()
    
    # Check if super admin already exists
    result = connection.execute(
        text("SELECT COUNT(*) FROM users WHERE username = :username"),
        {"username": settings.SUPER_ADMIN_USERNAME}
    )
    count = result.scalar()
    
    if count == 0:
        # Hash password (bcrypt has 72-byte limit, truncate if necessary)
        # Use helper function to ensure password is <= 72 bytes
        truncated_password = truncate_password_to_72_bytes(settings.SUPER_ADMIN_PASSWORD)
        
        # Verify the password is actually <= 72 bytes (safety check)
        assert len(truncated_password.encode('utf-8')) <= 72, "Password still too long after truncation"
        
        # Hash the truncated password
        hashed_password = pwd_context.hash(truncated_password)
        
        # Insert super admin
        connection.execute(
            text("""
                INSERT INTO users (username, email, hashed_password, full_name, role, is_active)
                VALUES (:username, :email, :hashed_password, :full_name, :role, :is_active)
            """),
            {
                "username": settings.SUPER_ADMIN_USERNAME,
                "email": settings.SUPER_ADMIN_EMAIL,
                "hashed_password": hashed_password,
                "full_name": "Super Administrator",
                "role": UserRole.SUPER_ADMIN.value,
                "is_active": True
            }
        )
        print(f"✓ Super admin user '{settings.SUPER_ADMIN_USERNAME}' created successfully.")
    else:
        print(f"✓ Super admin user '{settings.SUPER_ADMIN_USERNAME}' already exists. Skipping creation.")


def downgrade() -> None:
    # Drop tables
    op.drop_index('ix_audit_logs_created_at', table_name='audit_logs')
    op.drop_index('ix_audit_logs_action', table_name='audit_logs')
    op.drop_index('ix_audit_logs_user_id', table_name='audit_logs')
    op.drop_index('ix_audit_logs_id', table_name='audit_logs')
    op.drop_table('audit_logs')
    
    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_index('ix_users_id', table_name='users')
    op.drop_table('users')
    
    # Drop enum types
    op.execute("DROP TYPE IF EXISTS auditstatus")
    op.execute("DROP TYPE IF EXISTS auditaction")
    op.execute("DROP TYPE IF EXISTS userrole")

