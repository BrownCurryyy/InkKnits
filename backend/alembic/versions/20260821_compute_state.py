"""Use computed production state instead of persistent bundle tables."""

from alembic import op
import sqlalchemy as sa

revision = "20260821_compute_state"
down_revision = "20260821_asset_description"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("version_bundle_items"):
        op.drop_table("version_bundle_items")
    if inspector.has_table("version_bundles"):
        op.drop_table("version_bundles")


def downgrade() -> None:
    pass
