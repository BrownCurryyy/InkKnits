"""Persist AI job result and failure details.

Revision ID: 20260820_ai_job_persistence
Revises: 20260719_initial
"""
from alembic import op
import sqlalchemy as sa

revision = "20260820_ai_job_persistence"
down_revision = "20260719_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ai_jobs", sa.Column("result_data", sa.Text(), nullable=True))
    op.add_column("ai_jobs", sa.Column("error", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("ai_jobs", "error")
    op.drop_column("ai_jobs", "result_data")
