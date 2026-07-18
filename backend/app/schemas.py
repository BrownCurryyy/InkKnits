from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class OrganizationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    logo_path: str | None = None


class OrganizationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    logo_path: str | None = None


class ProjectCreate(BaseModel):
    organization_id: UUID
    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    status: str = "ACTIVE"
    deadline: datetime | None = None


class ProjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    title: str
    description: str | None = None
    status: str


class AssetCreate(BaseModel):
    organization_id: UUID
    station_id: UUID
    owner_id: UUID | None = None
    name: str = Field(..., min_length=1, max_length=255)
    asset_type: str = "GENERIC"
    storage_path: str | None = None
    raw_metadata: dict[str, Any] | None = None


class AssetOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    station_id: UUID
    owner_id: UUID | None = None
    name: str
    asset_type: str
    storage_path: str | None = None
    raw_metadata: dict[str, Any] | None = None


class AssetVersionCreate(BaseModel):
    asset_id: UUID
    version_number: int = Field(..., ge=1)
    snapshot_path: str
    raw_metadata: dict[str, Any] | None = None
    created_by: UUID | None = None


class AssetVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID
    version_number: int
    snapshot_path: str
    raw_metadata: dict[str, Any] | None = None
    created_by: UUID | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None


class ActivityCreate(BaseModel):
    organization_id: UUID | None = None
    project_id: UUID | None = None
    asset_id: UUID | None = None
    user_id: UUID | None = None
    activity_type: str = Field(..., min_length=1, max_length=100)
    description: str
    raw_metadata: dict[str, Any] | None = None


class ActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID | None = None
    project_id: UUID | None = None
    asset_id: UUID | None = None
    user_id: UUID | None = None
    activity_type: str
    description: str
    raw_metadata: dict[str, Any] | None = None
    created_at: datetime


class AuthRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    display_name: str = Field(..., min_length=1, max_length=100)
    organization_id: UUID


class AuthLogin(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    email: EmailStr
    display_name: str
    status: str
