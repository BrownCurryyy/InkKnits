"""Create the deterministic local InkKnits development organization.

Development-only credentials are intentionally predictable. Never use them outside
local development or commit production secrets to the repository.
"""
from pathlib import Path
import os
import sys
from uuid import NAMESPACE_URL, UUID, uuid5
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

# Ensure repository root is on sys.path when script is invoked directly
REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from backend.database.base import Base
from backend.database.connection import DEFAULT_DATABASE_URL
# Import the models package to ensure all models are registered with SQLAlchemy
import backend.models
from backend.models.organization import Organization
from backend.models.project import Project
from backend.models.station import Station
from backend.models.user import User
from backend.models.rbac import Role, UserRole
from backend.app.auth import hash_password
from backend.models.station_member import StationMember

# Require DATABASE_URL or use the same Postgres default as the running app.
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
SEED_NAMESPACE = uuid5(NAMESPACE_URL, "https://inkknits.local/dev-seed")
PASSWORD = "inkknits-dev-only"

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


def seed() -> None:
    engine = create_engine(DATABASE_URL, future=True)
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        organization_id = stable_id("organization", "inkknits-demo")
        get_or_create(session, Organization, organization_id, name="InkKnits Demo Organization", description="Deterministic local development organization")

        role_records = {}
        for role_name in ("ADMIN", "MANAGER", "EDITOR", "REVIEWER", "PUBLISHER", "VIEWER"):
            role_records[role_name] = get_or_create(session, Role, stable_id("role", role_name), organization_id=organization_id, name=role_name, description=f"Development {role_name.title()} role")

        user_specs = {
            "admin": ("admin@inkknits.local", "Demo Admin", "ADMIN"),
            "manager": ("manager@inkknits.local", "Demo Manager", "MANAGER"),
            "writer": ("writer@inkknits.local", "Demo Writer", "EDITOR"),
            "reviewer": ("reviewer@inkknits.local", "Demo Reviewer", "REVIEWER"),
            "publisher": ("publisher@inkknits.local", "Demo Publisher", "PUBLISHER"),
            "viewer": ("viewer@inkknits.local", "Demo Viewer", "VIEWER"),
        }
        users = {}
        for key, (email, display_name, role_name) in user_specs.items():
            user = session.query(User).filter(User.email == email).first()
            if user is None:
                user = User(id=stable_id("user", key), organization_id=organization_id, email=email)
                session.add(user)
            user.organization_id = organization_id
            user.display_name = display_name
            user.password_hash = hash_password(PASSWORD)
            user.status = "ACTIVE"
            users[key] = user
            session.flush()
            if session.get(UserRole, {"user_id": user.id, "role_id": role_records[role_name].id}) is None:
                session.add(UserRole(user_id=user.id, role_id=role_records[role_name].id))

        project_specs = {
            "world-cup": ("World Cup Campaign", ["Writing Station", "Editing Station", "Generation Station", "Image Station", "Approval Station"]),
            "product-launch": ("Product Launch", ["Writing Station", "Generation Station", "Image Station"]),
            "editorial": ("Editorial Campaign", ["Writing Station", "Editing Station"]),
        }
        station_ids = {}
        for project_key, (project_title, station_names) in project_specs.items():
            project = get_or_create(session, Project, stable_id("project", project_key), organization_id=organization_id, title=project_title, description=f"{project_title} development campaign", status="ACTIVE")
            for station_name in station_names:
                station_key = f"{project_key}:{station_name}"
                station = get_or_create(session, Station, stable_id("station", station_key), organization_id=organization_id, project_id=project.id, name=station_name, description=f"{station_name} for {project_title}", status="ACTIVE")
                station_ids[station_key] = station.id

        assignments = {
            "admin": list(station_ids.values()),
            "manager": [station_ids["world-cup:Approval Station"], station_ids["world-cup:Writing Station"], station_ids["product-launch:Writing Station"]],
            "writer": [station_id for key, station_id in station_ids.items() if "Writing Station" in key],
            "reviewer": [station_ids["world-cup:Approval Station"]],
            "publisher": [station_ids["world-cup:Approval Station"]],
            "viewer": [station_ids["world-cup:Writing Station"]],
        }
        for user_key, assigned_stations in assignments.items():
            for station_id in assigned_stations:
                if session.get(StationMember, {"station_id": station_id, "user_id": users[user_key].id}) is None:
                    session.add(StationMember(station_id=station_id, user_id=users[user_key].id))

        session.commit()
        print("Seeded InkKnits Demo Organization")
        print(f"Development password for all demo users: {PASSWORD}")
        for key, (email, _, _) in user_specs.items():
            print(f" - {key}: {email}")


if __name__ == "__main__":
    seed()
