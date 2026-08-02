from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.routers.auth import get_current_user
from backend.app.schemas import ActivityCreate, ActivityOut
from backend.database.connection import get_db
from backend.models.activity import Activity
from backend.repositories.activity_repository import ActivityRepository

router = APIRouter(prefix="/activities", tags=["activities"], dependencies=[Depends(get_current_user)])


@router.post("", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
async def create_activity(payload: ActivityCreate, db: Session = Depends(get_db)) -> ActivityOut:
    repository = ActivityRepository(db)
    activity = Activity(
        organization_id=payload.organization_id,
        project_id=payload.project_id,
        asset_id=payload.asset_id,
        user_id=payload.user_id,
        activity_type=payload.activity_type,
        description=payload.description,
        raw_metadata=payload.raw_metadata,
        created_at=datetime.now(timezone.utc),
    )
    created = repository.create(activity)
    return ActivityOut.model_validate(created)


@router.get("", response_model=list[ActivityOut])
async def list_activities(db: Session = Depends(get_db)) -> list[ActivityOut]:
    repository = ActivityRepository(db)
    activities = repository.list_all()
    return [ActivityOut.model_validate(item) for item in activities]


@router.get("/{activity_id}", response_model=ActivityOut)
async def get_activity(activity_id: str, db: Session = Depends(get_db)) -> ActivityOut:
    repository = ActivityRepository(db)
    activity = repository.get_by_id(activity_id)
    if not activity:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    return ActivityOut.model_validate(activity)
