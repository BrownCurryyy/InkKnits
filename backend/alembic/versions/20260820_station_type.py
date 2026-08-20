"""Add explicit station types and migrate legacy names."""

from alembic import op
import sqlalchemy as sa

revision = "20260820_station_type"
down_revision = "20260820_ai_job_persistence"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    station_columns = {column["name"] for column in inspector.get_columns("stations")}
    if "station_type" not in station_columns:
        op.add_column("stations", sa.Column("station_type", sa.String(length=20), nullable=True))
    op.execute(
        """
        UPDATE stations
        SET station_type = CASE
            WHEN lower(name) LIKE '%writing%' THEN 'WRITING'
            WHEN lower(name) LIKE '%generation%' THEN 'GENERATION'
            WHEN lower(name) LIKE '%image%' OR lower(name) LIKE '%visual%' THEN 'IMAGE'
            ELSE 'VIEWING'
        END
        WHERE station_type IS NULL
        """
    )
    op.alter_column("stations", "station_type", nullable=False, server_default="VIEWING")


def downgrade() -> None:
    op.drop_column("stations", "station_type")