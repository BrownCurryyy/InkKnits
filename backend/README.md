# InkKnits Backend

<p align="center">
  <img src="../docs/logo.png" alt="InkKnits logo" width="180" />
</p>

This backend is the operational engine for InkKnits: it owns authentication, organization/project/station structure, asset and version management, approval workflows, AI job processing, activity recording, and the future publication lifecycle. The current focus is extending the platform beyond pre-publication workflows into post-publication asset state management, performance tracking, and workload optimization.

## Current backend direction

The backend has already moved well past a simple scaffold. It now supports:

- JWT-based auth and role-aware access control
- organization/project/station hierarchy with member visibility checks
- asset lifecycle operations, soft-delete handling, metadata, and version snapshots
- activity logging for critical workflow events
- AI job submission and queue monitoring for text and image generation paths
- approval and review flows with assignment and escalation logic
- project production-state resolution from current visible asset versions

The next major backend milestone is to add publication-aware domain logic:

- published, archived, superseded, and retired asset states
- publication records tied to asset version and channel/location metadata
- workflow notifications for approvals, publishing, and publication updates
- post-publication update and replacement flows that preserve historical lineage
- analytics linking asset performance to version and publication records
- system reliability and AI queue scaling for realistic multi-user workloads

## Backend structure

- `app/` — FastAPI app, routers, dependencies, and service wiring
- `database/` — engine/session setup and shared schema configuration
- `models/` — SQLAlchemy domain models and relational structure
- `repositories/` — repository-layer abstractions
- `services/` — workflow and domain services for AI, publishing, approvals, and operations
- `scripts/` — setup, seeding, and local environment automation
- `tests/` — backend validation for auth, authorization, jobs, versions, and workflow behavior
- `alembic/` — migrations and schema evolution

## Getting started

1. Create and activate a virtual environment.
2. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Initialize a local development database and seed demo data using a local Postgres instance:

   ```bash
   export DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/inkknits"
   export JWT_SECRET_KEY="$(openssl rand -hex 32)"
   python scripts/local_dev_setup.py
   ```

   This creates the database schema and deterministic demo organization, six role accounts, three projects, typed production stations, demo assets, versions, and approval tasks. All seeded accounts use the development-only password `InkKnits-Dev-2026!`.

4. Start the API from the repository root:

   ```bash
   python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

> Note: `/auth/register` requires an existing organization. Use the seed script to create the first organization and admin user before calling `/auth/register`.

## Local demo login

Seeded development accounts:

- `admin@example.com` — ADMIN
- `manager@example.com` — MANAGER
- `editor@example.com` — EDITOR
- `reviewer@example.com` — REVIEWER
- `publisher@example.com` — PUBLISHER
- `viewer@example.com` — VIEWER

All use the development-only password: `InkKnits-Dev-2026!`. Never use these credentials outside local development.

The API exposes the current project production state at `GET /projects/{project_id}/production-state`. This is a computed view of visible assets and their latest active versions, not a persistent bundle snapshot or asset version-history timeline.

## Backend roadmap: publication-first platform

The next implementation block is explicitly:

1. Post-publication lifecycle states for assets: `PUBLISHED`, `ARCHIVED`, `SUPERSEDED`, and `RETIRED`
2. Publication tracking records that answer when a piece was published, to which channel, and with which asset version
3. Notification and workflow updates for approvals, publication events, and important content changes
4. Post-publication management for replacing, updating, archiving, and retiring publications while preserving historical lineage
5. Analytics tied to publication records and version history to understand performance and utilization
6. Performance-driven refinement loops that use real metrics to influence future revisions and derivative generation
7. Scaling, reliability, and queue optimization under concurrent user workloads

This means the backend is being shaped not just as a content workspace, but as an operational publishing and content performance system.

## CORS / Frontend

By default the backend allows CORS from `http://127.0.0.1:5173` (Vite dev server). To customize allowed origins set the `FRONTEND_ORIGINS` environment variable to a comma-separated list of origins.

For production, serve the built frontend `dist/` via a static host (or CDN) and set `FRONTEND_ORIGINS` to your production domain(s). Use `DATABASE_URL` to point to a production Postgres instance and run Alembic migrations before starting the app.

## Operational principles

- append-only history is sacred
- organization boundaries are enforced on every scoped route
- AI jobs are treated as durable operational work, not transient UI events
- publication events create traceable records, never silent state changes
- performance data must remain linked to the version that produced it
- downstream changes should never erase the lineage of previously published content
