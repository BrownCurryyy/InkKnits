import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from backend.app.auth import build_claims
from backend.models.asset import Asset
from backend.models.organization import Organization
from backend.models.project import Project
from backend.models.rbac import Role
from backend.models.station import Station
from backend.models.station_member import StationMember
from backend.models.user import User


def test_build_claims_defaults_to_viewer_roles() -> None:
    claims = build_claims("user@example.com", "org-123")
    assert claims["roles"] == ["VIEWER"]


def test_core_models_populate_timestamps_on_flush() -> None:
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from backend.database.base import Base

    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)

    with Session(engine) as session:
        organization = Organization(name="Test Org")
        session.add(organization)
        session.flush()

        project = Project(organization_id=organization.id, title="Test Project")
        station = Station(organization_id=organization.id, project_id=project.id, name="Test Station")
        user = User(organization_id=organization.id, email="user@example.com", display_name="Tester", password_hash="hash")
        role = Role(organization_id=organization.id, name="Viewer")
        asset = Asset(organization_id=organization.id, station_id=station.id, name="Test Asset")
        member = StationMember(station_id=station.id, user_id=user.id)

        session.add_all([project, station, user, role, asset, member])
        session.flush()

        assert organization.created_at is not None
        assert organization.updated_at is not None
        assert project.created_at is not None
        assert project.updated_at is not None
        assert station.created_at is not None
        assert station.updated_at is not None
        assert user.created_at is not None
        assert user.updated_at is not None
        assert role.created_at is not None
        assert role.updated_at is not None
        assert asset.created_at is not None
        assert asset.updated_at is not None
        assert member.joined_at is not None
