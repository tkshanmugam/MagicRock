"""Fix legacy organizations table references.

Revision ID: 010_fix_organization_table_refs
Revises: 009_replace_organizations_table
Create Date: 2026-01-21 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "010_fix_organization_table_refs"
down_revision = "009_replace_organizations_table"
branch_labels = None
depends_on = None


def _has_table(inspector: sa.Inspector, table_name: str) -> bool:
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if _has_table(inspector, "organization_modules"):
        for fk in inspector.get_foreign_keys("organization_modules"):
            if fk.get("name"):
                op.drop_constraint(fk["name"], "organization_modules", type_="foreignkey")
        op.drop_table("organization_modules")

    if _has_table(inspector, "user_organizations"):
        fks = inspector.get_foreign_keys("user_organizations")
        fk_to_organizations = [fk for fk in fks if fk.get("referred_table") == "organizations"]
        has_organisations_fk = any(fk.get("referred_table") == "organisations" for fk in fks)

        for fk in fk_to_organizations:
            if fk.get("name"):
                op.drop_constraint(fk["name"], "user_organizations", type_="foreignkey")

        if not has_organisations_fk:
            op.create_foreign_key(
                "user_organizations_organisation_id_fkey",
                "user_organizations",
                "organisations",
                ["organization_id"],
                ["id"],
            )

        unique_constraints = inspector.get_unique_constraints("user_organizations")
        has_new_name = any(uq.get("name") == "uq_user_organisation" for uq in unique_constraints)
        if not has_new_name:
            for uq in unique_constraints:
                if uq.get("name") == "uq_user_organization":
                    op.drop_constraint("uq_user_organization", "user_organizations", type_="unique")
                    op.create_unique_constraint(
                        "uq_user_organisation",
                        "user_organizations",
                        ["user_id", "organization_id"],
                    )
                    break

    if _has_table(inspector, "organizations"):
        op.drop_table("organizations")


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    if not _has_table(inspector, "organizations"):
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

    if _has_table(inspector, "user_organizations"):
        fks = inspector.get_foreign_keys("user_organizations")
        fk_to_organisations = [fk for fk in fks if fk.get("referred_table") == "organisations"]

        for fk in fk_to_organisations:
            if fk.get("name"):
                op.drop_constraint(fk["name"], "user_organizations", type_="foreignkey")

        if not any(fk.get("referred_table") == "organizations" for fk in fks):
            op.create_foreign_key(
                "user_organizations_organization_id_fkey",
                "user_organizations",
                "organizations",
                ["organization_id"],
                ["id"],
            )

        unique_constraints = inspector.get_unique_constraints("user_organizations")
        has_old_name = any(uq.get("name") == "uq_user_organization" for uq in unique_constraints)
        if not has_old_name:
            for uq in unique_constraints:
                if uq.get("name") == "uq_user_organisation":
                    op.drop_constraint("uq_user_organisation", "user_organizations", type_="unique")
                    op.create_unique_constraint(
                        "uq_user_organization",
                        "user_organizations",
                        ["user_id", "organization_id"],
                    )
                    break
