from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.schemas import StationCreate, StationOut
from backend.database.connection import get_db
from backend.models.station import Station
from backend.repositories.station_repository import StationRepository
from backend.models.station_member import StationMember
from backend.app.schemas import OrganizationMemberAdd

router = APIRouter(prefix="/stations", tags=["stations"])


@router.post("", response_model=StationOut, status_code=status.HTTP_201_CREATED)
async def create_station(payload: StationCreate, db: Session = Depends(get_db)) -> StationOut:
    repository = StationRepository(db)
    station = Station(
        project_id=payload.project_id,
        name=payload.name,
        description=payload.description,
        color=payload.color,
        icon=payload.icon,
    )
    created = repository.create(station)
    return StationOut.model_validate(created)


@router.get("", response_model=list[StationOut])
async def list_stations(db: Session = Depends(get_db)) -> list[StationOut]:
    repository = StationRepository(db)
    stations = repository.list_all()
    return [StationOut.model_validate(item) for item in stations]


@router.get("/{station_id}", response_model=StationOut)
async def get_station(station_id: str, db: Session = Depends(get_db)) -> StationOut:
    repository = StationRepository(db)
    station = repository.get_by_id(station_id)
    if not station:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Station not found")
    return StationOut.model_validate(station)


@router.post("/{station_id}/members", status_code=status.HTTP_201_CREATED)
async def assign_member(station_id: str, payload: OrganizationMemberAdd, db: Session = Depends(get_db)) -> dict:
    from backend.models.user import User
    user = db.query(User).filter(User.id == str(payload.user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    member = StationMember(station_id=station_id, user_id=payload.user_id)
    db.add(member)
    db.commit()
    return {"message": "User assigned to station"}


@router.get("/{station_id}/assets")
async def filter_assets(station_id: str, db: Session = Depends(get_db)) -> list[dict]:
    """Return all active (non-deleted) assets belonging to this station."""
    from backend.models.asset import Asset
    assets = (
        db.query(Asset)
        .filter(Asset.station_id == station_id, Asset.deleted_at.is_(None))
        .all()
    )
    return [
        {
            "id": str(a.id),
            "name": a.name,
            "title": a.title,
            "asset_type": a.asset_type,
            "storage_path": a.storage_path,
        }
        for a in assets
    ]


@router.get("/{station_id}/dashboard")
async def station_dashboard(station_id: str, db: Session = Depends(get_db)) -> dict:
    """Return station metadata with live counts of assets, members, and pending approvals."""
    from backend.models.asset import Asset
    from backend.models.station_member import StationMember
    from backend.models.approval_task import ApprovalTask

    repository = StationRepository(db)
    station = repository.get_by_id(station_id)
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    total_assets = db.query(Asset).filter(Asset.station_id == station_id, Asset.deleted_at.is_(None)).count()
    active_members = db.query(StationMember).filter(StationMember.station_id == station_id).count()
    pending_approvals = (
        db.query(ApprovalTask)
        .join(Asset, ApprovalTask.asset_id == Asset.id)
        .filter(Asset.station_id == station_id, ApprovalTask.status == "PENDING")
        .count()
    )

    return {
        "station": StationOut.model_validate(station).model_dump(),
        "metrics": {
            "total_assets": total_assets,
            "active_members": active_members,
            "pending_approvals": pending_approvals,
        },
    }
