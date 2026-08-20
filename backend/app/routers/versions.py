from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.routers.auth import get_current_user
from backend.app.auth import can_access_asset, get_user_roles, require_roles
from backend.app.schemas import AssetVersionOut
from backend.database.connection import get_db
from backend.models.asset import Asset
from backend.models.asset_version import AssetVersion
from backend.models.user import User
from backend.repositories.asset_version_repository import AssetVersionRepository
from backend.services.activity_service import ActivityService
from backend.services.version_service import VersionService

router = APIRouter(prefix="/versions", tags=["versions"], dependencies=[Depends(get_current_user)])


class VersionRestoreRequest(BaseModel):
    version_id: UUID


@router.get("", response_model=list[AssetVersionOut])
async def list_versions(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[AssetVersionOut]:
    """List all versions across all assets."""
    repository = AssetVersionRepository(db)
    versions = [
        version for version in repository.list_all()
        if can_access_asset(db, current_user, db.get(Asset, version.asset_id))
    ]
    return [AssetVersionOut.model_validate(item) for item in versions]


@router.get("/{asset_id}", response_model=list[AssetVersionOut])
async def list_versions_for_asset(asset_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[AssetVersionOut]:
    """List all version snapshots for a specific asset."""
    try:
        asset_uuid = UUID(asset_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid asset_id format")

    asset = db.get(Asset, asset_uuid)
    if not can_access_asset(db, current_user, asset):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    versions = (
        db.query(AssetVersion)
        .filter(AssetVersion.asset_id == asset_uuid)
        .order_by(AssetVersion.version_number.asc())
        .all()
    )
    return [AssetVersionOut.model_validate(item) for item in versions]


@router.post("/{asset_id}", response_model=AssetVersionOut, status_code=status.HTTP_201_CREATED)
async def create_version_snapshot(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetVersionOut:
    """Create a new version snapshot for the current asset state."""
    try:
        asset_uuid = UUID(asset_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid asset_id format")

    require_roles(get_user_roles(db, current_user), ("EDITOR", "ADMIN"))
    asset = db.get(Asset, asset_uuid)
    if not can_access_asset(db, current_user, asset):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    version = VersionService.create_snapshot(db, asset, user_id=current_user.id)
    ActivityService.log(
        db,
        "VERSION_CREATED",
        f"Version {version.version_number} created for asset '{asset.name}'",
        organization_id=asset.organization_id,
        asset_id=asset.id,
        user_id=current_user.id,
    )
    return AssetVersionOut.model_validate(version)


@router.post("/{asset_id}/restore", response_model=dict)
async def restore_version(
    asset_id: str,
    payload: VersionRestoreRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Restore an asset to a previous version snapshot."""
    try:
        asset_uuid = UUID(asset_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid asset_id format")

    require_roles(get_user_roles(db, current_user), ("EDITOR", "ADMIN"))
    asset = db.get(Asset, asset_uuid)
    if not can_access_asset(db, current_user, asset):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    version = db.get(AssetVersion, payload.version_id)
    if not version or version.asset_id != asset_uuid:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found for this asset")

    try:
        restored_asset = VersionService.restore_version(db, asset, version, user_id=current_user.id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    ActivityService.log(
        db,
        "RESTORE",
        f"Asset restored to version {version.version_number}",
        organization_id=asset.organization_id,
        asset_id=asset.id,
        user_id=current_user.id,
    )
    return {
        "message": f"Asset restored to version {version.version_number}",
        "asset_id": str(restored_asset.id),
        "restored_version": version.version_number,
    }


@router.get("/id/{version_id}", response_model=AssetVersionOut)
async def get_version(version_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> AssetVersionOut:
    """Get a single version by its ID."""
    try:
        version_uuid = UUID(version_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid version_id format")

    repository = AssetVersionRepository(db)
    version = repository.get_by_id(version_uuid)
    if not version or not can_access_asset(db, current_user, db.get(Asset, version.asset_id)):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return AssetVersionOut.model_validate(version)
