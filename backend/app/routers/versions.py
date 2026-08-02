from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.routers.auth import get_current_user
from backend.app.schemas import AssetVersionCreate, AssetVersionOut
from backend.database.connection import get_db
from backend.models.asset import Asset
from backend.models.asset_version import AssetVersion
from backend.repositories.asset_version_repository import AssetVersionRepository
from backend.services.activity_service import ActivityService
from backend.services.version_service import VersionService

router = APIRouter(prefix="/versions", tags=["versions"], dependencies=[Depends(get_current_user)])


@router.post("", response_model=AssetVersionOut, status_code=status.HTTP_201_CREATED)
async def create_version(payload: AssetVersionCreate, db: Session = Depends(get_db)) -> AssetVersionOut:
    """Manually create a version snapshot (for external integrations)."""
    repository = AssetVersionRepository(db)
    version = AssetVersion(
        asset_id=payload.asset_id,
        version_number=payload.version_number,
        snapshot_path=payload.snapshot_path,
        raw_metadata=payload.raw_metadata,
        parent_version_id=payload.parent_version_id,
        created_by=payload.created_by,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    created = repository.create(version)
    return AssetVersionOut.model_validate(created)


@router.get("", response_model=list[AssetVersionOut])
async def list_versions(db: Session = Depends(get_db)) -> list[AssetVersionOut]:
    """List all versions across all assets."""
    repository = AssetVersionRepository(db)
    versions = repository.list_all()
    return [AssetVersionOut.model_validate(item) for item in versions]


@router.get("/asset/{asset_id}", response_model=list[AssetVersionOut])
async def list_versions_for_asset(asset_id: str, db: Session = Depends(get_db)) -> list[AssetVersionOut]:
    """List all version snapshots for a specific asset, ordered by version number."""
    versions = (
        db.query(AssetVersion)
        .filter(AssetVersion.asset_id == asset_id)
        .order_by(AssetVersion.version_number.asc())
        .all()
    )
    return [AssetVersionOut.model_validate(item) for item in versions]


@router.get("/{version_id}", response_model=AssetVersionOut)
async def get_version(version_id: str, db: Session = Depends(get_db)) -> AssetVersionOut:
    """Get a single version by ID."""
    repository = AssetVersionRepository(db)
    version = repository.get_by_id(version_id)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return AssetVersionOut.model_validate(version)


@router.post("/{version_id}/restore", response_model=dict)
async def restore_version(
    version_id: str,
    user_id: UUID | None = None,
    db: Session = Depends(get_db),
) -> dict:
    """
    Restore an asset to a previous version's state.
    This copies the snapshot content/file back onto the live asset and creates
    a new version entry to keep the ledger append-only.
    """
    repository = AssetVersionRepository(db)
    version = repository.get_by_id(version_id)
    if not version:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")

    asset = db.get(Asset, version.asset_id)
    if not asset or asset.deleted_at is not None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    try:
        restored_asset = VersionService.restore_version(db, asset, version, user_id=user_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    ActivityService.log(
        db,
        "RESTORE",
        f"Asset restored to version {version.version_number}",
        organization_id=asset.organization_id,
        asset_id=asset.id,
        user_id=user_id,
    )
    return {
        "message": f"Asset restored to version {version.version_number}",
        "asset_id": str(restored_asset.id),
        "restored_version": version.version_number,
    }
