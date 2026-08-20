from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.routers.auth import get_current_user
from backend.app.auth import can_access_asset, can_access_project, can_access_station
from backend.app.schemas import ActivityCreate, ActivityOut
from backend.database.connection import get_db
from backend.models.activity import Activity
from backend.models.asset import Asset
from backend.repositories.activity_repository import ActivityRepository

router = APIRouter(prefix="/activities", tags=["activities"], dependencies=[Depends(get_current_user)])


@router.post("", response_model=ActivityOut, status_code=status.HTTP_201_CREATED)
async def create_activity(payload: ActivityCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> ActivityOut:
    if payload.user_id is not None and payload.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="user_id must match the authenticated user")
    if payload.organization_id is not None and payload.organization_id != current_user.organization_id:
        raise HTTPException(status_code=403, detail="Organization access denied")
    if payload.asset_id is not None:
        asset = db.get(Asset, payload.asset_id)
        if not can_access_asset(db, current_user, asset):
            raise HTTPException(status_code=404, detail="Asset not found")
    if payload.project_id is not None and not can_access_project(db, current_user, payload.project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    if payload.user_id is None:
        payload.user_id = current_user.id
    if payload.organization_id is None:
        payload.organization_id = current_user.organization_id
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
async def list_activities(db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[ActivityOut]:
    repository = ActivityRepository(db)
    activities = [
        activity for activity in repository.list_all()
        if activity.organization_id == current_user.organization_id
        and (
            activity.asset_id is None
            or can_access_asset(db, current_user, db.get(Asset, activity.asset_id))
        )
    ]
    return [ActivityOut.model_validate(item) for item in activities]


@router.get("/{activity_id}", response_model=ActivityOut)
async def get_activity(activity_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> ActivityOut:
    repository = ActivityRepository(db)
    activity = repository.get_by_id(activity_id)
    if not activity or activity.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    if activity.asset_id is not None and not can_access_asset(db, current_user, db.get(Asset, activity.asset_id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Activity not found")
    return ActivityOut.model_validate(activity)
