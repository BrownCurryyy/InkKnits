from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.schemas import AssetVersionCreate, AssetVersionOut
from backend.database.connection import get_db
from backend.models.asset_version import AssetVersion
from backend.repositories.asset_version_repository import AssetVersionRepository

router = APIRouter(prefix="/versions", tags=["versions"])


@router.post("", response_model=AssetVersionOut, status_code=status.HTTP_201_CREATED)
async def create_version(payload: AssetVersionCreate, db: Session = Depends(get_db)) -> AssetVersionOut:
    repository = AssetVersionRepository(db)
    version = AssetVersion(
        asset_id=payload.asset_id,
        version_number=payload.version_number,
        snapshot_path=payload.snapshot_path,
        raw_metadata=payload.raw_metadata,
        created_by=payload.created_by,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    created = repository.create(version)
    return AssetVersionOut.model_validate(created)


@router.get("", response_model=list[AssetVersionOut])
async def list_versions(db: Session = Depends(get_db)) -> list[AssetVersionOut]:
    repository = AssetVersionRepository(db)
    versions = repository.list_all()
    return [AssetVersionOut.model_validate(item) for item in versions]


@router.get("/{version_id}", response_model=AssetVersionOut)
async def get_version(version_id: str, db: Session = Depends(get_db)) -> AssetVersionOut:
    repository = AssetVersionRepository(db)
    version = repository.get_by_id(version_id)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return AssetVersionOut.model_validate(version)
