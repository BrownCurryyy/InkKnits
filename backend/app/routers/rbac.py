from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.routers.auth import get_current_user
from backend.app.auth import CANONICAL_ROLES, get_user_roles, require_roles
from backend.app.schemas import RoleCreate, RoleOut, PermissionOut
from backend.database.connection import get_db
from backend.models.rbac import Role, Permission
from backend.models.user import User
from backend.repositories.rbac_repository import RoleRepository, PermissionRepository

router = APIRouter(prefix="/rbac", tags=["rbac"], dependencies=[Depends(get_current_user)])


@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> RoleOut:
    require_roles(get_user_roles(db, current_user), ("ADMIN",))
    role_repo = RoleRepository(db)
    role = Role(
        organization_id=payload.organization_id,
        name=payload.name,
        description=payload.description
    )
    role_repo.create(role)
    return role


@router.get("/roles", response_model=List[RoleOut])
async def list_roles(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[RoleOut]:
    require_roles(get_user_roles(db, current_user), ("ADMIN",))
    role_repo = RoleRepository(db)
    return role_repo.list_all()


@router.post("/seed", status_code=status.HTTP_201_CREATED)
async def seed_rbac(
    organization_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    require_roles(get_user_roles(db, current_user), ("ADMIN",))
    # Basic seeder for default roles and permissions
    role_repo = RoleRepository(db)
    
    default_roles = list(CANONICAL_ROLES)
    created_roles = []
    
    # Simple check if roles already exist for org
    existing_roles = [r.name for r in role_repo.list_all() if str(r.organization_id) == organization_id]
    
    for role_name in default_roles:
        if role_name not in existing_roles:
            new_role = Role(organization_id=organization_id, name=role_name, description=f"Default {role_name} role")
            role_repo.create(new_role)
            created_roles.append(role_name)
            
    return {"message": f"Seeded roles: {created_roles}"}


@router.get("/permissions", response_model=List[PermissionOut])
async def list_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[PermissionOut]:
    require_roles(get_user_roles(db, current_user), ("ADMIN",))
    perm_repo = PermissionRepository(db)
    return perm_repo.list_all()
