"""Broaden default_particulars matching for organisations

Revision ID: 021_org_default_particulars_broaden
Revises: 020_org_default_particulars
Create Date: 2026-03-22

Re-runs default_particulars update with broader name matching
(%amman% instead of amman%) for orgs that may have been missed.
"""
from alembic import op
from sqlalchemy import text


revision = "021_org_default_particulars_broaden"
down_revision = "020_org_default_particulars"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        text("UPDATE organisations SET default_particulars = 'Coconut''s husk' WHERE LOWER(TRIM(name)) LIKE '%amman%' AND (default_particulars IS NULL OR default_particulars = '')")
    )
    conn.execute(
        text("UPDATE organisations SET default_particulars = 'Coconuts' WHERE (LOWER(TRIM(name)) LIKE '%jaswanth%' OR LOWER(TRIM(name)) LIKE '%jaswant%') AND (default_particulars IS NULL OR default_particulars = '')")
    )
    conn.execute(
        text("UPDATE organisations SET default_particulars = 'Coconut''s Shell' WHERE LOWER(TRIM(name)) LIKE '%kumaran%' AND (default_particulars IS NULL OR default_particulars = '')")
    )


def downgrade() -> None:
    pass
