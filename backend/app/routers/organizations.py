from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.routers.auth import get_current_user
from backend.app.auth import get_user_roles, require_roles
from backend.app.schemas import OrganizationCreate, OrganizationOut, OrganizationMemberAdd, UserOut, UserRoleUpdate
from backend.database.connection import get_db
from backend.models.organization import Organization
from backend.models.user import User
from backend.repositories.organization_repository import OrganizationRepository

router = APIRouter(prefix="/organizations", tags=["organizations"], dependencies=[Depends(get_current_user)])


@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> OrganizationOut:
    require_roles(get_user_roles(db, current_user), ("ADMIN",))
    repository = OrganizationRepository(db)
    organization = Organization(
        name=payload.name,
        description=payload.description,
        logo_path=payload.logo_path,
    )
    created = repository.create(organization)
    return OrganizationOut.model_validate(created)


@router.get("", response_model=list[OrganizationOut])
async def list_organizations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[OrganizationOut]:
    organization = db.get(Organization, current_user.organization_id)
    return [OrganizationOut.model_validate(organization)] if organization and organization.deleted_at is None else []


@router.get("/{organization_id}", response_model=OrganizationOut)
async def get_organization(organization_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> OrganizationOut:
    if str(current_user.organization_id) != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    repository = OrganizationRepository(db)
    organization = repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return OrganizationOut.model_validate(organization)


@router.get("/{organization_id}/members", response_model=list[UserOut])
async def list_members(organization_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)) -> list[UserOut]:
    """Return active members for an approval-task assignee picker."""
    if str(current_user.organization_id) != organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    members = (
        db.query(User)
        .filter(User.organization_id == organization_id, User.status == "ACTIVE", User.deleted_at.is_(None))
        .order_by(User.display_name)
        .all()
    )
    return [UserOut.model_validate(member) for member in members]


@router.post("/{organization_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(
    organization_id: str,
    payload: OrganizationMemberAdd,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_roles(get_user_roles(db, current_user), ("ADMIN",))
    if str(current_user.organization_id) != organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization access denied")
    # Direct assignment of user to organization (assuming user exists and is updated or checked)
    # Since our User model has organization_id, we just update the user's organization_id.
    from backend.models.user import User
    user = db.query(User).filter(User.id == str(payload.user_id)).first()
    if not user or user.deleted_at is not None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.organization_id != current_user.organization_id:
        raise HTTPException(status_code=409, detail="User already belongs to another organization")
        
    user.organization_id = organization_id
    db.commit()
    return {"message": "User added to organization"}


@router.delete("/{organization_id}/members/{user_id}", status_code=status.HTTP_200_OK)
async def remove_member(
    organization_id: str,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_roles(get_user_roles(db, current_user), ("ADMIN",))
    if str(current_user.organization_id) != organization_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization access denied")
    from backend.models.user import User
    user = db.query(User).filter(User.id == user_id, User.organization_id == organization_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in organization")
        
    # Just unset or set to a default generic org, or soft delete the user
    user.status = "REMOVED"
    db.commit()
    return {"message": "User removed from organization"}


@router.put("/{organization_id}/members/{user_id}/role", status_code=status.HTTP_200_OK)
async def update_member_role(
    organization_id: str,
    user_id: str,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_roles(get_user_roles(db, current_user), ("ADMIN",))
    if str(current_user.organization_id) != organization_id or user_id == str(current_user.id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization or administrator access denied")
    from backend.models.rbac import UserRole, Role
    # Find role
    role = db.query(Role).filter(Role.name == payload.role_name, Role.organization_id == organization_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found in organization")
        
    # Upsert UserRole
    user = db.query(User).filter(User.id == user_id, User.organization_id == organization_id, User.deleted_at.is_(None)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in organization")
    user_role = db.query(UserRole).join(Role, Role.id == UserRole.role_id).filter(
        UserRole.user_id == user_id,
        Role.organization_id == organization_id,
    ).first()
    if user_role:
        db.delete(user_role)
        
    new_user_role = UserRole(user_id=user_id, role_id=role.id)
    db.add(new_user_role)
    db.commit()
    return {"message": f"User role updated to {payload.role_name}"}
