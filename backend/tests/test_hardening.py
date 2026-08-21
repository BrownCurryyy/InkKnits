import io
import uuid
import unittest

from fastapi import UploadFile
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.app.auth import can_access_station, get_user_roles, has_required_roles
from backend.app.auth import can_access_project, require_roles
from backend.app.routers.activities import create_activity
from backend.app.schemas import ActivityCreate, AIJobSubmit
from backend.database.base import Base
from backend.models.organization import Organization
from backend.models.rbac import Role, UserRole
from backend.models.station import Station
from backend.models.station_member import StationMember
from backend.models.user import User
from backend.models.project import Project
from backend.services.storage import StorageService


class HardeningTests(unittest.TestCase):
    def test_has_required_roles_accepts_admin_override(self) -> None:
        self.assertTrue(has_required_roles(["VIEWER", "ADMIN"], ("EDITOR", "MANAGER")))

    def test_has_required_roles_rejects_missing_role(self) -> None:
        self.assertFalse(has_required_roles(["VIEWER"], ("EDITOR", "MANAGER")))

    def test_validate_upload_file_rejects_unsupported_extension(self) -> None:
        upload = UploadFile(
            filename="payload.exe",
            file=io.BytesIO(b"not-an-allowed-file"),
            headers={"content-type": "application/x-msdownload"},
        )

        with self.assertRaises(ValueError):
            StorageService.validate_upload_file(upload)

    def test_get_user_roles_is_scoped_to_user_organization(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)

        with Session(engine) as session:
            organization_id = uuid.uuid4()
            other_organization_id = uuid.uuid4()
            user = User(
                id=uuid.uuid4(),
                organization_id=organization_id,
                email="member@example.com",
                display_name="Member",
                password_hash="hash",
            )
            local_role = Role(id=uuid.uuid4(), organization_id=organization_id, name="EDITOR")
            foreign_role = Role(id=uuid.uuid4(), organization_id=other_organization_id, name="ADMIN")
            session.add_all([Organization(id=organization_id, name="Local"), Organization(id=other_organization_id, name="Other"), user, local_role, foreign_role])
            session.flush()
            session.add_all([UserRole(user_id=user.id, role_id=local_role.id), UserRole(user_id=user.id, role_id=foreign_role.id)])
            session.commit()

            self.assertEqual(get_user_roles(session, user), ["EDITOR"])

    def test_station_access_requires_membership_unless_admin(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)

        with Session(engine) as session:
            organization_id = uuid.uuid4()
            organization = Organization(id=organization_id, name="Local")
            project = Project(id=uuid.uuid4(), organization_id=organization_id, title="Campaign")
            assigned_station = Station(id=uuid.uuid4(), organization_id=organization_id, project_id=project.id, name="Writing", station_type="WRITING")
            unassigned_station = Station(id=uuid.uuid4(), organization_id=organization_id, project_id=project.id, name="Image", station_type="IMAGE")
            editor = User(id=uuid.uuid4(), organization_id=organization_id, email="editor@example.com", display_name="Editor", password_hash="hash")
            admin = User(id=uuid.uuid4(), organization_id=organization_id, email="admin@example.com", display_name="Admin", password_hash="hash")
            editor_role = Role(id=uuid.uuid4(), organization_id=organization_id, name="EDITOR")
            admin_role = Role(id=uuid.uuid4(), organization_id=organization_id, name="ADMIN")
            session.add_all([organization, project, assigned_station, unassigned_station, editor, admin, editor_role, admin_role])
            session.flush()
            session.add_all([
                StationMember(station_id=assigned_station.id, user_id=editor.id),
                UserRole(user_id=editor.id, role_id=editor_role.id),
                UserRole(user_id=admin.id, role_id=admin_role.id),
            ])
            session.commit()

            self.assertTrue(can_access_station(session, editor, assigned_station.id))
            self.assertFalse(can_access_station(session, editor, unassigned_station.id))
            self.assertTrue(can_access_station(session, admin, unassigned_station.id))

    def test_project_access_is_same_org_and_station_scoped(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)

        with Session(engine) as session:
            local_org = Organization(id=uuid.uuid4(), name="Local")
            foreign_org = Organization(id=uuid.uuid4(), name="Foreign")
            local_project = Project(id=uuid.uuid4(), organization_id=local_org.id, title="Local Project")
            foreign_project = Project(id=uuid.uuid4(), organization_id=foreign_org.id, title="Foreign Project")
            local_station = Station(id=uuid.uuid4(), organization_id=local_org.id, project_id=local_project.id, name="Writing", station_type="WRITING")
            member = User(id=uuid.uuid4(), organization_id=local_org.id, email="writer@example.com", display_name="Writer", password_hash="hash")
            session.add_all([local_org, foreign_org, local_project, foreign_project, local_station, member])
            session.flush()
            session.add(StationMember(station_id=local_station.id, user_id=member.id))
            session.commit()

            self.assertTrue(can_access_project(session, member, local_project.id))
            self.assertFalse(can_access_project(session, member, foreign_project.id))

    def test_viewer_cannot_pass_write_role_guard(self) -> None:
        with self.assertRaises(Exception):
            require_roles(["VIEWER"], ("EDITOR", "ADMIN"))

    def test_activity_creation_derives_current_user_identity(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)

        with Session(engine) as session:
            organization = Organization(id=uuid.uuid4(), name="Local")
            user = User(id=uuid.uuid4(), organization_id=organization.id, email="actor@example.com", display_name="Actor", password_hash="hash")
            session.add_all([organization, user])
            session.commit()

            payload = ActivityCreate(
                activity_type="TEST",
                description="authenticated event",
                user_id=None,
                organization_id=None,
            )
            activity = __import__("asyncio").run(create_activity(payload, session, user))

            self.assertEqual(activity.user_id, user.id)
            self.assertEqual(activity.organization_id, organization.id)

    def test_activity_creation_rejects_forged_user_identity(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)

        with Session(engine) as session:
            organization = Organization(id=uuid.uuid4(), name="Local")
            actor = User(id=uuid.uuid4(), organization_id=organization.id, email="actor2@example.com", display_name="Actor", password_hash="hash")
            forged_user = User(id=uuid.uuid4(), organization_id=organization.id, email="forged@example.com", display_name="Forged", password_hash="hash")
            session.add_all([organization, actor, forged_user])
            session.commit()

            payload = ActivityCreate(activity_type="TEST", description="forged event", user_id=forged_user.id)
            with self.assertRaises(HTTPException):
                __import__("asyncio").run(create_activity(payload, session, actor))

    def test_ai_submit_schema_allows_server_derived_creator(self) -> None:
        payload = AIJobSubmit(job_type="TEXT", prompt="draft")
        self.assertIsNone(payload.created_by)


if __name__ == "__main__":
    unittest.main()
