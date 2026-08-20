from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session

from backend.app.routers.auth import get_current_user
from backend.app.auth import can_access_asset, can_access_station, get_user_roles, require_roles
from backend.app.schemas import AssetCreate, AssetLineageOut, AssetLinkCreate, AssetLinkOut, AssetOut, AssetUpdate, AssetMetadataUpdate, AssetPropertiesUpdate
from backend.database.connection import get_db
from backend.models.asset import Asset
from backend.models.user import User
from backend.models.asset_link import AssetLink
from backend.repositories.asset_repository import AssetRepository
from backend.services.activity_service import ActivityService
from backend.services.storage import StorageService
from backend.services.version_service import VersionService

router = APIRouter(prefix="/assets", tags=["assets"], dependencies=[Depends(get_current_user)])


@router.post("", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def create_asset(
    payload: AssetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetOut:
    """Create a new text/generic asset record (no file upload)."""
    require_roles(get_user_roles(db, current_user), ("EDITOR", "ADMIN"))
    if payload.organization_id != current_user.organization_id or not can_access_station(db, current_user, payload.station_id):
        raise HTTPException(status_code=403, detail="Station access denied")
    now = datetime.now(timezone.utc)
    asset = Asset(
        organization_id=payload.organization_id,
        station_id=payload.station_id,
        owner_id=current_user.id,
        name=payload.name,
        title=payload.title,
        content=payload.content,
        asset_type=payload.asset_type,
        storage_path=None,
        raw_metadata=payload.raw_metadata,
        created_at=now,
        updated_at=now,
    )
    repository = AssetRepository(db)
    created = repository.create(asset)
    VersionService.create_snapshot(db, created, user_id=current_user.id)
    ActivityService.log(db, "ASSET_CREATED", f"Asset '{created.name}' created", organization_id=created.organization_id, asset_id=created.id, user_id=current_user.id)
    return AssetOut.model_validate(created)


@router.post("/upload", response_model=AssetOut, status_code=status.HTTP_201_CREATED)
async def upload_asset(
    organization_id: str = Form(...),
    station_id: str = Form(...),
    owner_id: str | None = Form(None),
    name: str = Form(...),
    asset_type: str = Form("IMAGE"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetOut:
    require_roles(get_user_roles(db, current_user), ("EDITOR", "ADMIN"))
    """Upload a file asset via multipart/form-data. Saves to SSD and stores path in DB."""
    from uuid import uuid4, UUID

    now = datetime.now(timezone.utc)
    asset_id = uuid4()

    station_uuid = UUID(station_id)
    from backend.models.station import Station

    station = db.get(Station, station_uuid)
    if station is None or station.organization_id != current_user.organization_id or not can_access_station(db, current_user, station_uuid):
        raise HTTPException(status_code=404, detail="Station not found")

    try:
        storage_path = await StorageService.save_upload_file(
            organization_id=UUID(organization_id),
            project_id=station.project_id,
            asset_id=asset_id,
            file=file,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    asset = Asset(
        id=asset_id,
        organization_id=current_user.organization_id,
        station_id=station_uuid,
        owner_id=current_user.id,
        name=name,
        asset_type=asset_type,
        storage_path=storage_path,
        created_at=now,
        updated_at=now,
    )
    repository = AssetRepository(db)
    created = repository.create(asset)
    VersionService.create_snapshot(db, created, user_id=UUID(owner_id) if owner_id else None)
    ActivityService.log(
        db,
        "ASSET_CREATED",
        f"Asset '{created.name}' uploaded",
        organization_id=created.organization_id,
        asset_id=created.id,
        user_id=UUID(owner_id) if owner_id else None,
    )
    return AssetOut.model_validate(created)


@router.get("", response_model=list[AssetOut])
async def list_assets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[AssetOut]:
    """List all non-deleted assets."""
    assets = [
        asset for asset in db.query(Asset).filter(
            Asset.organization_id == current_user.organization_id,
            Asset.deleted_at.is_(None),
        ).all()
        if can_access_station(db, current_user, asset.station_id)
    ]
    return [AssetOut.model_validate(item) for item in assets]


@router.get("/search", response_model=list[AssetOut])
async def search_assets(q: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[AssetOut]:
    """Search assets by name or title (case-insensitive)."""
    assets = (
        db.query(Asset)
        .filter(
            Asset.organization_id == current_user.organization_id,
            Asset.deleted_at.is_(None),
            Asset.name.ilike(f"%{q}%") | Asset.title.ilike(f"%{q}%"),
        )
        .all()
    )
    return [AssetOut.model_validate(item) for item in assets if can_access_station(db, current_user, item.station_id)]


@router.get("/{asset_id}", response_model=AssetOut)
async def get_asset(asset_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> AssetOut:
    """Get a single asset by ID."""
    repository = AssetRepository(db)
    asset = repository.get_by_id(asset_id)
    if not asset or asset.deleted_at is not None or asset.organization_id != current_user.organization_id or not can_access_station(db, current_user, asset.station_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    ActivityService.log(
        db,
        "ASSET_OPENED",
        f"Asset '{asset.name}' opened",
        organization_id=asset.organization_id,
        asset_id=asset.id,
        user_id=current_user.id,
    )
    return AssetOut.model_validate(asset)


@router.get("/{asset_id}/download")
async def download_asset(asset_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> dict:
    """Return a stored file as a Base64-encoded JSON payload (per STO-003)."""
    repository = AssetRepository(db)
    asset = repository.get_by_id(asset_id)
    if not asset or asset.deleted_at is not None or asset.organization_id != current_user.organization_id or not can_access_station(db, current_user, asset.station_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    if not asset.storage_path:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Asset has no stored file")

    try:
        encoded = StorageService.read_file_as_base64(asset.storage_path)
    except FileNotFoundError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found on disk")

    return {
        "asset_id": str(asset.id),
        "name": asset.name,
        "asset_type": asset.asset_type,
        "data": encoded,
        "encoding": "base64",
    }


@router.get("/{asset_id}/lineage", response_model=AssetLineageOut)
async def get_asset_lineage(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetLineageOut:
    """Return the direct parent/child lineage for one authorized asset."""
    try:
        asset_uuid = UUID(asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid asset_id format") from exc
    asset = AssetRepository(db).get_by_id(asset_uuid)
    if not can_access_asset(db, current_user, asset):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    parent_links = db.query(AssetLink).filter(AssetLink.child_asset_id == asset.id).all()
    child_links = db.query(AssetLink).filter(AssetLink.parent_asset_id == asset.id).all()
    related_ids = {link.parent_asset_id for link in parent_links} | {link.child_asset_id for link in child_links}
    related_assets = {
        related.id: related
        for related in db.query(Asset).filter(Asset.id.in_(related_ids), Asset.deleted_at.is_(None)).all()
        if can_access_asset(db, current_user, related)
    }

    visible_parent_links = [link for link in parent_links if link.parent_asset_id in related_assets]
    visible_child_links = [link for link in child_links if link.child_asset_id in related_assets]
    links = visible_parent_links + visible_child_links
    return AssetLineageOut(
        asset=AssetOut.model_validate(asset),
        parents=[AssetOut.model_validate(related_assets[link.parent_asset_id]) for link in visible_parent_links],
        children=[AssetOut.model_validate(related_assets[link.child_asset_id]) for link in visible_child_links],
        links=[AssetLinkOut.model_validate(link) for link in links],
    )


@router.post("/{asset_id}/links", response_model=AssetLinkOut, status_code=status.HTTP_201_CREATED)
async def create_asset_link(
    asset_id: str,
    payload: AssetLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetLinkOut:
    """Link an authorized child asset to an authorized parent asset."""
    require_roles(get_user_roles(db, current_user), ("EDITOR", "ADMIN"))
    try:
        parent_uuid = UUID(asset_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid asset_id format") from exc

    parent = db.get(Asset, parent_uuid)
    child = db.get(Asset, payload.child_asset_id)
    if not can_access_asset(db, current_user, parent) or not can_access_asset(db, current_user, child):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    if parent.id == child.id:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="An asset cannot link to itself")

    existing = db.query(AssetLink).filter(
        AssetLink.parent_asset_id == parent.id,
        AssetLink.child_asset_id == child.id,
        AssetLink.relationship_type == payload.relationship_type,
    ).first()
    if existing:
        return AssetLinkOut.model_validate(existing)

    link = AssetLink(
        parent_asset_id=parent.id,
        child_asset_id=child.id,
        relationship_type=payload.relationship_type,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return AssetLinkOut.model_validate(link)


@router.put("/{asset_id}", response_model=AssetOut)
async def update_asset(
    asset_id: str,
    payload: AssetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetOut:
    """Update an asset's core fields (name, title, content, type)."""
    require_roles(get_user_roles(db, current_user), ("EDITOR", "ADMIN"))
    repository = AssetRepository(db)
    asset = repository.get_by_id(asset_id)
    if not asset or asset.deleted_at is not None or asset.organization_id != current_user.organization_id or not can_access_station(db, current_user, asset.station_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    if payload.name is not None:
        asset.name = payload.name
    if payload.title is not None:
        asset.title = payload.title
    if payload.content is not None:
        asset.content = payload.content
    if payload.asset_type is not None:
        asset.asset_type = payload.asset_type

    asset.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(asset)
    VersionService.create_snapshot(db, asset, user_id=current_user.id)
    ActivityService.log(db, "ASSET_UPDATED", f"Asset '{asset.name}' updated", organization_id=asset.organization_id, asset_id=asset.id, user_id=current_user.id)
    return AssetOut.model_validate(asset)


@router.patch("/{asset_id}/properties", response_model=AssetOut)
async def update_asset_properties(
    asset_id: str,
    payload: AssetPropertiesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetOut:
    """Update only the human-facing title and description fields."""
    require_roles(get_user_roles(db, current_user), ("EDITOR", "ADMIN"))
    asset = AssetRepository(db).get_by_id(asset_id)
    if not can_access_asset(db, current_user, asset):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")
    if payload.title is not None:
        asset.title = payload.title
    if payload.description is not None:
        asset.description = payload.description
    asset.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(asset)
    return AssetOut.model_validate(asset)


@router.patch("/{asset_id}/metadata", response_model=AssetOut)
async def update_asset_metadata(
    asset_id: str,
    payload: AssetMetadataUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AssetOut:
    """Merge new key-value pairs into the asset's existing raw_metadata JSON field."""
    require_roles(get_user_roles(db, current_user), ("EDITOR", "ADMIN"))
    repository = AssetRepository(db)
    asset = repository.get_by_id(asset_id)
    if not can_access_asset(db, current_user, asset):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    existing = asset.raw_metadata or {}
    existing.update(payload.raw_metadata)
    asset.raw_metadata = existing
    asset.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(asset)
    VersionService.create_snapshot(db, asset, user_id=current_user.id)
    ActivityService.log(
        db,
        "ASSET_UPDATED",
        f"Asset metadata for '{asset.name}' updated",
        organization_id=asset.organization_id,
        asset_id=asset.id,
        user_id=current_user.id,
    )
    return AssetOut.model_validate(asset)


@router.delete("/{asset_id}", status_code=status.HTTP_200_OK)
async def soft_delete_asset(
    asset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Soft-delete an asset by stamping deleted_at. File is preserved on disk per soft-delete policy."""
    require_roles(get_user_roles(db, current_user), ("EDITOR", "ADMIN"))
    repository = AssetRepository(db)
    asset = repository.get_by_id(asset_id)
    if not can_access_asset(db, current_user, asset):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Asset not found")

    asset.deleted_at = datetime.now(timezone.utc)
    db.commit()
    ActivityService.log(db, "ARCHIVE", f"Asset '{asset.name}' archived", organization_id=asset.organization_id, asset_id=asset.id, user_id=current_user.id)
    return {"message": "Asset soft-deleted successfully"}
