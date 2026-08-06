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
        .filter(UserRole.user_id == user.id)
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

    existing_assignment = db.query(UserRole).filter(UserRole.user_id == user.id).first()
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
