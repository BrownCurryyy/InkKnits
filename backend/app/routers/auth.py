from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.auth import (
    build_claims,
    create_access_token,
    create_refresh_token,
    decode_access_token,
    ensure_default_user_role,
    get_user_roles,
    hash_password,
    is_token_revoked,
    revoke_token,
    verify_password,
)
from backend.app.schemas import AuthLogin, AuthRegister, TokenOut, UserOut, RefreshTokenRequest
from backend.database.connection import get_db
from backend.models.user import User
from backend.repositories.organization_repository import OrganizationRepository

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    try:
        claims = decode_access_token(credentials.credentials)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token") from exc

    if claims.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")

    if is_token_revoked(db, claims.get("jti")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")

    user = db.query(User).filter(User.id == claims.get("sub")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
async def register(payload: AuthRegister, db: Session = Depends(get_db)) -> TokenOut:
    organization_repository = OrganizationRepository(db)
    organization = organization_repository.get_by_id(str(payload.organization_id))
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    existing_user_count = db.query(User).filter(User.organization_id == payload.organization_id).count()
    role_name = "ADMIN" if existing_user_count == 0 else "VIEWER"

    user = User(
        organization_id=payload.organization_id,
        email=str(payload.email),
        display_name=payload.display_name,
        password_hash=hash_password(payload.password),
        status="ACTIVE",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    ensure_default_user_role(db, user, role_name=role_name)
    db.commit()

    token = create_access_token(
        str(user.id),
        extra_claims=build_claims(str(payload.email), str(user.organization_id), [role_name]),
    )
    refresh_token = create_refresh_token(str(user.id))
    return TokenOut(access_token=token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenOut)
async def login(payload: AuthLogin, db: Session = Depends(get_db)) -> TokenOut:
    user = db.query(User).filter(User.email == str(payload.email)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    roles = get_user_roles(db, user)
    token = create_access_token(
        str(user.id),
        extra_claims=build_claims(str(user.email), str(user.organization_id), roles),
    )
    refresh_token = create_refresh_token(str(user.id))
    return TokenOut(access_token=token, refresh_token=refresh_token)


class LogoutRequest(BaseModel):
    refresh_token: str | None = None


@router.post("/refresh", response_model=TokenOut)
async def refresh(payload: RefreshTokenRequest, db: Session = Depends(get_db)) -> TokenOut:
    try:
        claims = decode_access_token(payload.refresh_token)
        if claims.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    if is_token_revoked(db, claims.get("jti")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token revoked")

    user_id = claims.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    revoke_token(db, claims.get("jti"), "refresh", user_id=user.id)

    roles = get_user_roles(db, user)
    token = create_access_token(
        str(user.id),
        extra_claims=build_claims(str(user.email), str(user.organization_id), roles),
    )
    refresh_token = create_refresh_token(str(user.id))
    return TokenOut(access_token=token, refresh_token=refresh_token)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    payload: LogoutRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    from backend.services.activity_service import ActivityService

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    try:
        access_claims = decode_access_token(credentials.credentials)
        if access_claims.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    revoke_token(db, access_claims.get("jti"), "access", user_id=current_user.id)

    if payload and payload.refresh_token:
        try:
            refresh_claims = decode_access_token(payload.refresh_token)
            if refresh_claims.get("type") != "refresh":
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
            revoke_token(db, refresh_claims.get("jti"), "refresh", user_id=current_user.id)
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    ActivityService.log(db, "LOGOUT", f"User '{current_user.email}' logged out", organization_id=current_user.organization_id, user_id=current_user.id)
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserOut)
async def current_user(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)
