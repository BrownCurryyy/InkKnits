import unittest
import json
from unittest.mock import patch
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.database.base import Base
from backend.models.approval_task import ApprovalTask
from backend.models.ai_job import AIJob as PersistedAIJob
from backend.models.activity import Activity
from backend.models.asset import Asset
from backend.models.asset_link import AssetLink
from backend.models.asset_version import AssetVersion
from backend.models.organization import Organization
from backend.models.project import Project
from backend.models.station_member import StationMember
from backend.models.station import Station
from backend.models.user import User
from backend.services.ai_scheduler import AIScheduler
from backend.services.ai_scheduler import JobPriority
from backend.services.approval_service import ApprovalService
from backend.app.routers.assets import get_asset_lineage
from backend.app.routers.projects import get_project_lineage, get_project_production_state
from backend.app.routers.auth import get_current_user


class Phase910Tests(unittest.TestCase):
    def test_auto_escalation_marks_overdue_tasks(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)

        with Session(engine) as session:
            task = ApprovalTask(
                asset_id=uuid4(),
                assigned_to=uuid4(),
                assigned_by=uuid4(),
                status="PENDING",
                deadline=datetime.now(timezone.utc) - timedelta(minutes=5),
                created_at=datetime.now(timezone.utc),
            )
            session.add(task)
            session.commit()
            session.refresh(task)

            escalated_ids = ApprovalService.escalate_overdue(session, now=datetime.now(timezone.utc))
            session.refresh(task)

            self.assertEqual(task.status, "ESCALATED")
            self.assertEqual(escalated_ids, [task.id])

    def test_scheduler_cancel_marks_job_cancelled(self) -> None:
        scheduler = AIScheduler()
        job = scheduler.submit("TEXT", {"prompt": "demo"})

        self.assertTrue(scheduler.cancel(job.task_id))
        self.assertEqual(scheduler.get_job(job.task_id).status, "CANCELLED")

    def test_scheduler_prioritizes_text_before_image(self) -> None:
        scheduler = AIScheduler()
        text_job = scheduler.submit("TEXT", {"prompt": "text"})
        image_job = scheduler.submit("IMAGE", {"prompt": "image"})

        self.assertLess(text_job.priority, image_job.priority)
        self.assertEqual(text_job.priority, int(JobPriority.TEXT_GENERATE))
        self.assertEqual(image_job.priority, int(JobPriority.IMAGE_GENERATE))

    def test_scheduler_persists_result_and_error(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)

        with Session(engine) as session:
            organization = Organization(id=uuid4(), name="AI Test Org")
            user = User(id=uuid4(), organization_id=organization.id, email="ai@example.com", display_name="AI User", password_hash="hash")
            session.add_all([organization, user])
            session.commit()

            persisted = PersistedAIJob(
                id=uuid4(),
                organization_id=organization.id,
                created_by=user.id,
                job_type="TEXT",
                priority=1,
                status="QUEUED",
                created_at=datetime.now(timezone.utc),
            )
            session.add(persisted)
            session.commit()

            scheduler = AIScheduler()
            job = scheduler.submit("TEXT", {"created_by": str(user.id)}, task_id=str(persisted.id))
            job.status = "FAILED"
            job.error = "Ollama unavailable"
            job.result = {"content": "partial result"}
            job.completed_at = datetime.now(timezone.utc)
            with patch("backend.database.connection.SessionLocal", side_effect=lambda: Session(engine)):
                scheduler._persist_job_state(job)

            session.refresh(persisted)
            self.assertEqual(persisted.error, "Ollama unavailable")
            self.assertEqual(json.loads(persisted.result_data), {"content": "partial result"})

    def test_atomization_materializes_lineage_versions_and_activity(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)

        with Session(engine) as session:
            organization = Organization(id=uuid4(), name="Atomization Org")
            project = Project(id=uuid4(), organization_id=organization.id, title="Atomization Project")
            station = Station(id=uuid4(), organization_id=organization.id, project_id=project.id, name="Writing")
            user = User(id=uuid4(), organization_id=organization.id, email="atomizer@example.com", display_name="Atomizer", password_hash="hash")
            parent = Asset(
                id=uuid4(),
                organization_id=organization.id,
                station_id=station.id,
                owner_id=user.id,
                name="master",
                title="Master Asset",
                content="The master campaign story.",
                asset_type="TEXT",
            )
            session.add_all([organization, project, station, user, parent])
            session.add(StationMember(station_id=station.id, user_id=user.id))
            session.commit()

            from backend.services.ai_scheduler import AIJob

            job = AIJob("ATOMIZE", {
                "asset_id": str(parent.id),
                "organization_id": str(organization.id),
                "station_id": str(station.id),
                "created_by": str(user.id),
            })
            job.result = {"results": [
                {"format": "Blog", "content": "A blog child."},
                {"format": "LinkedIn", "content": "A LinkedIn child."},
            ]}
            job.completed_at = datetime.now(timezone.utc)

            child_ids = AIScheduler._create_result_assets(session, job)
            session.refresh(parent)

            links = session.query(AssetLink).filter(AssetLink.parent_asset_id == parent.id).all()
            child_assets = session.query(Asset).filter(Asset.id.in_([link.child_asset_id for link in links])).all()

            self.assertEqual(len(child_ids), 2)
            self.assertEqual(parent.content, "The master campaign story.")
            self.assertEqual(len(links), 2)
            self.assertEqual(len(child_assets), 2)
            self.assertEqual(session.query(AssetVersion).filter(AssetVersion.asset_id.in_([child.id for child in child_assets])).count(), 2)
            self.assertEqual(session.query(Activity).filter(Activity.asset_id.in_([child.id for child in child_assets]), Activity.activity_type == "ASSET_CREATED").count(), 2)
            self.assertEqual(session.query(Activity).filter(Activity.asset_id.in_([child.id for child in child_assets]), Activity.activity_type == "ATOMIZED").count(), 2)

    def test_lineage_routes_respect_station_scope(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)

        with Session(engine) as session:
            org = Organization(id=uuid4(), name="Lineage Org")
            project = Project(id=uuid4(), organization_id=org.id, title="Lineage Project")
            station = Station(id=uuid4(), organization_id=org.id, project_id=project.id, name="Writing")
            member = User(id=uuid4(), organization_id=org.id, email="member-lineage@example.com", display_name="Member", password_hash="hash")
            outsider = User(id=uuid4(), organization_id=org.id, email="outsider-lineage@example.com", display_name="Outsider", password_hash="hash")
            parent = Asset(id=uuid4(), organization_id=org.id, station_id=station.id, owner_id=member.id, name="parent", title="Parent", content="Parent", asset_type="TEXT")
            child = Asset(id=uuid4(), organization_id=org.id, station_id=station.id, owner_id=member.id, name="child", title="Child", content="Child", asset_type="BLOG")
            link = AssetLink(parent_asset_id=parent.id, child_asset_id=child.id, relationship_type="ATOMIZED_FROM")
            session.add_all([org, project, station, member, outsider, parent, child, link, StationMember(station_id=station.id, user_id=member.id)])
            session.commit()

            member_lineage = __import__("asyncio").run(get_asset_lineage(str(parent.id), session, member))
            project_lineage = __import__("asyncio").run(get_project_lineage(str(project.id), session, member))
            self.assertEqual(member_lineage.children[0].id, child.id)
            self.assertEqual(project_lineage.project_id, project.id)
            self.assertEqual(len(project_lineage.links), 1)

            from fastapi import HTTPException
            with self.assertRaises(HTTPException):
                __import__("asyncio").run(get_asset_lineage(str(parent.id), session, outsider))

    def test_project_production_state_uses_latest_version_per_asset(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)

        with Session(engine) as session:
            org = Organization(id=uuid4(), name="Production State Org")
            project = Project(id=uuid4(), organization_id=org.id, title="Campaign")
            station = Station(id=uuid4(), organization_id=org.id, project_id=project.id, name="Writing")
            member = User(id=uuid4(), organization_id=org.id, email="producer@example.com", display_name="Producer", password_hash="hash")

            article = Asset(id=uuid4(), organization_id=org.id, station_id=station.id, owner_id=member.id, name="master_article", title="Master Article", content="Version 1", asset_type="ARTICLE")
            image = Asset(id=uuid4(), organization_id=org.id, station_id=station.id, owner_id=member.id, name="hero_image", title="Hero Image", content="Image 1", asset_type="IMAGE")
            session.add_all([org, project, station, member, article, image, StationMember(station_id=station.id, user_id=member.id)])
            session.commit()

            session.add_all([
                AssetVersion(id=uuid4(), asset_id=article.id, version_number=1, snapshot_path="/tmp/article-v1.txt", raw_metadata={"name": "Master Article"}, created_by=member.id),
                AssetVersion(id=uuid4(), asset_id=article.id, version_number=2, snapshot_path="/tmp/article-v2.txt", raw_metadata={"name": "Master Article"}, created_by=member.id),
                AssetVersion(id=uuid4(), asset_id=article.id, version_number=3, snapshot_path="/tmp/article-v3.txt", raw_metadata={"name": "Master Article"}, created_by=member.id),
                AssetVersion(id=uuid4(), asset_id=image.id, version_number=1, snapshot_path="/tmp/image-v1.txt", raw_metadata={"name": "Hero Image"}, created_by=member.id),
                AssetVersion(id=uuid4(), asset_id=image.id, version_number=2, snapshot_path="/tmp/image-v2.txt", raw_metadata={"name": "Hero Image"}, created_by=member.id),
            ])
            session.commit()

            state = __import__("asyncio").run(get_project_production_state(str(project.id), session, member))

            self.assertEqual(state.project_id, project.id)
            self.assertEqual(len(state.assets), 2)
            by_name = {item.asset.name: item for item in state.assets}
            self.assertEqual(by_name["master_article"].current_version.version_number, 3)
            self.assertEqual(by_name["hero_image"].current_version.version_number, 2)
            self.assertTrue(all(item.is_active for item in state.assets))

    def test_project_production_state_respects_station_scope(self) -> None:
        engine = create_engine("sqlite:///:memory:")
        Base.metadata.create_all(engine)

        with Session(engine) as session:
            org = Organization(id=uuid4(), name="Production Scope Org")
            project = Project(id=uuid4(), organization_id=org.id, title="Scoped Campaign")
            station = Station(id=uuid4(), organization_id=org.id, project_id=project.id, name="Writing")
            member = User(id=uuid4(), organization_id=org.id, email="state-member@example.com", display_name="Member", password_hash="hash")
            outsider = User(id=uuid4(), organization_id=org.id, email="state-outsider@example.com", display_name="Outsider", password_hash="hash")
            asset = Asset(id=uuid4(), organization_id=org.id, station_id=station.id, owner_id=member.id, name="story", title="Story", content="Draft", asset_type="ARTICLE")
            session.add_all([org, project, station, member, outsider, asset, StationMember(station_id=station.id, user_id=member.id)])
            session.commit()
            session.add(AssetVersion(id=uuid4(), asset_id=asset.id, version_number=1, snapshot_path="/tmp/state-v1.txt", raw_metadata={"name": "Story"}, created_by=member.id))
            session.commit()

            state = __import__("asyncio").run(get_project_production_state(str(project.id), session, member))
            self.assertEqual(len(state.assets), 1)

            from fastapi import HTTPException
            with self.assertRaises(HTTPException):
                __import__("asyncio").run(get_project_production_state(str(project.id), session, outsider))


if __name__ == "__main__":
    unittest.main()
