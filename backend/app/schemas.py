from datetime import datetime
from typing import Any, Literal
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
    title: str | None = None
    content: str | None = None
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
    title: str | None = None
    description: str | None = None
    content: str | None = None
    asset_type: str
    storage_path: str | None = None
    raw_metadata: dict[str, Any] | None = None


class AssetLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    parent_asset_id: UUID
    child_asset_id: UUID
    relationship_type: str
    created_at: datetime


class AssetLinkCreate(BaseModel):
    child_asset_id: UUID
    relationship_type: str = Field(default="ATTACHMENT", min_length=1, max_length=50)


class AssetLineageOut(BaseModel):
    asset: AssetOut
    parents: list[AssetOut]
    children: list[AssetOut]
    links: list[AssetLinkOut]


class ProjectLineageOut(BaseModel):
    project_id: UUID
    assets: list[AssetOut]
    links: list[AssetLinkOut]


class AssetVersionCreate(BaseModel):
    asset_id: UUID
    version_number: int = Field(..., ge=1)
    snapshot_path: str
    raw_metadata: dict[str, Any] | None = None
    parent_version_id: UUID | None = None
    created_by: UUID | None = Field(default=None)


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


class ProjectProductionAssetState(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    asset: AssetOut
    current_version: AssetVersionOut
    is_active: bool = True


class ProjectProductionStateOut(BaseModel):
    project_id: UUID
    assets: list[ProjectProductionAssetState]
    links: list[AssetLinkOut] = Field(default_factory=list)


class VersionBundleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class VersionBundleItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID
    version_id: UUID
    version_number: int
    asset_title: str
    asset_type: str
    created_by: UUID | None = None
    created_at: datetime
    snapshot_preview: str | None = None


class VersionBundleOut(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    created_by: UUID
    created_at: datetime
    is_active: bool
    items: list[VersionBundleItemOut] = Field(default_factory=list)


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
    role: Literal["ADMIN", "EDITOR", "REVIEWER", "VIEWER"] = "VIEWER"


class AuthLogin(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    email: EmailStr
    display_name: str
    status: str


class OrganizationRosterMemberOut(BaseModel):
    user: UserOut
    role: Literal["ADMIN", "EDITOR", "REVIEWER", "VIEWER"]
    station_names: list[str] = Field(default_factory=list)


class RoleCreate(BaseModel):
    organization_id: UUID
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    organization_id: UUID
    name: str
    description: str | None = None


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    permission_name: str
    description: str | None = None


class AIJobCreate(BaseModel):
    asset_id: UUID | None = None
    organization_id: UUID | None = None
    station_id: UUID | None = None
    job_type: str = Field(..., min_length=1, max_length=50)
    priority: int = 100
    model: str | None = None
    prompt: str | None = None
    parameters: str | None = None


class AIJobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID | None = None
    organization_id: UUID | None = None
    station_id: UUID | None = None
    created_by: UUID | None = None
    job_type: str
    priority: int
    status: str
    queue_position: int | None = None
    model: str | None = None
    prompt: str | None = None
    parameters: str | None = None
    result_asset: str | None = None
    result_data: str | None = None
    error: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime


class ApprovalTaskCreate(BaseModel):
    asset_id: UUID
    assigned_to: UUID
    deadline: datetime | None = None
    comments: str | None = None


class ApprovalTaskOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    asset_id: UUID
    assigned_to: UUID
    assigned_by: UUID
    status: str
    deadline: datetime | None = None
    escalated_to: UUID | None = None
    comments: str | None = None
    created_at: datetime
    completed_at: datetime | None = None


class StationCreate(BaseModel):
    project_id: UUID
    name: str = Field(..., min_length=1, max_length=255)
    station_type: Literal["WRITING", "GENERATION", "VIEWING", "IMAGE", "APPROVAL"]
    description: str | None = None


class StationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    project_id: UUID
    name: str
    station_type: Literal["WRITING", "GENERATION", "VIEWING", "IMAGE", "APPROVAL"]
    description: str | None = None


class UserRoleUpdate(BaseModel):
    role_name: str


class ProjectUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: str | None = None
    deadline: datetime | None = None


class ProjectMemberAdd(BaseModel):
    user_id: UUID


class OrganizationMemberAdd(BaseModel):
    user_id: UUID


class AssetUpdate(BaseModel):
    name: str | None = None
    title: str | None = None
    content: str | None = None
    asset_type: str | None = None


class AssetPropertiesUpdate(BaseModel):
    title: str | None = None
    description: str | None = None


class AssetMetadataUpdate(BaseModel):
    raw_metadata: dict


class AIJobSubmit(BaseModel):
    """Validated payload accepted by the asynchronous AI job API."""

    job_type: Literal[
        "TEXT", "REWRITE", "IMPROVE_TONE", "CHANGE_AUDIENCE", "SUMMARIZE",
        "EXPAND", "ATOMIZE", "IMAGE",
    ]
    created_by: UUID | None = Field(default=None)
    organization_id: UUID | None = None
    station_id: UUID | None = None
    asset_id: UUID | None = None
    prompt: str = Field(default="", max_length=12000)
    draft: str = Field(default="", max_length=12000)
    action: str = "generate"
    mood: str = "Professional"
    style: str = "Narrative"
    audience: str = ""
    content_length: str = ""
    formats: list[str] = Field(default_factory=list, max_length=12)
    model: str | None = Field(default=None, max_length=100)
    width: int = Field(default=512, ge=64, le=1024, multiple_of=64)
    height: int = Field(default=512, ge=64, le=1024, multiple_of=64)
    name: str | None = Field(default=None, max_length=255)
    title: str | None = Field(default=None, max_length=255)


class AIJobStatus(BaseModel):
    task_id: UUID
    job_type: str
    priority: int
    status: str
    queue_position: int | None = None
    result: dict[str, Any] | None = None
    error: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None


class AIJobQueueOut(BaseModel):
    task_id: UUID
    job_type: str
    project_id: UUID | None = None
    station_id: UUID | None = None
    asset_id: UUID | None = None
    created_by: UUID
    priority: int
    status: str
    queue_position: int | None = None
    model: str | None = None
    prompt: str | None = None
    result: dict[str, Any] | None = None
    result_available: bool = False
    error: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    completed_at: datetime | None = None
