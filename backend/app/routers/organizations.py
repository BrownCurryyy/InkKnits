from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.schemas import OrganizationCreate, OrganizationOut, OrganizationMemberAdd, UserRoleUpdate
from backend.database.connection import get_db
from backend.models.organization import Organization
from backend.repositories.organization_repository import OrganizationRepository

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post("", response_model=OrganizationOut, status_code=status.HTTP_201_CREATED)
async def create_organization(payload: OrganizationCreate, db: Session = Depends(get_db)) -> OrganizationOut:
    repository = OrganizationRepository(db)
    organization = Organization(
        name=payload.name,
        description=payload.description,
        logo_path=payload.logo_path,
    )
    created = repository.create(organization)
    return OrganizationOut.model_validate(created)


@router.get("", response_model=list[OrganizationOut])
async def list_organizations(db: Session = Depends(get_db)) -> list[OrganizationOut]:
    repository = OrganizationRepository(db)
    organizations = repository.list_all()
    return [OrganizationOut.model_validate(item) for item in organizations]


@router.get("/{organization_id}", response_model=OrganizationOut)
async def get_organization(organization_id: str, db: Session = Depends(get_db)) -> OrganizationOut:
    repository = OrganizationRepository(db)
    organization = repository.get_by_id(organization_id)
    if not organization:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return OrganizationOut.model_validate(organization)


@router.post("/{organization_id}/members", status_code=status.HTTP_201_CREATED)
async def add_member(organization_id: str, payload: OrganizationMemberAdd, db: Session = Depends(get_db)) -> dict:
    # Direct assignment of user to organization (assuming user exists and is updated or checked)
    # Since our User model has organization_id, we just update the user's organization_id.
    from backend.models.user import User
    user = db.query(User).filter(User.id == str(payload.user_id)).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.organization_id = organization_id
    db.commit()
    return {"message": "User added to organization"}


@router.delete("/{organization_id}/members/{user_id}", status_code=status.HTTP_200_OK)
async def remove_member(organization_id: str, user_id: str, db: Session = Depends(get_db)) -> dict:
    from backend.models.user import User
    user = db.query(User).filter(User.id == user_id, User.organization_id == organization_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found in organization")
        
    # Just unset or set to a default generic org, or soft delete the user
    user.status = "REMOVED"
    db.commit()
    return {"message": "User removed from organization"}


@router.put("/{organization_id}/members/{user_id}/role", status_code=status.HTTP_200_OK)
async def update_member_role(organization_id: str, user_id: str, payload: UserRoleUpdate, db: Session = Depends(get_db)) -> dict:
    from backend.models.rbac import UserRole, Role
    # Find role
    role = db.query(Role).filter(Role.name == payload.role_name, Role.organization_id == organization_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found in organization")
        
    # Upsert UserRole
    user_role = db.query(UserRole).filter(UserRole.user_id == user_id).first()
    if user_role:
        db.delete(user_role)
        
    new_user_role = UserRole(user_id=user_id, role_id=role.id)
    db.add(new_user_role)
    db.commit()
    return {"message": f"User role updated to {payload.role_name}"}
