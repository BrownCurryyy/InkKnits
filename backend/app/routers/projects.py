from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.routers.auth import get_current_user
from backend.app.auth import can_access_project, can_access_station, get_user_roles, require_roles
from backend.app.schemas import (
    AssetLinkOut,
    AssetOut,
    AssetVersionOut,
    ProjectCreate,
    ProjectLineageOut,
    ProjectOut,
    ProjectProductionAssetState,
    ProjectProductionStateOut,
    ProjectUpdate,
    VersionBundleCreate,
    VersionBundleItemOut,
    VersionBundleOut,
    ProjectMemberAdd,
)
from backend.database.connection import get_db
from backend.models.project import Project
from backend.models.asset import Asset
from backend.models.asset_link import AssetLink
from backend.models.asset_version import AssetVersion
from backend.models.station import Station
from backend.models.version_bundle import VersionBundle, VersionBundleItem
from backend.models.project_member import ProjectMember
from backend.models.user import User
from backend.repositories.project_repository import ProjectRepository
from backend.services.version_service import VersionService

router = APIRouter(prefix="/projects", tags=["projects"], dependencies=[Depends(get_current_user)])


def _visible_project_assets(db: Session, project: Project, current_user) -> list[Asset]:
    station_ids = [station.id for station in db.query(Station).filter(
        Station.project_id == project.id,
        Station.organization_id == current_user.organization_id,
        Station.deleted_at.is_(None),
    ).all() if can_access_station(db, current_user, station.id)]
    if not station_ids:
        return []
    return db.query(Asset).filter(
        Asset.organization_id == current_user.organization_id,
        Asset.station_id.in_(station_ids),
        Asset.deleted_at.is_(None),
    ).all()


def _snapshot_preview(version: AssetVersion) -> str | None:
    path = Path(version.snapshot_path)
    if path.suffix.lower() in {".txt", ".md", ".json"} and path.is_file():
        try:
            return path.read_text(encoding="utf-8")[:280]
        except (OSError, UnicodeError):
            return None
    if path.is_file():
        return "Binary asset snapshot"
    return None


def _bundle_response(db: Session, bundle: VersionBundle) -> VersionBundleOut:
    items: list[VersionBundleItemOut] = []
    rows = db.query(VersionBundleItem, Asset, AssetVersion).join(
        Asset, Asset.id == VersionBundleItem.asset_id
    ).join(
        AssetVersion, AssetVersion.id == VersionBundleItem.version_id
    ).filter(VersionBundleItem.bundle_id == bundle.id).all()
    for item, asset, version in rows:
        items.append(VersionBundleItemOut(
            id=item.id,
            asset_id=asset.id,
            version_id=version.id,
            version_number=version.version_number,
            asset_title=asset.title or asset.name,
            asset_type=asset.asset_type,
            created_by=version.created_by,
            created_at=version.created_at,
            snapshot_preview=_snapshot_preview(version),
        ))
    return VersionBundleOut(
        id=bundle.id,
        project_id=bundle.project_id,
        name=bundle.name,
        created_by=bundle.created_by,
        created_at=bundle.created_at,
        is_active=bundle.is_active,
        items=items,
    )


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(payload: ProjectCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> ProjectOut:
    require_roles(get_user_roles(db, current_user), ("ADMIN",))
    if payload.organization_id != current_user.organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization access denied")
    repository = ProjectRepository(db)
    project = Project(
        organization_id=payload.organization_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        deadline=payload.deadline,
    )
    created = repository.create(project)
    VersionService.sync_project_bundle(db, created.id, user_id=current_user.id)
    db.commit()
    db.refresh(created)
    return ProjectOut.model_validate(created)


@router.get("", response_model=list[ProjectOut])
async def list_projects(db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> list[ProjectOut]:
    repository = ProjectRepository(db)
    projects = [
        project for project in repository.list_all()
        if project.organization_id == current_user.organization_id
        and project.deleted_at is None
        and can_access_project(db, current_user, project.id)
    ]
    return [ProjectOut.model_validate(item) for item in projects]


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> ProjectOut:
    repository = ProjectRepository(db)
    project = repository.get_by_id(project_id)
    if not project or project.deleted_at is not None or not can_access_project(db, current_user, project.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return ProjectOut.model_validate(project)


@router.post("/{project_id}/members", status_code=status.HTTP_201_CREATED)
async def add_project_member(project_id: str, payload: ProjectMemberAdd, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> dict:
    require_roles(get_user_roles(db, current_user), ("ADMIN",))
    project = ProjectRepository(db).get_by_id(project_id)
    member = db.get(User, payload.user_id)
    if not project or project.organization_id != current_user.organization_id or not member or member.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="Project or member not found")
    if not db.query(ProjectMember).filter(ProjectMember.project_id == project.id, ProjectMember.user_id == member.id).first():
        db.add(ProjectMember(project_id=project.id, user_id=member.id))
        db.commit()
    return {"message": "User assigned to project"}


@router.post("/{project_id}/bundles", response_model=VersionBundleOut, status_code=status.HTTP_201_CREATED)
async def create_version_bundle(
    project_id: str,
    payload: VersionBundleCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> VersionBundleOut:
    """Compatibility endpoint: synchronize and return the project's one bundle."""
    require_roles(get_user_roles(db, current_user), ("ADMIN", "EDITOR"))
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid project_id format") from exc
    project = ProjectRepository(db).get_by_id(project_uuid)
    if not project or project.deleted_at is not None or not can_access_project(db, current_user, project.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    bundle = VersionService.sync_project_bundle(db, project.id, user_id=current_user.id)
    db.commit()
    db.refresh(bundle)
    return _bundle_response(db, bundle)


@router.get("/{project_id}/bundles", response_model=list[VersionBundleOut])
async def list_version_bundles(
    project_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[VersionBundleOut]:
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid project_id format") from exc
    project = ProjectRepository(db).get_by_id(project_uuid)
    if not project or project.deleted_at is not None or not can_access_project(db, current_user, project.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    bundles = db.query(VersionBundle).filter(
        VersionBundle.project_id == project.id,
        VersionBundle.organization_id == current_user.organization_id,
        VersionBundle.deleted_at.is_(None),
    ).order_by(VersionBundle.created_at.asc()).all()
    if not bundles:
        bundle = VersionService.sync_project_bundle(db, project.id, user_id=current_user.id)
        db.commit()
        bundles = [bundle]
    return [_bundle_response(db, bundles[0])]


@router.get("/{project_id}/bundles/{bundle_id}", response_model=VersionBundleOut)
async def get_version_bundle(
    project_id: str,
    bundle_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> VersionBundleOut:
    try:
        project_uuid = UUID(project_id)
        bundle_uuid = UUID(bundle_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid bundle identifier") from exc
    project = ProjectRepository(db).get_by_id(project_uuid)
    bundle = db.get(VersionBundle, bundle_uuid)
    if (
        not project or project.deleted_at is not None
        or not bundle or bundle.project_id != project.id
        or bundle.organization_id != current_user.organization_id
        or bundle.deleted_at is not None
        or not can_access_project(db, current_user, project.id)
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version bundle not found")
    return _bundle_response(db, bundle)


@router.get("/{project_id}/lineage", response_model=ProjectLineageOut)
async def get_project_lineage(
    project_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ProjectLineageOut:
    """Return all visible assets and direct lineage links in an authorized project."""
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid project_id format") from exc
    project = ProjectRepository(db).get_by_id(project_uuid)
    if not project or project.deleted_at is not None or not can_access_project(db, current_user, project.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    station_ids = [station.id for station in db.query(Station).filter(
        Station.project_id == project.id,
        Station.organization_id == current_user.organization_id,
        Station.deleted_at.is_(None),
    ).all() if can_access_station(db, current_user, station.id)]
    assets = db.query(Asset).filter(
        Asset.organization_id == current_user.organization_id,
        Asset.station_id.in_(station_ids),
        Asset.deleted_at.is_(None),
    ).all() if station_ids else []
    asset_ids = {asset.id for asset in assets}
    links = db.query(AssetLink).filter(
        AssetLink.parent_asset_id.in_(asset_ids),
        AssetLink.child_asset_id.in_(asset_ids),
    ).all() if asset_ids else []
    return ProjectLineageOut(
        project_id=project.id,
        assets=[AssetOut.model_validate(asset) for asset in assets],
        links=[AssetLinkOut.model_validate(link) for link in links],
    )


@router.get("/{project_id}/production-state", response_model=ProjectProductionStateOut)
async def get_project_production_state(
    project_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> ProjectProductionStateOut:
    """Return the current assembled production view for a project.

    This is a computed representation of the current asset state, using the
    existing project -> station -> asset -> asset_versions model. It does not
    create persistent bundle snapshots; it resolves the latest active version for
    each visible asset at read time.
    """
    try:
        project_uuid = UUID(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid project_id format") from exc

    project = ProjectRepository(db).get_by_id(project_uuid)
    if not project or project.deleted_at is not None or not can_access_project(db, current_user, project.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    station_ids = [station.id for station in db.query(Station).filter(
        Station.project_id == project.id,
        Station.organization_id == current_user.organization_id,
        Station.deleted_at.is_(None),
    ).all() if can_access_station(db, current_user, station.id)]

    if not station_ids:
        return ProjectProductionStateOut(project_id=project.id, assets=[], links=[])

    assets = db.query(Asset).filter(
        Asset.organization_id == current_user.organization_id,
        Asset.station_id.in_(station_ids),
        Asset.deleted_at.is_(None),
    ).all()

    asset_ids = {asset.id for asset in assets}
    links = db.query(AssetLink).filter(
        AssetLink.parent_asset_id.in_(asset_ids),
        AssetLink.child_asset_id.in_(asset_ids),
    ).all() if asset_ids else []

    production_assets: list[ProjectProductionAssetState] = []
    for asset in assets:
        latest_version = (
            db.query(AssetVersion)
            .filter(AssetVersion.asset_id == asset.id, AssetVersion.deleted_at.is_(None))
            .order_by(AssetVersion.version_number.desc())
            .first()
        )
        if latest_version is None:
            continue
        production_assets.append(
            ProjectProductionAssetState(
                asset=AssetOut.model_validate(asset),
                current_version=AssetVersionOut.model_validate(latest_version),
                is_active=True,
            )
        )

    return ProjectProductionStateOut(
        project_id=project.id,
        assets=production_assets,
        links=[AssetLinkOut.model_validate(link) for link in links],
    )


@router.put("/{project_id}", response_model=ProjectOut)
async def update_project(project_id: str, payload: ProjectUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> ProjectOut:
    require_roles(get_user_roles(db, current_user), ("ADMIN",))
    repository = ProjectRepository(db)
    project = repository.get_by_id(project_id)
    if not project or project.organization_id != current_user.organization_id or not can_access_project(db, current_user, project.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
    if payload.title is not None:
        project.title = payload.title
    if payload.description is not None:
        project.description = payload.description
    if payload.status is not None:
        project.status = payload.status
    if payload.deadline is not None:
        project.deadline = payload.deadline
        
    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)


@router.patch("/{project_id}/archive", response_model=ProjectOut)
async def archive_project(project_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> ProjectOut:
    require_roles(get_user_roles(db, current_user), ("ADMIN",))
    repository = ProjectRepository(db)
    project = repository.get_by_id(project_id)
    if not project or project.organization_id != current_user.organization_id or not can_access_project(db, current_user, project.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
        
    project.status = "ARCHIVED"
    db.commit()
    db.refresh(project)
    return ProjectOut.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_200_OK)
async def delete_project(project_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)) -> dict:
    require_roles(get_user_roles(db, current_user), ("ADMIN",))
    repository = ProjectRepository(db)
    project = repository.get_by_id(project_id)
    if not project or project.organization_id != current_user.organization_id or not can_access_project(db, current_user, project.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    project.deleted_at = datetime.now(timezone.utc)
    project.status = "ARCHIVED"
    db.commit()
    return {"message": "Project soft-deleted successfully"}
