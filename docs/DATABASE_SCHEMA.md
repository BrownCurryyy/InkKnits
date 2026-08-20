# Database Schema

Version: 1.0

Database Engine:
PostgreSQL 17

ORM:
SQLAlchemy 2.x

Migration Tool:
Alembic

Primary Key:
UUID

Deletion Strategy:
Soft Delete (`deleted_at`)

---

# Overall Hierarchy

Organization
├── Members
├── Roles
├── Projects
│     ├── Stations
│     │      ├── Assets
│     │      ├── Versions
│     │      ├── Activities
│     │      └── Approval Tasks
│     └── AI Jobs
└── Global Settings

---

# Entity Overview

| Table | Purpose |
|--------|---------|
| organizations | Top-level tenant |
| users | User accounts |
| roles | System roles |
| permissions | Fine-grained permissions |
| role_permissions | Many-to-many mapping |
| user_roles | User role assignments |
| projects | Production projects |
| stations | Functional production areas |
| station_members | Members inside stations |
| assets | Every text/image/media object |
| asset_versions | Version Tracking snapshots |
| asset_links | Parent-child lineage |
| ai_jobs | AI generation queue |
| approval_tasks | Review workflow |
| activities | Immutable audit logs |
| version_bundles | Named project version snapshots |
| version_bundle_items | Asset/version selections inside a bundle |

---

# organizations

Purpose

Represents a company or institution.

Columns

id (UUID)

name

description

logo_path

created_by

created_at

updated_at

deleted_at

Relationships

1 Organization

↓

Many Projects

Many Users

Many Roles

---

# users

Purpose

Stores user identities.

Columns

id

organization_id

name

email

password_hash

avatar

status

created_at

updated_at

deleted_at

Relationships

Belongs to Organization

Can belong to many Stations

Can own many Assets

Can create Activities

Can create AI Jobs

---

# roles

Purpose

Defines user roles.

Examples

Administrator

Manager

Editor

Reviewer

Publisher

Viewer

Columns

id

organization_id

name

description

created_at

updated_at

---

# permissions

Purpose

Every action inside the system.

Examples

asset.create

asset.read

asset.edit

asset.delete

image.generate

approval.review

logs.view

organization.manage

Columns

id

permission_name

description

---

# role_permissions

Purpose

Maps Roles to Permissions.

Many-to-Many

Role

↓

Permission

---

# user_roles

Purpose

Assigns roles to users.

Supports future multiple-role users.

---

# projects

Purpose

Represents a production project.

Example

World Cup Coverage

Product Launch

Columns

id

organization_id

title

description

status

deadline

created_by

created_at

updated_at

deleted_at

Relationships

Organization

↓

Projects

↓

Stations

---

# stations

Purpose

Represents a functional production destination inside a project.

`station_type` is required and must be one of:

- `WRITING`
- `GENERATION`
- `VIEWING`
- `IMAGE`
- `APPROVAL`

The `20260820_station_type` migration backfills existing stations once using name matching: Writing -> `WRITING`, Generation -> `GENERATION`, Image/Visual -> `IMAGE`, and all other stations -> `VIEWING`.

Purpose

Functional production areas.

Examples

Writing

Image

Approval

Publishing

Research

Columns

id

project_id

name

description

color

icon

created_at

updated_at

deleted_at

Relationships

Project

↓

Many Stations

↓

Many Assets

Many Members

---

# station_members

Purpose

Assigns users to Stations.

Columns

id

station_id

user_id

joined_at

---

# assets

Purpose

Core object of the platform.

Everything is an Asset.

Types

TEXT

IMAGE

BLOG

PRESS_RELEASE

EMAIL

PROMOTION

LINKEDIN

INSTAGRAM

TWEET

Columns

id

station_id

created_by

asset_type

title

content

storage_path

metadata_json

created_at

updated_at

deleted_at

Relationships

Station

↓

Assets

↓

Versions

Activities

AI Jobs

---

# asset_versions

Purpose

Version Tracking.

Stores complete immutable snapshots.

Columns

id

asset_id

parent_version_id

version_number

snapshot

created_by

created_at

Rules

Append-only

Immutable

Never overwrite

Stores snapshots

---

# asset_links

Purpose

Parent-child lineage.

Example

Master Script

↓

Blog

↓

LinkedIn

↓

Instagram

Columns

id

parent_asset_id

child_asset_id

relationship_type

created_at

---

# ai_jobs

Purpose

Tracks every AI request.

Columns

id

asset_id

created_by

job_type

priority

status

queue_position

model

prompt

parameters

result_asset

started_at

completed_at

created_at

Job Types

TEXT

IMAGE

UPSCALE

ATOMIZATION

SUMMARIZE

EXPAND

TONE

AUDIENCE

Statuses

QUEUED

RUNNING

COMPLETED

FAILED

CANCELLED

---

# approval_tasks

Purpose

Approval workflow.

Columns

id

asset_id

assigned_to

assigned_by

status

deadline

escalated_to

comments

created_at

completed_at

Statuses

Pending

Approved

Rejected

Escalated

---

# activities

Purpose

Immutable audit log.

Columns

id

organization_id

project_id

station_id

user_id

asset_id

action

description

created_at

Properties

Append-only

Immutable

Never stores content

Examples

Login

Logout

Asset Created

Asset Opened

AI Generated

Published

Assigned

Escalated

Deleted

Restored

---

# Relationships

Organization

├── Users

├── Roles

└── Projects

Projects

├── Stations

├── AI Jobs

└── Activities

Stations

├── Members

├── Assets

└── Approval Tasks

Assets

├── Versions

├── Activities

└── Parent/Child Links

---

# Indexes

Primary

UUID

Secondary

organization_id

project_id

station_id

asset_id

created_by

status

created_at

priority

queue_position

email

---

# Constraints

- UUID for every primary key.
- Every asset belongs to exactly one station.
- Every station belongs to exactly one project.
- Every project belongs to exactly one organization.
- Version Tracking is append-only.
- Activities are append-only.
- Assets use soft deletion.
- AI Jobs are immutable after creation.
- Parent-child links must always reference valid assets.

---

# Future Expansion

Future tables
notifications
comments
attachments
video_jobs
ocr_jobs
speech_jobs
webhooks
api_keys
shared_links
model_registry
team_invites
analytics
