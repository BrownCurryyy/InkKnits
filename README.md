# InkKnits

![InkKnits Logo](docs/logo.png)

InkKnits is a FastAPI + SQLAlchemy backend with a React + Vite frontend for organization, project, station, asset, version, approval, and AI workflows.

## What’s included
- Authentication with role-based access control
- Asset management with upload validation and version tracking
- Centralized AI job scheduling and approval workflows
- Station-specific Writing, Editing, Generation, and Image workspaces
- Computed project production state from current assets and latest versions
- Activity logging and structured storage
- API contract and frontend directives in `docs/`

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
- `docs/API_CONTRACT.md`
- `docs/FRONTEND_DIRECTIVES.md`
- `docs/phase10audit2.md`
- `docs/PROJECT_BIBLE.md`

## Notes
Keep environment secrets out of source control and use the backend `backend/requirements.txt` for Python dependencies.

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