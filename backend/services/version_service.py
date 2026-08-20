import os
import shutil
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4
from sqlalchemy.orm import Session

from backend.models.asset import Asset
from backend.models.asset_version import AssetVersion
from backend.models.station import Station
from backend.models.version_bundle import VersionBundle, VersionBundleItem
from backend.services.storage import STORAGE_ROOT

class VersionService:
    @staticmethod
    def sync_project_bundle(db: Session, project_id: UUID, user_id: UUID | None = None) -> VersionBundle:
        """Keep one project's production bundle synchronized with latest versions."""
        from backend.models.project import Project

        project = db.get(Project, project_id)
        if project is None:
            raise ValueError(f"Project {project_id} not found")
        bundles = db.query(VersionBundle).filter(
            VersionBundle.project_id == project_id,
            VersionBundle.deleted_at.is_(None),
        ).order_by(VersionBundle.created_at.asc()).all()
        bundle = bundles[0] if bundles else VersionBundle(
            organization_id=project.organization_id,
            project_id=project.id,
            name="Production State",
            created_by=user_id or project.created_by if hasattr(project, "created_by") else user_id,
            is_active=True,
        )
        if bundle.id is None:
            if bundle.created_by is None:
                raise ValueError("A production bundle requires a creator")
            db.add(bundle)
            db.flush()
        for duplicate in bundles[1:]:
            duplicate.deleted_at = datetime.now(timezone.utc)
            duplicate.is_active = False
        bundle.is_active = True
        db.query(VersionBundleItem).filter(VersionBundleItem.bundle_id == bundle.id).delete(synchronize_session=False)
        assets = db.query(Asset).join(Station, Station.id == Asset.station_id).filter(
            Station.project_id == project_id,
            Asset.deleted_at.is_(None),
        ).all()
        for project_asset in assets:
            latest = db.query(AssetVersion).filter(
                AssetVersion.asset_id == project_asset.id,
                AssetVersion.deleted_at.is_(None),
            ).order_by(AssetVersion.version_number.desc()).first()
            if latest:
                db.add(VersionBundleItem(bundle_id=bundle.id, asset_id=project_asset.id, version_id=latest.id))
        db.flush()
        return bundle

    @staticmethod
    def get_snapshot_directory(organization_id: UUID, project_id: UUID) -> Path:
        """Generates a structured path for storing snapshots."""
        path = STORAGE_ROOT / f"org_{organization_id}" / f"project_{project_id}" / "snapshots"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @staticmethod
    def create_snapshot(db: Session, asset: Asset, user_id: UUID | None = None) -> AssetVersion:
        """
        Creates an immutable snapshot of the current asset state.
        Saves the content/file to a snapshot file on disk and inserts an AssetVersion record.
        """
        # Get project_id from station
        station = db.get(Station, asset.station_id)
        if not station:
            raise ValueError(f"Station {asset.station_id} not found for asset")
        project_id = station.project_id

        # Determine next version number
        max_version = db.query(AssetVersion).filter(AssetVersion.asset_id == asset.id).order_by(AssetVersion.version_number.desc()).first()
        next_version_num = 1 if max_version is None else max_version.version_number + 1
        parent_version_id = max_version.id if max_version else None

        snapshot_id = uuid4()
        snapshot_dir = VersionService.get_snapshot_directory(asset.organization_id, project_id)

        # Check if asset has a physical file (storage_path)
        if asset.storage_path and os.path.exists(asset.storage_path):
            ext = os.path.splitext(asset.storage_path)[1] or ".bin"
            snapshot_file_path = snapshot_dir / f"{snapshot_id}{ext}"
            shutil.copy(asset.storage_path, snapshot_file_path)
        else:
            # For text-based or metadata-only assets, store content in a text file
            snapshot_file_path = snapshot_dir / f"{snapshot_id}.txt"
            content = asset.content or ""
            with open(snapshot_file_path, "w", encoding="utf-8") as f:
                f.write(content)

        # Store critical metadata to allow restoring other properties
        raw_metadata = {
            "name": asset.name,
            "title": asset.title,
            "asset_type": asset.asset_type,
            "raw_metadata": asset.raw_metadata,
        }

        now = datetime.now(timezone.utc)
        version = AssetVersion(
            id=snapshot_id,
            asset_id=asset.id,
            version_number=next_version_num,
            snapshot_path=str(snapshot_file_path),
            raw_metadata=raw_metadata,
            parent_version_id=parent_version_id,
            created_by=user_id,
            created_at=now,
            updated_at=now,
        )

        db.add(version)
        db.commit()
        VersionService.sync_project_bundle(db, project_id, user_id=user_id)
        db.commit()
        db.refresh(version)
        return version

    @staticmethod
    def restore_version(db: Session, asset: Asset, version: AssetVersion, user_id: UUID | None = None) -> Asset:
        """
        Restores the asset's state (content/file and metadata) from a previous version snapshot.
        """
        if not os.path.exists(version.snapshot_path):
            raise FileNotFoundError(f"Snapshot file not found: {version.snapshot_path}")

        # Update metadata fields from version's raw_metadata
        if version.raw_metadata:
            asset.name = version.raw_metadata.get("name", asset.name)
            asset.title = version.raw_metadata.get("title", asset.title)
            asset.asset_type = version.raw_metadata.get("asset_type", asset.asset_type)
            asset.raw_metadata = version.raw_metadata.get("raw_metadata", asset.raw_metadata)

        # Handle restore of physical file or text content
        if asset.storage_path:
            # Overwrite active storage_path with version snapshot
            shutil.copy(version.snapshot_path, asset.storage_path)
        else:
            # For text assets, read from the snapshot file
            with open(version.snapshot_path, "r", encoding="utf-8") as f:
                asset.content = f.read()

        # Update timestamps and commit change
        asset.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(asset)

        # Create a new version representing this restoration event
        # This keeps the version history linear and append-only
        VersionService.create_snapshot(db, asset, user_id=user_id)

        return asset
