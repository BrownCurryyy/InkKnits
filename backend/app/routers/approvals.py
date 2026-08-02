"""
Approval workflow router.

Endpoints:
  POST   /approvals/tasks                     — Assign an approval task
  GET    /approvals/tasks                     — List approval tasks
  GET    /approvals/tasks/{task_id}           — Get a single task
  POST   /approvals/tasks/{task_id}/approve   — Approve a task
  POST   /approvals/tasks/{task_id}/reject    — Reject a task
  PATCH  /approvals/tasks/{task_id}/comment   — Add or update comments
  POST   /approvals/tasks/{task_id}/escalate  — Escalate a task
  POST   /approvals/escalate                  — Run escalation sweep (manual trigger)
"""

from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.routers.auth import get_current_user
from backend.app.schemas import ApprovalTaskCreate, ApprovalTaskOut
from backend.database.connection import get_db
from backend.models.approval_task import ApprovalTask
from backend.models.asset import Asset
from backend.models.user import User
from backend.repositories.approval_task_repository import ApprovalTaskRepository
from backend.services.activity_service import ActivityService
from backend.services.approval_service import ApprovalService

router = APIRouter(prefix="/approvals", tags=["approvals"], dependencies=[Depends(get_current_user)])


# ---------------------------------------------------------------------------
# Request schemas local to this router
# ---------------------------------------------------------------------------

class CommentUpdate(BaseModel):
    comments: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def parse_uuid(value: str, field_name: str) -> UUID:
    try:
        return UUID(value)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Invalid {field_name} format")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/tasks", response_model=ApprovalTaskOut, status_code=status.HTTP_201_CREATED)
async def assign_approval(
    payload: ApprovalTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ApprovalTaskOut:
    """Assign an approval task to a reviewer for a specific asset."""
    asset = db.get(Asset, payload.asset_id)
    if not asset or asset.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    now = datetime.now(timezone.utc)
    task = ApprovalTask(
        asset_id=payload.asset_id,
        assigned_to=payload.assigned_to,
        assigned_by=current_user.id,
        status="PENDING",
        deadline=payload.deadline,
        comments=payload.comments,
        created_at=now,
    )
    repository = ApprovalTaskRepository(db)
    created = repository.create(task)

    ActivityService.log(
        db,
        "ASSIGNMENT",
        f"Approval task assigned for asset '{asset.name}'",
        organization_id=asset.organization_id,
        asset_id=asset.id,
        user_id=current_user.id,
    )
    return ApprovalTaskOut.model_validate(created)


@router.get("/tasks", response_model=list[ApprovalTaskOut])
async def list_approvals(db: Session = Depends(get_db)) -> list[ApprovalTaskOut]:
    """List all approval tasks."""
    repository = ApprovalTaskRepository(db)
    tasks = repository.list_all()
    return [ApprovalTaskOut.model_validate(t) for t in tasks]


@router.get("/tasks/{task_id}", response_model=ApprovalTaskOut)
async def get_approval(task_id: str, db: Session = Depends(get_db)) -> ApprovalTaskOut:
    """Get a single approval task by ID."""
    task_uuid = parse_uuid(task_id, "task_id")
    repository = ApprovalTaskRepository(db)
    task = repository.get_by_id(task_uuid)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval task not found")
    return ApprovalTaskOut.model_validate(task)


@router.post("/tasks/{task_id}/approve", response_model=ApprovalTaskOut)
async def approve_task(task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ApprovalTaskOut:
    """Approve the asset linked to this approval task."""
    task_uuid = parse_uuid(task_id, "task_id")
    repository = ApprovalTaskRepository(db)
    task = repository.get_by_id(task_uuid)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval task not found")
    if task.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot approve a task with status '{task.status}'")

    task.status = "APPROVED"
    task.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)

    ActivityService.log(
        db,
        "APPROVAL",
        f"Asset approved via task {task_id}",
        asset_id=task.asset_id,
        user_id=current_user.id,
    )
    return ApprovalTaskOut.model_validate(task)


@router.post("/tasks/{task_id}/reject", response_model=ApprovalTaskOut)
async def reject_task(task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ApprovalTaskOut:
    """Reject the asset linked to this approval task."""
    task_uuid = parse_uuid(task_id, "task_id")
    repository = ApprovalTaskRepository(db)
    task = repository.get_by_id(task_uuid)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval task not found")
    if task.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot reject a task with status '{task.status}'")

    task.status = "REJECTED"
    task.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)

    ActivityService.log(
        db,
        "APPROVAL",
        f"Asset rejected via task {task_id}",
        asset_id=task.asset_id,
        user_id=current_user.id,
    )
    return ApprovalTaskOut.model_validate(task)


@router.post("/tasks/{task_id}/comment", response_model=ApprovalTaskOut)
async def update_comment(task_id: str, payload: CommentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ApprovalTaskOut:
    """Add or update a comment on an approval task."""
    task_uuid = parse_uuid(task_id, "task_id")
    repository = ApprovalTaskRepository(db)
    task = repository.get_by_id(task_uuid)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval task not found")

    task.comments = payload.comments
    db.commit()
    db.refresh(task)
    return ApprovalTaskOut.model_validate(task)


@router.post("/tasks/{task_id}/escalate", response_model=ApprovalTaskOut)
async def escalate_task(task_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> ApprovalTaskOut:
    """Escalate the approval task to a higher-review state."""
    task_uuid = parse_uuid(task_id, "task_id")
    repository = ApprovalTaskRepository(db)
    task = repository.get_by_id(task_uuid)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Approval task not found")
    if task.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Cannot escalate a task with status '{task.status}'")

    task.status = "ESCALATED"
    task.escalated_to = current_user.id
    task.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(task)

    ActivityService.log(
        db,
        "ESCALATION",
        f"Approval task {task_id} escalated",
        asset_id=task.asset_id,
        user_id=current_user.id,
    )
    return ApprovalTaskOut.model_validate(task)


@router.post("/escalate", response_model=dict)
async def escalate_overdue(db: Session = Depends(get_db)) -> dict:
    """
    Manual trigger for the auto-escalation sweep.
    Finds all PENDING tasks past their deadline and marks them ESCALATED.
    """
    now = datetime.now(timezone.utc)
    escalated_ids = ApprovalService.escalate_overdue(db, now=now)
    return {"escalated_count": len(escalated_ids), "task_ids": [str(task_id) for task_id in escalated_ids]}
