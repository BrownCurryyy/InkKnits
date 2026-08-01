"""
ActivityService — append-only audit trail logger.

Rules (from RULES.md §6):
  - Activity logs are immutable.
  - Activities record user and system events only.
  - Activities never store asset contents.
  - Activities are append-only.
"""

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from backend.models.activity import Activity


class ActivityService:
    """Provides a single static method to record an audit event."""

    @staticmethod
    def log(
        db: Session,
        activity_type: str,
        description: str,
        organization_id: UUID | None = None,
        project_id: UUID | None = None,
        asset_id: UUID | None = None,
        user_id: UUID | None = None,
        raw_metadata: dict | None = None,
    ) -> Activity:
        """
        Append an immutable activity record.

        Common activity_type values:
          LOGIN, LOGOUT, ASSET_CREATED, ASSET_UPDATED, ASSET_OPENED,
          AI_GENERATED, IMAGE_GENERATED, APPROVAL, PUBLICATION,
          ASSIGNMENT, ESCALATION, DELETION, RESTORE
        """
        activity = Activity(
            organization_id=organization_id,
            project_id=project_id,
            asset_id=asset_id,
            user_id=user_id,
            activity_type=activity_type,
            description=description,
            raw_metadata=raw_metadata,
            created_at=datetime.now(timezone.utc),
        )
        db.add(activity)
        db.commit()
        db.refresh(activity)
        return activity
