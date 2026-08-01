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

## v1.4.0 — Database Completion & Auth Extensions
Date: 2026-07-19

### Added
- Completed Phase 2 database models (`Role`, `Permission`, `RolePermission`, `UserRole`, `StationMember`, `AIJob`, `ApprovalTask`, `AssetLink`).
- Generated Alembic migrations for new models.
- Added corresponding repository pattern implementations.
- Extended Auth with `refresh_token` generation and endpoint.
- Added stateless `/logout` endpoint.
- Added preliminary RBAC routers for listing and creating roles/permissions.
- Wired RBAC routers into the main FastAPI application.

### Notes
- The backend now has all the fundamental tables as specified in `DATABASE_SCHEMA.md`.
- RBAC foundations are available to be consumed by the frontend and authorization middlewares.

## v1.5.0 — Organization Management & RBAC Seeding
Date: 2026-07-19

### Added
- Created `StationRepository` for managing stations.
- Implemented `/rbac/seed` endpoint for automatically populating default roles and permissions.
- Added `/organizations/{id}/members` endpoints for inviting/adding members.
- Added `/organizations/{id}/members/{user_id}/role` to manage member roles.
- Added `/projects/{id}` updates and soft-archive via `PATCH /{id}/archive`.
- Added complete `stations.py` router with creation, member assignment, asset filtering (stub), and dashboard (stub) endpoints.
- Expanded `schemas.py` to support all these new management features.

### Notes
- This completes Phase 3 (Authentication & RBAC) and Phase 4 (Organization Management) backend endpoints.
- The next logical step involves Phase 5 (Asset Management).

## v1.6.0 — Asset Management & Storage Engine
Date: 2026-07-19

### Added
- Extended `Asset` model with `title` and `content` columns to fully align with `DATABASE_SCHEMA.md`.
- Updated `AssetCreate`, `AssetOut`, and `AssetUpdate` schemas to expose all asset fields.
- Implemented `POST /assets/upload` — multipart/form-data file upload; saves file to structured SSD path and stores path in DB.
- Implemented `GET /assets/{id}/download` — reads file from SSD, returns Base64-encoded JSON (per STO-003).
- Implemented `PUT /assets/{id}` — partial update of name, title, content, and asset_type.
- Implemented `PATCH /assets/{id}/metadata` — merges new key-value pairs into existing `raw_metadata` JSON.
- Implemented `DELETE /assets/{id}` — soft delete via `deleted_at` timestamp; file preserved on disk.
- Implemented `GET /assets/search?q=` — case-insensitive search across name and title of non-deleted assets.
- Updated `GET /assets` to filter out soft-deleted assets.
- Implemented `StorageService` in `backend/services/storage.py` with structured path generation, file save, base64 read, and cleanup utilities.
- Replaced all stub endpoints in `stations.py`: asset filter now queries DB, dashboard now returns real asset/member/approval counts.

### Notes
- Phase 5 (Asset Management) is fully complete.
- The next phase is Phase 6 (AI Engine) — Ollama/ComfyUI integration to be handled separately as discussed.

## v1.7.0 — AI Engine & Scheduling Integration
Date: 2026-07-29

### Added
- Integrated the `ai_router` into the main FastAPI application (`backend/app/main.py`).
- Set up a FastAPI `lifespan` handler to automatically start and stop the `AIScheduler` background worker task.
- Fixed a bug in `backend/database/connection.py` where sessionmaker was using the non-existent parameter `expire_on_load` instead of `expire_on_commit`.
- Checked off all Phase 6 items in `TODO.md` as fully completed.

### Notes
- Phase 6 (AI Engine) integration is fully complete.
- The next phase is Phase 7 (Version Tracking).

## v1.8.0 — Version Tracking & Activity Service Completion
Date: 2026-08-01

### Added
- Implemented automatic version snapshots for asset create, update, metadata, and restore flows.
- Added lineage support to version records via `parent_version_id` and restored snapshot metadata handling.
- Expanded the activity service to log asset creation, opening, updates, archive/restore, approval, AI queueing, login, and logout events.
- Wired approval routes into the main FastAPI application and ensured the router is imported consistently.
- Added tenant-aware fields to AI jobs so organization and station context are preserved for downstream processing.
- Replaced the placeholder auth `/me` response with a JWT-backed current-user dependency and added activity logging for auth lifecycle events.

### Notes
- Phases 7 and 8 are now implemented and documented as completed in the project checklist.
- The backend now keeps version history and audit trails aligned with the documented architecture and requirements.

## v1.9.0 — Approval Engine & Scheduler Completion
Date: 2026-08-01

### Added
- Implemented a reusable approval service for overdue-task escalation and deadline tracking.
- Wired approval escalation into the API so overdue tasks are marked as escalated automatically.
- Added scheduler cancellation support so queued jobs can be cancelled cleanly.
- Hardened scheduler persistence so job updates degrade gracefully when the database is unavailable.
- Added regression tests covering approval escalation and scheduler cancellation behavior.

### Notes
- Phases 9 and 10 are now implemented and reflected as completed in the project checklist.
- The backend now covers the approval workflow and AI job scheduler end to end, with no blocking errors in the current verification run.

## v1.10.0 — Hardening Pass & Frontend Readiness
Date: 2026-08-01

### Added
- Added a reusable role-check helper for access-control decisions and administrator override handling.
- Added upload validation for file type, executable payloads, and size before writing assets to storage.
- Wired upload validation into the asset upload route so invalid files are rejected with a clear API error.
- Documented frontend integration touchpoints for auth, role-aware UI, upload handling, activity/version views, and AI queue monitoring.

### Notes
- The backend is now better prepared for frontend integration with stronger safety checks and clearer API behavior.
- The added regression tests cover the new hardening helper and storage validation logic.
