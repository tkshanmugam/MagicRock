"""Add RBAC system tables

Revision ID: 004_rbac_system
Revises: 003_organisations
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '004_rbac_system'
down_revision = '003_organisations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create organizations table
    op.create_table(
        'organizations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_organizations_id', 'organizations', ['id'], unique=False)
    op.create_index('ix_organizations_name', 'organizations', ['name'], unique=False)
    
    # Create roles table
    op.create_table(
        'roles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('name')
    )
    op.create_index('ix_roles_id', 'roles', ['id'], unique=False)
    op.create_index('ix_roles_name', 'roles', ['name'], unique=True)
    
    # Create modules table
    op.create_table(
        'modules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code')
    )
    op.create_index('ix_modules_id', 'modules', ['id'], unique=False)
    op.create_index('ix_modules_code', 'modules', ['code'], unique=True)
    
    # Create user_organizations table
    op.create_table(
        'user_organizations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'organization_id', name='uq_user_organization')
    )
    op.create_index('ix_user_organizations_id', 'user_organizations', ['id'], unique=False)
    op.create_index('ix_user_organizations_user_id', 'user_organizations', ['user_id'], unique=False)
    op.create_index('ix_user_organizations_organization_id', 'user_organizations', ['organization_id'], unique=False)
    op.create_index('ix_user_organizations_role_id', 'user_organizations', ['role_id'], unique=False)
    
    # Create organization_modules table
    op.create_table(
        'organization_modules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('organization_id', sa.Integer(), nullable=False),
        sa.Column('module_id', sa.Integer(), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id'], ),
        sa.ForeignKeyConstraint(['module_id'], ['modules.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'module_id', name='uq_organization_module')
    )
    op.create_index('ix_organization_modules_id', 'organization_modules', ['id'], unique=False)
    op.create_index('ix_organization_modules_organization_id', 'organization_modules', ['organization_id'], unique=False)
    op.create_index('ix_organization_modules_module_id', 'organization_modules', ['module_id'], unique=False)
    
    # Create role_module_permissions table
    op.create_table(
        'role_module_permissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('role_id', sa.Integer(), nullable=False),
        sa.Column('module_id', sa.Integer(), nullable=False),
        sa.Column('can_view', sa.Boolean(), nullable=False),
        sa.Column('can_create', sa.Boolean(), nullable=False),
        sa.Column('can_update', sa.Boolean(), nullable=False),
        sa.Column('can_delete', sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.ForeignKeyConstraint(['module_id'], ['modules.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('role_id', 'module_id', name='uq_role_module_permission')
    )
    op.create_index('ix_role_module_permissions_id', 'role_module_permissions', ['id'], unique=False)
    op.create_index('ix_role_module_permissions_role_id', 'role_module_permissions', ['role_id'], unique=False)
    op.create_index('ix_role_module_permissions_module_id', 'role_module_permissions', ['module_id'], unique=False)


def downgrade() -> None:
    # Drop role_module_permissions table
    op.drop_index('ix_role_module_permissions_module_id', table_name='role_module_permissions')
    op.drop_index('ix_role_module_permissions_role_id', table_name='role_module_permissions')
    op.drop_index('ix_role_module_permissions_id', table_name='role_module_permissions')
    op.drop_table('role_module_permissions')
    
    # Drop organization_modules table
    op.drop_index('ix_organization_modules_module_id', table_name='organization_modules')
    op.drop_index('ix_organization_modules_organization_id', table_name='organization_modules')
    op.drop_index('ix_organization_modules_id', table_name='organization_modules')
    op.drop_table('organization_modules')
    
    # Drop user_organizations table
    op.drop_index('ix_user_organizations_role_id', table_name='user_organizations')
    op.drop_index('ix_user_organizations_organization_id', table_name='user_organizations')
    op.drop_index('ix_user_organizations_user_id', table_name='user_organizations')
    op.drop_index('ix_user_organizations_id', table_name='user_organizations')
    op.drop_table('user_organizations')
    
    # Drop modules table
    op.drop_index('ix_modules_code', table_name='modules')
    op.drop_index('ix_modules_id', table_name='modules')
    op.drop_table('modules')
    
    # Drop roles table
    op.drop_index('ix_roles_name', table_name='roles')
    op.drop_index('ix_roles_id', table_name='roles')
    op.drop_table('roles')
    
    # Drop organizations table
    op.drop_index('ix_organizations_name', table_name='organizations')
    op.drop_index('ix_organizations_id', table_name='organizations')
    op.drop_table('organizations')
