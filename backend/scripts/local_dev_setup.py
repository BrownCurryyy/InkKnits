"""Create a Postgres database, create all tables from ORM models, and seed demo data.

This script is intended for local backend development with Postgres. It:
 - creates the schema via SQLAlchemy `Base.metadata.create_all`
 - seeds a demo organization, admin user (admin@example.com / password123), one project and one station

Run: `python backend/scripts/local_dev_setup.py`
"""
from pathlib import Path
import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
import uuid

# Ensure repository root is on sys.path when script is invoked directly
REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from backend.database.base import Base
from backend.database.connection import DEFAULT_DATABASE_URL
from backend.models.organization import Organization
from backend.models.project import Project
from backend.models.station import Station
from backend.models.user import User
from backend.models.rbac import Role, UserRole
from backend.app.auth import hash_password

# Require DATABASE_URL or use the same Postgres default as the running app.
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
print("Using DATABASE_URL:", DATABASE_URL)

engine = create_engine(DATABASE_URL, future=True)

print("Creating database schema (this uses ORM models directly)")
Base.metadata.create_all(engine)

with Session(engine) as session:
    # Seed one organization
    org_id = uuid.uuid4()
    organization = Organization(id=org_id, name="Demo Org")
    session.add(organization)

    # Seed roles
    role_names = ["ADMIN", "MANAGER", "EDITOR", "REVIEWER", "PUBLISHER", "VIEWER"]
    roles = []
    for r in role_names:
        role = Role(id=uuid.uuid4(), organization_id=org_id, name=r)
        session.add(role)
        roles.append(role)

    # Seed admin user (store a hashed password so /auth/login works)
    user_id = uuid.uuid4()
    admin = User(id=user_id, organization_id=org_id, email="admin@example.com", display_name="Admin User", password_hash=hash_password("password123"))
    session.add(admin)
    session.flush()

    # Assign ADMIN role
    admin_role = [r for r in roles if r.name == "ADMIN"][0]
    session.add(UserRole(user_id=admin.id, role_id=admin_role.id))

    # Seed a project and station
    project = Project(id=uuid.uuid4(), organization_id=org_id, title="Demo Project")
    session.add(project)
    station = Station(id=uuid.uuid4(), organization_id=org_id, project_id=project.id, name="Demo Station")
    session.add(station)

    session.commit()

print("Local dev database initialized:")
print(" - Database URL:", DATABASE_URL)
print(" - Admin user: admin@example.com / password123 (password is hashed and ready for /auth/login)")
print("Next: start server: uvicorn backend.app.main:app --reload")
