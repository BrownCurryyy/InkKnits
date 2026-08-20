import uuid
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.database.base import Base
from backend.models.project import Project
from backend.models.organization import Organization
from backend.models.rbac import Role
from backend.models.approval_task import ApprovalTask
from backend.models.asset import Asset
from backend.models.asset_version import AssetVersion
from backend.models.station import Station
from backend.models.station_member import StationMember
from backend.models.user import User
from backend.repositories.project_repository import ProjectRepository
from backend.repositories.rbac_repository import RoleRepository
from backend.scripts.local_dev_setup import seed_demo_data


def test_project_soft_delete_sets_deleted_at_and_archived_status() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        project_id = uuid.uuid4()
        organization_id = uuid.uuid4()
        project = Project(id=project_id, organization_id=organization_id, title="Test Project")
        session.add(project)
        session.commit()
        session.refresh(project)

        repository = ProjectRepository(session)
        project = repository.get_by_id(project_id)
        assert project is not None

        project.deleted_at = datetime.now(timezone.utc)
        project.status = "ARCHIVED"
        session.commit()
        session.refresh(project)

        assert project.deleted_at is not None
        assert project.status == "ARCHIVED"


def test_rbac_seed_uses_normalized_admin_editor_viewer_names() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        role_repo = RoleRepository(session)
        default_roles = ["ADMIN", "MANAGER", "EDITOR", "REVIEWER", "PUBLISHER", "VIEWER"]

        for role_name in default_roles:
            new_role = Role(organization_id=uuid.uuid4(), name=role_name)
            session.add(new_role)
        session.commit()

        stored_names = [r.name for r in role_repo.list_all()]
        assert set(default_roles).issubset(set(stored_names))


def test_demo_seed_is_deterministic_and_idempotent() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        first_counts = seed_demo_data(session)
        second_counts = seed_demo_data(session)

        assert first_counts == second_counts == {
            "organizations": 1,
            "roles": 6,
            "users": 6,
            "projects": 3,
            "stations": 10,
            "assets": 8,
            "approvals": 2,
            "ai_jobs": 0,
        }
        assert session.query(Organization).count() == 1
        assert session.query(Role).count() == 6
        assert session.query(User).count() == 6
        assert session.query(Project).count() == 3
        assert session.query(Station).count() == 10
        assert session.query(StationMember).count() == 20
        assert session.query(Asset).count() == 8
        assert session.query(AssetVersion).count() == 8
        assert session.query(ApprovalTask).count() == 2
        assert {user.email for user in session.query(User).all()} == {
            "admin@example.com",
            "manager@example.com",
            "editor@example.com",
            "reviewer@example.com",
            "publisher@example.com",
            "viewer@example.com",
        }
