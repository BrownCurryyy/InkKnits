from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.schemas import AssetCreate, AssetOut
from backend.database.connection import get_db
from backend.models.asset import Asset
from backend.repositories.asset_repository import AssetRepository

router = APIRouter(prefix="/assets", tags=["assets"])


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def create_asset(payload: AssetCreate, db: Session = Depends(get_db)) -> AssetOut:
    repository = AssetRepository(db)
    asset = Asset(
        organization_id=payload.organization_id,
        station_id=payload.station_id,
        owner_id=payload.owner_id,
        name=payload.name,
        asset_type=payload.asset_type,
        storage_path=payload.storage_path,
        raw_metadata=payload.raw_metadata,
    )
    created = repository.create(asset)
    return AssetOut.model_validate(created)


@router.get("", response_model=list[AssetOut])
async def list_assets(db: Session = Depends(get_db)) -> list[AssetOut]:
    repository = AssetRepository(db)
    assets = repository.list_all()
    return [AssetOut.model_validate(item) for item in assets]


@router.get("/{asset_id}", response_model=AssetOut)
async def get_asset(asset_id: str, db: Session = Depends(get_db)) -> AssetOut:
    repository = AssetRepository(db)
    asset = repository.get_by_id(asset_id)
    if not asset:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    return AssetOut.model_validate(asset)
