## Logs

**Purpose**
This document records major architectural decisions, implementation milestones, and significant changes made throughout the project's development.
It is intended for developers working on the project and should not be used as an activity log or commit history.

# Development Log

---

## v1.0.0 — Project Foundation
Date: 2026-07-19

### Completed
- Defined complete software architecture.
- Finalized Organization → Project → Station → Asset hierarchy.
- Finalized RBAC model.
- Designed PostgreSQL schema.
- Established Version Tracking architecture.
- Chose FastAPI + React stack.
- Decided on local-first deployment.

### Decisions
- Use asyncio.PriorityQueue instead of Redis/Celery.
- Version Tracking stores snapshots instead of diffs.
- Assets stored on SSD; PostgreSQL stores file paths only.
- Base64 responses used for image transfer.
- One GPU job at a time to prevent VRAM OOM.

---

## v1.1.0 — Image Generation Pipeline
Date: 2026-07-20

### Added
- Gemma prompt enrichment.
- ComfyUI integration.
- SD1.5 workflow.
- Upscaling pipeline.

### Changed
- Prompt generation moved before image generation.
- Added image scheduler support.

### Future
- Multi-image batching.
- Better queue estimation.

---

## v1.2.0 — Backend Scaffold
Date: 2026-07-19

### Added
- Created a backend package structure under backend/app, backend/database, backend/models, and backend/repositories.
- Added a FastAPI health endpoint for initial API bootstrapping.
- Added SQLAlchemy base configuration and database session wiring.
- Added initial domain model classes for organizations, projects, stations, assets, and users.
- Added reusable repository scaffolding for CRUD-style access.
- Added request/response schemas for organizations, projects, and assets.
- Added initial JWT-based auth helpers and auth endpoints for registration, login, and a current-user placeholder.
- Wired the first organization, project, asset, and auth routes into the FastAPI app.

### Notes
- The backend now has a verified foundation for authentication, validation, and CRUD-style API routes.
- PostgreSQL connection settings are environment-driven and ready for local configuration.
- Alembic migration scaffolding is in place for the initial schema, and the FastAPI app now imports successfully in the current environment.

## v1.3.0 — Version & Activity Extensions
Date: 2026-07-19

### Added
- Added asset version tracking models and repositories for snapshot-style version records.
- Added activity log models and repositories for append-only domain events.
- Added dedicated FastAPI routers for versions and activities.
- Added corresponding Pydantic request/response schemas for version and activity payloads.

### Notes
- The backend now exposes version and activity endpoints alongside the existing CRUD routes.
- The implementation is scaffolded and verified to compile successfully in the current environment.

## v1.3.1 — Documentation Milestone Update
Date: 2026-07-19

### Added
- Recorded the completed version-tracking and activity-log backend milestone in the project checklist.
- Added a new development log entry to keep the implementation history aligned with the current codebase state.

### Notes
- The documentation now reflects the latest backend progress and remains synchronized with the implementation milestones.
