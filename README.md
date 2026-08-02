# InkKnits

![InkKnits Logo](docs/logo.png)

InkKnits is a FastAPI + SQLAlchemy backend for managing organization, project, station, asset, version, approval, and AI workflows.

## What’s included
- Authentication with role-based access control
- Asset management with upload validation and version tracking
- AI job scheduling and approval workflows
- Activity logging and structured storage
- API contract and frontend directives in `docs/`

## Quick start
1. Open `backend/`
2. Create and activate a Python virtual environment
3. Install dependencies:
   ```bash
   pip install -r backend/requirements.txt
   ```
4. Initialize a local development database and seed demo data (zero Postgres required):

   - Option A (recommended for quick local dev): use the included SQLite fallback and seed script

     ```bash
     python backend/scripts/local_dev_setup.py
     ```

     This will create `backend/dev.db`, create all tables from the ORM models, and seed a demo organization, admin user (admin@example.com / password123), a project, and a station.

   - Option B (use PostgreSQL): set `DATABASE_URL` and run Alembic from the `backend/` folder

     ```bash
     # from repo root
     cd backend
     export DATABASE_URL="postgresql+psycopg://postgres:postgres@localhost:5432/inkknits"
     alembic upgrade head
     ```

5. Start the API:
   ```bash
   uvicorn backend.app.main:app --reload
   ```

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

The Vite dev server proxies `/api/*` to `http://127.0.0.1:8001` so you can run the backend concurrently:

```bash
# start backend
uvicorn backend.app.main:app --reload
# start frontend
cd frontend && npm run dev
```

- To build for production:

```bash
cd frontend
npm run build
# serve `dist/` with your preferred static hosting (e.g. nginx, Vercel)
```

The frontend is intentionally small — it provides a ping button and a skeleton `App` to exercise backend endpoints. Expand it as needed.