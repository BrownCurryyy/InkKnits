# InkKnits

<p align="center">
  <img src="docs/logo.png" alt="InkKnits logo" width="220" />
</p>

<p align="center">
  <strong>Local-first AI content operations platform</strong>
</p>

InkKnits is a local-first AI content production platform for teams that need to generate, review, approve, publish, and evolve content in a controlled way. The platform combines a FastAPI backend, SQLAlchemy data layer, PostgreSQL persistence, React + Vite frontend, and workstation-local AI execution to manage the full content lifecycle from creation through publication and post-publication optimization.

## Current status

The codebase has passed the core production foundation work and is now moving into the next major milestone: complete post-publication lifecycle management, analytics, and operational reliability. The system already supports:

- organization, project, station, and RBAC structures
- asset creation, upload, metadata, and version history
- immutable snapshot-style version tracking
- activity logging and approval workflows
- centralized AI job execution with queue visibility and priority scheduling
- project production-state assembly from current asset versions
- local AI generation flows using Ollama and ComfyUI patterns

The next development wave is focused on what happens after content is approved and published.

## Next plan: post-publication lifecycle and performance

The current roadmap is explicitly centered on:

1. Complete the post-publication content lifecycle, including published, archived, superseded, and retired asset states.
2. Implement publication tracking to record when, where, and which version of an asset was published.
3. Integrate notifications and workflow status updates for approvals, publication events, and important asset changes.
4. Implement post-publication asset management, including updating, replacing, archiving, and retiring previously published content while preserving its history.
5. Introduce post-publication performance analytics, linking published asset performance to the corresponding asset version and publication record.
6. Explore performance-driven content refinement, using publication insights to guide future revisions and derivative generation.
7. Optimize system performance, reliability, and AI job processing under realistic multi-user workloads.

This is the next phase after the current approval, validation, and version-tracking foundation.

## What’s included today

- Authentication with role-based access control
- Asset management with upload validation and version tracking
- Centralized AI job scheduling and approval workflows
- Station-specific Writing, Editing, Generation, and Image workspaces
- Computed project production state from current assets and latest versions
- Activity logging and structured storage
- API contract and frontend directives in `docs/`
- Local-first AI execution model built for constrained workstation hardware

## Repository layout

- `backend/` — FastAPI application, ORM models, repositories, migrations, and services
- `frontend/` — React + Vite shell for the user experience
- `docs/` — architecture, requirements, audit, and contract documents
- `db/` — schema definitions and database collateral
- `storage/` — local runtime storage for generated and processed assets
- `test/` — smoke and integration-style validation scripts
- `v1snaps/` — versioned snapshots and historical project state artifacts

## Quick start

1. Open `backend/`
2. Create and activate a Python virtual environment
3. Install dependencies:

   ```bash
   pip install -r backend/requirements.txt
   ```

4. Initialize a local development database and seed demo data using Postgres:

   - Option A (recommended for local dev): use the included seed script with a local Postgres instance.

     ```bash
     export DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/inkknits"
     export JWT_SECRET_KEY="$(openssl rand -hex 32)"
     python backend/scripts/local_dev_setup.py
     ```

   This creates the schema and deterministic demo organization, six role accounts, three projects, typed production stations, demo assets, versions, and approval tasks. All seeded accounts use the development-only password `InkKnits-Dev-2026!`.

   - Option B (manual migration): set `DATABASE_URL` and run Alembic from the `backend/` folder

     ```bash
     # from repo root
     cd backend
     export DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/inkknits"
     alembic upgrade head
     ```

5. Start the API:

   ```bash
   python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

> Note: `/auth/register` can only register users for an existing organization. The seed script creates the first org and first admin user.

## Demo login accounts

Use these only for local development after running `backend/scripts/local_dev_setup.py`:

| Role | Email |
|---|---|
| Admin | `admin@example.com` |
| Manager | `manager@example.com` |
| Editor | `editor@example.com` |
| Reviewer | `reviewer@example.com` |
| Publisher | `publisher@example.com` |
| Viewer | `viewer@example.com` |

Password for every account: `InkKnits-Dev-2026!`

## Docs

- `docs/PROJECT_BIBLE.md`
- `docs/REQUIREMENTS.md`
- `docs/TODO.md`
- `docs/API_CONTRACT.md`
- `docs/FRONTEND_DIRECTIVES.md`
- `docs/ARCHITECTURE_AUDIT.md`
- `docs/ARCHITECTURE_DECISIONS.md`
- `docs/DATABASE_SCHEMA.md`

## Frontend (developer shell)

A minimal React + Vite + Tailwind frontend is included for frontend development and integration testing.

- To run locally (dev server):

```bash
cd frontend
npm install
npm run dev
```

The frontend calls the backend root routes directly, defaulting to `http://localhost:8000`. Set `VITE_API_BASE_URL` when the API runs elsewhere:

```bash
# start backend
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
# start frontend
cd frontend && npm run dev
```

- To build for production:

```bash
cd frontend
npm run build
# serve `dist/` with your preferred static hosting (e.g. nginx, Vercel)
```

The frontend uses a left sidebar organized as Home, My Projects, accessible Stations, Workflow, and management-only Organization. AI actions submit jobs through `/ai/jobs`; monitor them in the AI Queue.

## Product direction

The next release direction is not just content creation or approval—it is the full content operations lifecycle:

- create and iterate
- review and publish
- track publication provenance
- update or replace published assets without losing history
- measure and learn from performance
- optimize multi-user AI throughput and system reliability

InkKnits is evolving from a collaboration and generation workspace into a publication-aware content operations system that preserves version history while supporting live production decisions after launch.