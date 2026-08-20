# InkKnits Backend

This folder contains the initial FastAPI + SQLAlchemy backend scaffold for InkKnits.

## Structure

- app/: FastAPI application entrypoints
- database/: SQLAlchemy engine, session, and shared base model
- models/: domain models
- repositories/: repository layer abstractions

## Getting started

1. Create and activate a virtual environment.
2. Install dependencies: `pip install -r requirements.txt`
3. Initialize a local development database and seed demo data using a local Postgres instance:

	```bash
	export DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/inkknits"
	export JWT_SECRET_KEY="$(openssl rand -hex 32)"
	python scripts/local_dev_setup.py
	```

	This creates the database schema and deterministic demo organization, six role accounts, three projects, typed production stations, demo assets, versions, and approval tasks. All seeded accounts use the development-only password `InkKnits-Dev-2026!`.

4. Start the API from the repository root: `python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload`

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

## CORS / Frontend

By default the backend allows CORS from `http://127.0.0.1:5173` (Vite dev server). To customize allowed origins set the `FRONTEND_ORIGINS` environment variable to a comma-separated list of origins.

For production, serve the built frontend `dist/` via a static host (or CDN) and set `FRONTEND_ORIGINS` to your production domain(s). Use `DATABASE_URL` to point to a production Postgres instance and run Alembic migrations before starting the app.
