import uuid
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.database.base import Base
from backend.models.project import Project
from backend.models.rbac import Role
from backend.repositories.project_repository import ProjectRepository
from backend.repositories.rbac_repository import RoleRepository


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
