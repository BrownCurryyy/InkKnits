from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.schemas import ProjectCreate, ProjectOut
from backend.database.connection import get_db
from backend.models.project import Project
from backend.repositories.project_repository import ProjectRepository

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(payload: ProjectCreate, db: Session = Depends(get_db)) -> ProjectOut:
    repository = ProjectRepository(db)
    project = Project(
        organization_id=payload.organization_id,
        title=payload.title,
        description=payload.description,
        status=payload.status,
        deadline=payload.deadline,
    )
    created = repository.create(project)
    return ProjectOut.model_validate(created)


@router.get("", response_model=list[ProjectOut])
async def list_projects(db: Session = Depends(get_db)) -> list[ProjectOut]:
    repository = ProjectRepository(db)
    projects = repository.list_all()
    return [ProjectOut.model_validate(item) for item in projects]


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(project_id: str, db: Session = Depends(get_db)) -> ProjectOut:
    repository = ProjectRepository(db)
    project = repository.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return ProjectOut.model_validate(project)
