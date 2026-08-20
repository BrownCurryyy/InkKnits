"""Seed the deterministic InkKnits local development organization.

All accounts use the development-only password ``InkKnits-Dev-2026!``.
Never use these credentials outside local development.

Run from the repository root:
    python backend/scripts/local_dev_setup.py

The current schema has no project-membership table. Employee scope therefore
uses station_members; ADMIN is the organization-wide exception.
"""

from pathlib import Path
import os
import sys
from uuid import NAMESPACE_URL, UUID, uuid5

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from backend.app.auth import hash_password
from backend.database.base import Base
from backend.database.connection import DEFAULT_DATABASE_URL
import backend.models
from backend.models.approval_task import ApprovalTask
from backend.models.asset import Asset
from backend.models.asset_version import AssetVersion
from backend.models.organization import Organization
from backend.models.project import Project
from backend.models.rbac import Role, UserRole
from backend.models.station import Station
from backend.models.station_member import StationMember
from backend.models.project_member import ProjectMember
from backend.models.user import User
from backend.services.version_service import VersionService

DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
SEED_NAMESPACE = uuid5(NAMESPACE_URL, "https://inkknits.local/dev-seed")
DEVELOPMENT_PASSWORD = "InkKnits-Dev-2026!"


def stable_id(kind: str, name: str) -> UUID:
    return uuid5(SEED_NAMESPACE, f"{kind}:{name}")


def get_or_create(session: Session, model, object_id: UUID, **values):
    record = session.get(model, object_id)
    if record is None:
        record = model(id=object_id, **values)
        session.add(record)
    else:
        for key, value in values.items():
            setattr(record, key, value)
    return record


def ensure_role(session: Session, organization_id: UUID, role_name: str) -> Role:
    return get_or_create(
        session,
        Role,
        stable_id("role", role_name),
        organization_id=organization_id,
        name=role_name,
        description=f"InkKnits development {role_name.title()} role",
    )


def ensure_user(session: Session, organization_id: UUID, key: str, email: str, display_name: str, role: Role) -> User:
    user = session.query(User).filter(User.email == email).first()
    if user is None:
        user = User(id=stable_id("user", key), organization_id=organization_id, email=email)
        session.add(user)
    user.organization_id = organization_id
    user.display_name = display_name
    user.password_hash = hash_password(DEVELOPMENT_PASSWORD)
    user.status = "ACTIVE"
    session.flush()

    assignment = session.query(UserRole).filter(
        UserRole.user_id == user.id,
        UserRole.role_id == role.id,
    ).first()
    if assignment is None:
        session.add(UserRole(user_id=user.id, role_id=role.id))
    return user


def ensure_station_member(session: Session, station_id: UUID, user_id: UUID) -> None:
    membership = session.get(StationMember, {"station_id": station_id, "user_id": user_id})
    if membership is None:
        session.add(StationMember(station_id=station_id, user_id=user_id))


def seed_demo_data(session: Session) -> dict[str, int]:
    organization_id = stable_id("organization", "inkknits-demo")
    get_or_create(
        session,
        Organization,
        organization_id,
        name="InkKnits Demo Organization",
        description="Deterministic local development organization",
    )

    roles = {name: ensure_role(session, organization_id, name) for name in (
        "ADMIN", "EDITOR", "REVIEWER", "VIEWER"
    )}
    users = {
        "admin": ensure_user(session, organization_id, "admin", "admin@example.com", "Demo Admin", roles["ADMIN"]),
        "editor": ensure_user(session, organization_id, "editor", "editor@example.com", "Demo Editor", roles["EDITOR"]),
        "reviewer": ensure_user(session, organization_id, "reviewer", "reviewer@example.com", "Demo Reviewer", roles["REVIEWER"]),
        "viewer": ensure_user(session, organization_id, "viewer", "viewer@example.com", "Demo Viewer", roles["VIEWER"]),
    }

    project_specs = {
        "world-cup": ("World Cup Campaign", ("Writing", "Generation", "Image")),
        "product-launch": ("Product Launch", ("Writing", "Image")),
        "editorial": ("Editorial Campaign", ("Writing",)),
    }
    stations: dict[str, Station] = {}
    for project_key, (title, station_names) in project_specs.items():
        project = get_or_create(
            session,
            Project,
            stable_id("project", project_key),
            organization_id=organization_id,
            title=title,
            description=f"{title} development campaign",
            status="ACTIVE",
        )
        for station_name in station_names:
            station_key = f"{project_key}:{station_name}"
            station_type = (
                "WRITING" if station_name == "Writing" else
                "GENERATION" if station_name == "Generation" else
                "IMAGE" if station_name == "Image" else
                "VIEWING"
            )
            stations[station_key] = get_or_create(
                session,
                Station,
                stable_id("station", station_key),
                organization_id=organization_id,
                project_id=project.id,
                name=station_name,
                station_type=station_type,
                description=f"{station_name} production station for {title}",
                status="ACTIVE",
            )

    assignments = {
        "admin": tuple(stations),
        "editor": ("world-cup:Writing", "product-launch:Writing", "editorial:Writing"),
        "reviewer": ("world-cup:Writing",),
        "viewer": ("world-cup:Writing",),
    }
    for user_key, station_keys in assignments.items():
        for station_key in station_keys:
            ensure_station_member(session, stations[station_key].id, users[user_key].id)
    for user_key in ("editor", "reviewer", "viewer"):
        for project_key in project_specs:
            project = session.get(Project, stable_id("project", project_key))
            if not session.get(ProjectMember, {"project_id": project.id, "user_id": users[user_key].id}):
                session.add(ProjectMember(project_id=project.id, user_id=users[user_key].id))

    asset_specs = (
        ("world-cup-master", "world-cup:Writing", "World Cup Master Article", "TEXT", "The campaign master article for the demo organization.", "editor"),
        ("world-cup-generation", "world-cup:Generation", "World Cup Generation Brief", "GENERIC", "Prompt and production brief for generated campaign material.", "admin"),
        ("world-cup-image", "world-cup:Image", "World Cup Hero Image", "IMAGE", None, "admin"),
        ("world-cup-approval", "world-cup:Writing", "World Cup Approval Copy", "TEXT", "Copy ready for reviewer approval.", "editor"),
        ("product-launch-article", "product-launch:Writing", "Product Launch Article", "TEXT", "Launch article draft for the product campaign.", "editor"),
        ("product-launch-image", "product-launch:Image", "Product Launch Visual", "IMAGE", None, "admin"),
        ("editorial-feature", "editorial:Writing", "Editorial Feature", "TEXT", "Feature story draft for the editorial campaign.", "editor"),
    )
    assets: dict[str, Asset] = {}
    for asset_key, station_key, title, asset_type, content, owner_key in asset_specs:
        asset = get_or_create(
            session,
            Asset,
            stable_id("asset", asset_key),
            organization_id=organization_id,
            station_id=stations[station_key].id,
            owner_id=users[owner_key].id,
            name=title.lower().replace(" ", "-"),
            title=title,
            content=content,
            asset_type=asset_type,
            raw_metadata={"seed": "inkknits-demo", "asset_key": asset_key},
        )
        assets[asset_key] = asset
        session.flush()
        if session.query(AssetVersion).filter(AssetVersion.asset_id == asset.id).first() is None:
            VersionService.create_snapshot(session, asset, user_id=asset.owner_id)

    approval_specs = (
        ("world-cup-review", "world-cup-approval", "PENDING", "reviewer", "admin"),
        ("product-launch-review", "product-launch-article", "APPROVED", "reviewer", "admin"),
    )
    for task_key, asset_key, task_status, assignee_key, assigner_key in approval_specs:
        task = get_or_create(
            session,
            ApprovalTask,
            stable_id("approval", task_key),
            asset_id=assets[asset_key].id,
            assigned_to=users[assignee_key].id,
            assigned_by=users[assigner_key].id,
            status=task_status,
            comments="Deterministic demo approval task",
        )
        task.asset_id = assets[asset_key].id
        task.assigned_to = users[assignee_key].id
        task.assigned_by = users[assigner_key].id
        task.status = task_status

    session.commit()
    return {
        "organizations": 1,
        "roles": len(roles),
        "users": len(users),
        "projects": len(project_specs),
        "stations": len(stations),
        "assets": len(assets),
        "approvals": len(approval_specs),
        "ai_jobs": 0,
    }


def seed() -> dict[str, int]:
    engine = create_engine(DATABASE_URL, future=True)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        counts = seed_demo_data(session)

    print("Seeded InkKnits Demo Organization")
    print(f"Development-only password: {DEVELOPMENT_PASSWORD}")
    for email in (
        "admin@example.com", "editor@example.com", "reviewer@example.com", "viewer@example.com",
    ):
        print(f" - {email}")
    print(f"Counts: {counts}")
    print("AI jobs: 0 (omitted because queued jobs require scheduler execution)")
    return counts


if __name__ == "__main__":
    seed()
