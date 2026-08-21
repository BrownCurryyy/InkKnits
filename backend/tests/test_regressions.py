import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

import uuid

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
        org_id = uuid.uuid4()
        project_id = uuid.uuid4()
        station_id = uuid.uuid4()
        user_id = uuid.uuid4()
        role_id = uuid.uuid4()
        asset_id = uuid.uuid4()

        organization = Organization(id=org_id, name="Test Org")
        project = Project(id=project_id, organization_id=org_id, title="Test Project")
        station = Station(id=station_id, organization_id=org_id, project_id=project_id, name="Test Station", station_type="VIEWING")
        user = User(id=user_id, organization_id=org_id, email="user@example.com", display_name="Tester", password_hash="hash")
        role = Role(id=role_id, organization_id=org_id, name="Viewer")
        asset = Asset(id=asset_id, organization_id=org_id, station_id=station_id, name="Test Asset")
        member = StationMember(station_id=station_id, user_id=user_id)

        session.add_all([organization, project, station, user, role, asset, member])
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
