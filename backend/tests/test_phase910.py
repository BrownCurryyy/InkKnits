import unittest
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.database.base import Base
from backend.models.approval_task import ApprovalTask
from backend.services.ai_scheduler import AIScheduler
from backend.services.approval_service import ApprovalService


class Phase910Tests(unittest.TestCase):
    def test_auto_escalation_marks_overdue_tasks(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)

        with Session(engine) as session:
            task = ApprovalTask(
                asset_id=uuid4(),
                assigned_to=uuid4(),
                assigned_by=uuid4(),
                status="PENDING",
                deadline=datetime.now(timezone.utc) - timedelta(minutes=5),
                created_at=datetime.now(timezone.utc),
            )
            session.add(task)
            session.commit()
            session.refresh(task)

            escalated_ids = ApprovalService.escalate_overdue(session, now=datetime.now(timezone.utc))
            session.refresh(task)

            self.assertEqual(task.status, "ESCALATED")
            self.assertEqual(escalated_ids, [task.id])

    def test_scheduler_cancel_marks_job_cancelled(self) -> None:
        scheduler = AIScheduler()
        job = scheduler.submit("TEXT", {"prompt": "demo"})

        self.assertTrue(scheduler.cancel(job.task_id))
        self.assertEqual(scheduler.get_job(job.task_id).status, "CANCELLED")


if __name__ == "__main__":
    unittest.main()
