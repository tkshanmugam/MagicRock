"""Replace organizations table with organisations references

Revision ID: 009_replace_organizations_table
Revises: 008_add_purchase_voucher_org_id
Create Date: 2026-01-20 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "009_replace_organizations_table"
down_revision = "008_add_purchase_voucher_org_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if not inspector.has_table("organizations"):
        # Migration already applied or organizations table was removed manually.
        return

    if inspector.has_table("user_organizations"):
        conn.execute(
            sa.text("ALTER TABLE user_organizations DROP CONSTRAINT IF EXISTS uq_user_organization")
        )

    if inspector.has_table("organization_modules"):
        conn.execute(
            sa.text("ALTER TABLE organization_modules DROP CONSTRAINT IF EXISTS uq_organization_module")
        )

    op.create_table(
        "user_organizations_tmp",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organisations.id"]),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "organization_id", name="uq_user_organization"),
    )

    op.create_table(
        "organization_modules_tmp",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("module_id", sa.Integer(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organisations.id"]),
        sa.ForeignKeyConstraint(["module_id"], ["modules.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "module_id", name="uq_organization_module"),
    )

    org_rows = conn.execute(sa.text("SELECT id, name FROM organizations")).fetchall()
    legacy_rows = conn.execute(sa.text("SELECT id, name FROM organisations")).fetchall()
    name_to_legacy = {row.name: row.id for row in legacy_rows}
    org_id_map = {row.id: name_to_legacy.get(row.name) for row in org_rows}

    user_org_rows = conn.execute(
        sa.text("SELECT id, user_id, organization_id, role_id, status FROM user_organizations")
    ).fetchall()
    for row in user_org_rows:
        new_org_id = org_id_map.get(row.organization_id)
        if new_org_id is None:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO user_organizations_tmp (id, user_id, organization_id, role_id, status) "
                "VALUES (:id, :user_id, :organization_id, :role_id, :status)"
            ),
            {
                "id": row.id,
                "user_id": row.user_id,
                "organization_id": new_org_id,
                "role_id": row.role_id,
                "status": row.status,
            },
        )

    org_module_rows = conn.execute(
        sa.text("SELECT id, organization_id, module_id, is_enabled FROM organization_modules")
    ).fetchall()
    for row in org_module_rows:
        new_org_id = org_id_map.get(row.organization_id)
        if new_org_id is None:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO organization_modules_tmp (id, organization_id, module_id, is_enabled) "
                "VALUES (:id, :organization_id, :module_id, :is_enabled)"
            ),
            {
                "id": row.id,
                "organization_id": new_org_id,
                "module_id": row.module_id,
                "is_enabled": row.is_enabled,
            },
        )

    op.drop_table("organization_modules")
    op.drop_table("user_organizations")
    op.drop_table("organizations")

    op.rename_table("user_organizations_tmp", "user_organizations")
    op.rename_table("organization_modules_tmp", "organization_modules")

    op.create_index("ix_user_organizations_id", "user_organizations", ["id"], unique=False)
    op.create_index("ix_user_organizations_user_id", "user_organizations", ["user_id"], unique=False)
    op.create_index("ix_user_organizations_organization_id", "user_organizations", ["organization_id"], unique=False)
    op.create_index("ix_user_organizations_role_id", "user_organizations", ["role_id"], unique=False)

    op.create_index("ix_organization_modules_id", "organization_modules", ["id"], unique=False)
    op.create_index("ix_organization_modules_organization_id", "organization_modules", ["organization_id"], unique=False)
    op.create_index("ix_organization_modules_module_id", "organization_modules", ["module_id"], unique=False)


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if inspector.has_table("user_organizations"):
        conn.execute(
            sa.text("ALTER TABLE user_organizations DROP CONSTRAINT IF EXISTS uq_user_organization")
        )

    if inspector.has_table("organization_modules"):
        conn.execute(
            sa.text("ALTER TABLE organization_modules DROP CONSTRAINT IF EXISTS uq_organization_module")
        )

    op.create_table(
        "organizations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_organizations_id", "organizations", ["id"], unique=False)
    op.create_index("ix_organizations_name", "organizations", ["name"], unique=False)

    legacy_rows = conn.execute(sa.text("SELECT id, name, is_valid FROM organisations")).fetchall()
    name_to_new = {}
    for row in legacy_rows:
        result = conn.execute(
            sa.text("INSERT INTO organizations (name, status) VALUES (:name, :status) RETURNING id"),
            {"name": row.name, "status": "active" if row.is_valid else "inactive"},
        )
        new_id = result.scalar_one()
        name_to_new[row.name] = new_id

    op.create_table(
        "user_organizations_tmp",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "organization_id", name="uq_user_organization"),
    )

    op.create_table(
        "organization_modules_tmp",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("organization_id", sa.Integer(), nullable=False),
        sa.Column("module_id", sa.Integer(), nullable=False),
        sa.Column("is_enabled", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"]),
        sa.ForeignKeyConstraint(["module_id"], ["modules.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("organization_id", "module_id", name="uq_organization_module"),
    )

    user_org_rows = conn.execute(
        sa.text(
            "SELECT uo.id, uo.user_id, uo.organization_id, uo.role_id, uo.status, o.name "
            "FROM user_organizations uo JOIN organisations o ON o.id = uo.organization_id"
        )
    ).fetchall()
    for row in user_org_rows:
        new_org_id = name_to_new.get(row.name)
        if new_org_id is None:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO user_organizations_tmp (id, user_id, organization_id, role_id, status) "
                "VALUES (:id, :user_id, :organization_id, :role_id, :status)"
            ),
            {
                "id": row.id,
                "user_id": row.user_id,
                "organization_id": new_org_id,
                "role_id": row.role_id,
                "status": row.status,
            },
        )

    org_module_rows = conn.execute(
        sa.text(
            "SELECT om.id, om.organization_id, om.module_id, om.is_enabled, o.name "
            "FROM organization_modules om JOIN organisations o ON o.id = om.organization_id"
        )
    ).fetchall()
    for row in org_module_rows:
        new_org_id = name_to_new.get(row.name)
        if new_org_id is None:
            continue
        conn.execute(
            sa.text(
                "INSERT INTO organization_modules_tmp (id, organization_id, module_id, is_enabled) "
                "VALUES (:id, :organization_id, :module_id, :is_enabled)"
            ),
            {
                "id": row.id,
                "organization_id": new_org_id,
                "module_id": row.module_id,
                "is_enabled": row.is_enabled,
            },
        )

    op.drop_table("organization_modules")
    op.drop_table("user_organizations")

    op.rename_table("user_organizations_tmp", "user_organizations")
    op.rename_table("organization_modules_tmp", "organization_modules")

    op.create_index("ix_user_organizations_id", "user_organizations", ["id"], unique=False)
    op.create_index("ix_user_organizations_user_id", "user_organizations", ["user_id"], unique=False)
    op.create_index("ix_user_organizations_organization_id", "user_organizations", ["organization_id"], unique=False)
    op.create_index("ix_user_organizations_role_id", "user_organizations", ["role_id"], unique=False)

    op.create_index("ix_organization_modules_id", "organization_modules", ["id"], unique=False)
    op.create_index("ix_organization_modules_organization_id", "organization_modules", ["organization_id"], unique=False)
    op.create_index("ix_organization_modules_module_id", "organization_modules", ["module_id"], unique=False)
