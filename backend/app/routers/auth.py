from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.app.auth import build_claims, create_access_token, hash_password, verify_password, create_refresh_token, decode_access_token
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

    token = create_access_token(
        str(user.id),
        extra_claims=build_claims(str(payload.email), str(user.organization_id), ["ADMIN"]),
    )
    refresh_token = create_refresh_token(str(user.id))
    return TokenOut(access_token=token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenOut)
async def login(payload: AuthLogin, db: Session = Depends(get_db)) -> TokenOut:
    user = db.query(User).filter(User.email == str(payload.email)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(
        str(user.id),
        extra_claims=build_claims(str(user.email), str(user.organization_id), ["VIEWER"]),
    )
    refresh_token = create_refresh_token(str(user.id))
    return TokenOut(access_token=token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenOut)
async def refresh(payload: RefreshTokenRequest, db: Session = Depends(get_db)) -> TokenOut:
    try:
        claims = decode_access_token(payload.refresh_token)
        if claims.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired refresh token")

    user_id = claims.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    token = create_access_token(
        str(user.id),
        extra_claims=build_claims(str(user.email), str(user.organization_id), ["VIEWER"]),
    )
    refresh_token = create_refresh_token(str(user.id))
    return TokenOut(access_token=token, refresh_token=refresh_token)


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> dict:
    from backend.services.activity_service import ActivityService

    ActivityService.log(db, "LOGOUT", f"User '{current_user.email}' logged out", organization_id=current_user.organization_id, user_id=current_user.id)
    return {"message": "Successfully logged out"}


@router.get("/me", response_model=UserOut)
async def current_user(current_user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(current_user)
