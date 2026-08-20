from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID, uuid4

import bcrypt
import jwt
from fastapi import HTTPException, status
from pydantic import EmailStr

from backend.models.rbac import Role, UserRole
from backend.models.project import Project
from backend.models.station import Station
from backend.models.station_member import StationMember
from backend.models.project_member import ProjectMember
from backend.models.token_revocation import TokenRevocation
from backend.models.user import User

SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "6f2e19a3d9c142b5e12d0a9ffc2b1f3ae5d7c9bf0a0b4d4c8b6e8f1a3c2d4e5f",
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
REFRESH_TOKEN_EXPIRE_DAYS = 7


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))


def create_access_token(subject: str, extra_claims: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    jti = str(uuid4())
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "jti": jti,
        "type": "access",
    }
    if extra_claims:
        payload.update(extra_claims)
    payload["jti"] = jti
    payload["type"] = "access"
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(subject: str) -> str:
    now = datetime.now(timezone.utc)
    jti = str(uuid4())
    payload = {
        "sub": subject,
        "iat": now,
        "exp": now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        "type": "refresh",
        "jti": jti,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


def is_token_revoked(db: Any, jti: str | None) -> bool:
    if not jti:
        return False
    return db.query(TokenRevocation).filter(TokenRevocation.jti == jti).first() is not None


def revoke_token(db: Any, jti: str, token_type: str, user_id: str | UUID | None = None) -> None:
    if not jti or is_token_revoked(db, jti):
        return
    token = TokenRevocation(jti=jti, token_type=token_type, user_id=user_id)
    db.add(token)
    db.commit()


def build_claims(email: EmailStr, organization_id: str, roles: list[str] | None = None) -> dict[str, Any]:
    return {
        "email": str(email),
        "organization_id": organization_id,
        "roles": roles or ["VIEWER"],
    }


def get_user_roles(db: Any, user: User) -> list[str]:
    role_names = (
        db.query(Role.name)
        .join(UserRole, UserRole.role_id == Role.id)
        .filter(UserRole.user_id == user.id, Role.organization_id == user.organization_id)
        .order_by(Role.name)
        .all()
    )
    if not role_names:
        return ["VIEWER"]
    return [name for (name,) in role_names]


def ensure_default_user_role(db: Any, user: User, role_name: str = "VIEWER") -> None:
    role = db.query(Role).filter(Role.organization_id == user.organization_id, Role.name == role_name).first()
    if not role:
        role = Role(organization_id=user.organization_id, name=role_name, description=f"{role_name.title()} role")
        db.add(role)
        db.flush()

    existing_assignment = db.query(UserRole).join(Role, Role.id == UserRole.role_id).filter(
        UserRole.user_id == user.id,
        Role.organization_id == user.organization_id,
    ).first()
    if not existing_assignment:
        db.add(UserRole(user_id=user.id, role_id=role.id))


def has_required_roles(user_roles: list[str] | None, required_roles: tuple[str, ...] | list[str]) -> bool:
    """Return True when the user has at least one of the required roles.

    Administrators are implicitly granted access to all protected operations.
    """
    if not required_roles:
        return True

    normalized_user_roles = {role.upper() for role in (user_roles or [])}
    normalized_required_roles = {role.upper() for role in required_roles}
    return bool(normalized_required_roles & normalized_user_roles) or "ADMIN" in normalized_user_roles


def require_roles(user_roles: list[str] | None, required_roles: tuple[str, ...] | list[str]) -> None:
    if not has_required_roles(user_roles, required_roles):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"Requires {' or '.join(required_roles)} role or higher")


def is_admin(db: Any, user: User) -> bool:
    return "ADMIN" in {role.upper() for role in get_user_roles(db, user)}


def can_access_station(db: Any, user: User, station_id: UUID) -> bool:
    if is_admin(db, user):
        return db.query(Station.id).filter(
            Station.id == station_id,
            Station.organization_id == user.organization_id,
            Station.deleted_at.is_(None),
        ).first() is not None

    return db.query(StationMember.station_id).join(
        Station, Station.id == StationMember.station_id
    ).filter(
        StationMember.station_id == station_id,
        StationMember.user_id == user.id,
        Station.organization_id == user.organization_id,
        Station.deleted_at.is_(None),
    ).first() is not None


def can_access_project(db: Any, user: User, project_id: UUID) -> bool:
    if is_admin(db, user):
        return db.query(Project.id).filter(
            Project.id == project_id,
            Project.organization_id == user.organization_id,
            Project.deleted_at.is_(None),
        ).first() is not None

    if db.query(ProjectMember.project_id).filter(
        ProjectMember.project_id == project_id,
        ProjectMember.user_id == user.id,
    ).first() is not None:
        return True
    return db.query(StationMember.station_id).join(
        Station, Station.id == StationMember.station_id
    ).filter(
        Station.project_id == project_id,
        StationMember.user_id == user.id,
        Station.organization_id == user.organization_id,
        Station.deleted_at.is_(None),
    ).first() is not None


def can_access_asset(db: Any, user: User, asset: Any) -> bool:
    return (
        asset is not None
        and asset.organization_id == user.organization_id
        and asset.deleted_at is None
        and can_access_station(db, user, asset.station_id)
    )
