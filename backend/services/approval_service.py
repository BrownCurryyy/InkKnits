from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from backend.models.approval_task import ApprovalTask
from backend.services.activity_service import ActivityService


class ApprovalService:
    @staticmethod
    def escalate_overdue(db: Session, now: datetime | None = None) -> list[UUID]:
        """Mark overdue approval tasks as escalated and return their IDs."""
        reference_time = now or datetime.now(timezone.utc)
        overdue = (
            db.query(ApprovalTask)
            .filter(
                ApprovalTask.status == "PENDING",
                ApprovalTask.deadline.isnot(None),
                ApprovalTask.deadline < reference_time,
            )
            .all()
        )

        escalated_ids: list[UUID] = []
        for task in overdue:
            task.status = "ESCALATED"
            task.completed_at = reference_time
            escalated_ids.append(task.id)
            ActivityService.log(
                db,
                "ESCALATION",
                f"Approval task {task.id} auto-escalated past deadline",
                asset_id=task.asset_id,
                user_id=task.assigned_to,
            )

        db.commit()
        return escalated_ids
