from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.schemas import OrganizationCreate, OrganizationOut
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
