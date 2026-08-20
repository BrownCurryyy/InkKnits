"""Asynchronous AI job submission and polling endpoints."""

import json
from datetime import datetime, timezone
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.routers.auth import get_current_user
from backend.app.auth import can_access_station, get_user_roles, require_roles
from backend.app.schemas import AIJobQueueOut, AIJobStatus, AIJobSubmit
from backend.database.connection import get_db
from backend.models.ai_job import AIJob as PersistedAIJob
from backend.models.asset import Asset
from backend.models.user import User
from backend.services.activity_service import ActivityService
from backend.services.ai_scheduler import JOB_TYPE_TO_PRIORITY, scheduler
from backend.services.comfyui_service import ComfyUIService

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[Depends(get_current_user)])


def _validate_payload(payload: AIJobSubmit, db: Session) -> None:
    if payload.job_type == "ATOMIZE":
        if payload.asset_id is None or not payload.formats:
            raise HTTPException(422, "Atomization requires asset_id and at least one output format")
        parent = db.get(Asset, payload.asset_id)
        if parent is None or parent.deleted_at is not None:
            raise HTTPException(404, "Parent asset not found")
        if not parent.content:
            raise HTTPException(422, "Parent asset has no text content to atomize")
        if payload.organization_id is None:
            payload.organization_id = parent.organization_id
        if payload.station_id is None:
            payload.station_id = parent.station_id
        payload.draft = parent.content

    if payload.job_type == "IMAGE" and (payload.organization_id is None or payload.station_id is None):
        raise HTTPException(422, "Image generation requires organization_id and station_id")


def _job_is_visible(job: PersistedAIJob, db: Session, current_user: User) -> bool:
    if job.organization_id != current_user.organization_id:
        return False
    roles = {role.upper() for role in get_user_roles(db, current_user)}
    if "ADMIN" in roles:
        return True
    if job.created_by == current_user.id:
        return True
    return job.station_id is not None and can_access_station(db, current_user, job.station_id)


def _queue_item(job: PersistedAIJob, db: Session) -> AIJobQueueOut:
    project_id = None
    if job.station_id is not None:
        from backend.models.station import Station

        station = db.get(Station, job.station_id)
        project_id = station.project_id if station else None

    result = None
    if job.result_data:
        try:
            result = json.loads(job.result_data)
        except json.JSONDecodeError:
            result = {"raw": job.result_data}

    return AIJobQueueOut(
        task_id=job.id,
        job_type=job.job_type,
        project_id=project_id,
        station_id=job.station_id,
        asset_id=job.asset_id,
        created_by=job.created_by,
        priority=job.priority,
        status=job.status,
        queue_position=job.queue_position,
        model=job.model,
        prompt=job.prompt,
        result=result,
        result_available=bool(job.result_data or job.result_asset),
        error=job.error,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
    )


@router.post("/jobs", response_model=AIJobStatus, status_code=status.HTTP_202_ACCEPTED)
async def submit_job(
    payload: AIJobSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AIJobStatus:
    """Create one durable job record, enqueue it, and return its task ID immediately."""
    require_roles(get_user_roles(db, current_user), ("EDITOR", "ADMIN"))
    if payload.created_by is not None and payload.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="created_by must match the authenticated user")
    if payload.asset_id is not None:
        asset = db.get(Asset, payload.asset_id)
        if not asset or asset.deleted_at is not None or asset.organization_id != current_user.organization_id or not can_access_station(db, current_user, asset.station_id):
            raise HTTPException(status_code=404, detail="Asset not found")
        payload.organization_id = asset.organization_id
        payload.station_id = asset.station_id
    elif payload.organization_id is not None and payload.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Organization access denied")
    if payload.station_id is not None and not can_access_station(db, current_user, payload.station_id):
        raise HTTPException(status_code=404, detail="Station not found")
    payload.organization_id = current_user.organization_id
    if payload.job_type == "IMAGE":
        from backend.models.station import Station

        station = db.get(Station, payload.station_id)
        if station is None:
            raise HTTPException(status_code=404, detail="Station not found")
        runtime_project_id = station.project_id
    else:
        runtime_project_id = None
    payload.created_by = current_user.id
    _validate_payload(payload, db)
    task_id = uuid4()
    now = datetime.now(timezone.utc)
    job_type = payload.job_type.upper()
    persisted = PersistedAIJob(
        id=task_id,
        asset_id=payload.asset_id,
        organization_id=payload.organization_id,
        station_id=payload.station_id,
        created_by=current_user.id,
        job_type=job_type,
        priority=int(JOB_TYPE_TO_PRIORITY[job_type]),
        status="QUEUED",
        model=payload.model,
        prompt=payload.prompt,
        parameters=json.dumps(payload.model_dump(mode="json"), default=str),
        created_at=now,
    )
    db.add(persisted)
    db.commit()

    activity_type = "IMAGE_GENERATED" if job_type == "IMAGE" else "AI_GENERATED"
    ActivityService.log(
        db,
        activity_type,
        f"{job_type.title()} job queued",
        organization_id=payload.organization_id,
        asset_id=payload.asset_id,
        user_id=current_user.id,
        raw_metadata={"job_type": job_type, "task_id": str(task_id)},
    )

    runtime_payload = payload.model_dump(mode="json")
    if runtime_project_id is not None:
        runtime_payload["project_id"] = str(runtime_project_id)
    runtime_payload["created_by"] = str(current_user.id)
    if job_type == "ATOMIZE":
        runtime_payload["parent_content"] = runtime_payload["draft"]
    if job_type == "IMAGE":
        runtime_payload["output_asset_id"] = str(uuid4())

    job = scheduler.submit(job_type, runtime_payload, task_id=str(task_id))
    return AIJobStatus(task_id=task_id, **{key: value for key, value in job.to_dict().items() if key != "task_id"})


@router.get("/jobs/{task_id}", response_model=AIJobStatus)
async def get_job(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AIJobStatus:
    """Poll a job's live in-memory status; completed jobs remain available in PostgreSQL."""
    persisted = db.get(PersistedAIJob, task_id)
    if persisted is None or not _job_is_visible(persisted, db, current_user):
        raise HTTPException(status_code=404, detail="AI job not found")

    job = scheduler.get_job(str(task_id))
    if job is not None:
        return AIJobStatus(task_id=task_id, **{key: value for key, value in job.to_dict().items() if key != "task_id"})

    result = None
    if persisted.result_data:
        try:
            result = json.loads(persisted.result_data)
        except json.JSONDecodeError:
            result = {"raw": persisted.result_data}
    elif persisted.result_asset:
        result = {"asset_ids": json.loads(persisted.result_asset)}

    return AIJobStatus(
        task_id=task_id,
        job_type=persisted.job_type,
        priority=persisted.priority,
        status=persisted.status,
        queue_position=persisted.queue_position,
        result=result,
        error=persisted.error,
        created_at=persisted.created_at,
        started_at=persisted.started_at,
        completed_at=persisted.completed_at,
    )


@router.get("/jobs", response_model=list[AIJobQueueOut])
async def list_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AIJobQueueOut]:
    jobs = db.query(PersistedAIJob).filter(
        PersistedAIJob.organization_id == current_user.organization_id,
    ).order_by(PersistedAIJob.created_at.desc()).all()
    return [_queue_item(job, db) for job in jobs if _job_is_visible(job, db, current_user)]


@router.get("/health")
async def ai_health() -> dict[str, bool | int]:
    return {"scheduler_running": scheduler._worker_task is not None, "comfyui_available": ComfyUIService.is_available(), "queued_jobs": scheduler.queue_size()}
