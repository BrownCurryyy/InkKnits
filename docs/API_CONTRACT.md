# API Contract

## Overview
This document describes the backend API surface that the frontend should target for InkKnits.

- Base URL: /api
- Authentication: JWT bearer tokens via Authorization header
- Content type: JSON for most requests; multipart/form-data for file uploads
- Versioning: current contract is aligned with the FastAPI routers in the backend package

## Authentication

### POST /auth/register
Create a user and return access and refresh tokens.

Request body:
- email: string
- password: string
- display_name: string
- organization_id: UUID

Response:
- access_token: string
- refresh_token: string
- token_type: bearer

### POST /auth/login
Authenticate a user and return tokens.

### POST /auth/refresh
Refresh an expired access token with a valid refresh token.

### POST /auth/logout
Invalidate the current session server-side for the authenticated user.

### GET /auth/me
Return the current authenticated user profile.

## Organizations

### POST /organizations
Create an organization.

### GET /organizations
List organizations.

### GET /organizations/{organization_id}
Get a single organization.

### POST /organizations/{organization_id}/members
Add a user to an organization.

### DELETE /organizations/{organization_id}/members/{user_id}
Remove a user from an organization.

### PUT /organizations/{organization_id}/members/{user_id}/role
Assign or update a role for a user.

## Projects

### POST /projects
Create a project.

### GET /projects
List projects.

### GET /projects/{project_id}
Get a project.

### PUT /projects/{project_id}
Update a project.

### DELETE /projects/{project_id}
Soft delete a project.

## Stations

### POST /stations
Create a station.

### GET /stations
List stations.

### GET /stations/{station_id}
Get a station.

## Assets

### POST /assets
Create a text or generic asset.

### POST /assets/upload
Upload a file asset.

Form fields:
- organization_id
- station_id
- owner_id (optional)
- name
- asset_type (optional)
- file

### GET /assets
List non-deleted assets.

### GET /assets/search?q=term
Search assets by name or title.

### GET /assets/{asset_id}
Get a single asset.

### GET /assets/{asset_id}/download
Download a stored asset as base64 content.

### PUT /assets/{asset_id}
Update core asset fields.

### PATCH /assets/{asset_id}/metadata
Merge metadata into the asset.

### DELETE /assets/{asset_id}
Soft delete an asset.

## Versions

### GET /versions
List versions for all assets.

### GET /versions/{asset_id}
List versions for a single asset.

### POST /versions/{asset_id}
Create a new version snapshot.

### POST /versions/{asset_id}/restore
Restore a previous version.

## Activity

### GET /activities
List activity entries.

### GET /activities/{activity_id}
Get a single activity entry.

## Approvals

### POST /approvals/tasks
Create an approval task.

### GET /approvals/tasks
List approval tasks.

### POST /approvals/tasks/{task_id}/approve
Approve a task.

### POST /approvals/tasks/{task_id}/reject
Reject a task.

### POST /approvals/tasks/{task_id}/comment
Add a comment.

### POST /approvals/tasks/{task_id}/escalate
Escalate a task.

## AI

### POST /ai/jobs
Submit an AI job.

### GET /ai/jobs/{job_id}
Get the current status of a job.

## RBAC

### POST /rbac/roles
Create a role.

### GET /rbac/roles
List roles.

### POST /rbac/seed
Seed default roles for an organization.

### GET /rbac/permissions
List permissions.

## Response Conventions

- Successful create requests should return 201.
- Successful read requests should return 200.
- Validation failures should return 400 or 422 with a descriptive detail message.
- Missing resources should return 404.
- Authentication failures should return 401.
