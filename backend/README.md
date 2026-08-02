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

	This creates the database schema and seeds a demo organization, admin user (admin@example.com / password123), a project, and a station.

4. Start the API: `uvicorn app.main:app --reload`

> Note: `/auth/register` requires an existing organization. Use the seed script to create the first organization and admin user before calling `/auth/register`.

## CORS / Frontend

By default the backend allows CORS from `http://127.0.0.1:5173` (Vite dev server). To customize allowed origins set the `FRONTEND_ORIGINS` environment variable to a comma-separated list of origins.

For production, serve the built frontend `dist/` via a static host (or CDN) and set `FRONTEND_ORIGINS` to your production domain(s). Use `DATABASE_URL` to point to a production Postgres instance and run Alembic migrations before starting the app.
