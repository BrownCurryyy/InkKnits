"""Enforce one canonical station of each type per project."""

from alembic import op
import sqlalchemy as sa

revision = "20260821_fixed_stations"
down_revision = "20260821_compute_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "station_type" in {column["name"] for column in inspector.get_columns("stations")}:
        bind.execute(sa.text("UPDATE stations SET deleted_at = NOW() WHERE station_type NOT IN ('WRITING','VIEWING','GENERATION','IMAGE') AND deleted_at IS NULL"))
    constraints = {constraint.get("name") for constraint in inspector.get_unique_constraints("stations")}
    if "uq_project_station_type" not in constraints:
        op.create_unique_constraint("uq_project_station_type", "stations", ["project_id", "station_type"])


def downgrade() -> None:
    op.drop_constraint("uq_project_station_type", "stations", type_="unique")
