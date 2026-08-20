"""Retire Approval stations; approval workflow remains a project workflow."""

from alembic import op
import sqlalchemy as sa

revision = "20260820_remove_approval"
down_revision = "20260820_project_members"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        sa.text("UPDATE stations SET deleted_at = NOW() WHERE lower(name) LIKE '%approval%' AND deleted_at IS NULL")
    )


def downgrade() -> None:
    op.execute(
        sa.text("UPDATE stations SET deleted_at = NULL WHERE lower(name) LIKE '%approval%'")
    )