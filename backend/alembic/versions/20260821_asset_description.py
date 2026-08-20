"""Add human-facing asset descriptions."""

from alembic import op
import sqlalchemy as sa

revision = "20260821_asset_description"
down_revision = "20260820_remove_approval"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if "description" not in {column["name"] for column in sa.inspect(op.get_bind()).get_columns("assets")}:
        op.add_column("assets", sa.Column("description", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("assets", "description")