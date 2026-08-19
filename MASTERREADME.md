# InkKnits — Master Local Setup and Test Guide

This guide covers the full local setup for the InkKnits app: Python backend, Postgres database, frontend development server, and browser-based smoke tests.

## 1) Prerequisites

Install the following:

- Python 3.11+ (project targets modern Python)
- Node.js 18+
- PostgreSQL 15/16/18 locally
- Git

Recommended local setup on Windows PowerShell:

```powershell
python --version
node --version
psql --version
```

---

## 2) Clone and enter the repo

```powershell
cd C:\Users\BrownCurryyy.LAPTOP-LK24DON8\Documents
git clone <repo-url>
cd InkKnits
```

---

## 3) Create a virtual environment

### Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### Bash / macOS / Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Check that the environment is active:

```powershell
python -c "import sys; print(sys.executable)"
```

---

## 4) Install backend dependencies

From the repo root:

```powershell
pip install -r backend\requirements.txt
```

Important: backend routes are mounted without an `/api` prefix. The live API base is:

```text
http://localhost:8000
```

---

## 5) Start local PostgreSQL and ensure the password matches the app

The app defaults to this connection string:

```text
postgresql+psycopg://postgres:postgres@localhost:5432/inkknits
```

If Postgres is installed locally, make sure the `postgres` user password is set to `postgres`.

### PowerShell reset (if needed)

```powershell
# Open psql as the local postgres superuser if you have access to the server admin shell.
# Then run:
ALTER USER postgres WITH PASSWORD 'postgres';
```

If you are using the PostgreSQL Windows service, confirm the local service is running before proceeding.

---

## 6) Initialize the database and seed demo data

From the repo root:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/inkknits"
$env:JWT_SECRET_KEY = "67ygHSIK347R91MkSd0F51G6skKfI63CrPoLB7oE8Mz"
python backend\scripts\local_dev_setup.py
```

This creates the schema and seeds:

- Organization: Demo Org
- Admin user: `admin@example.com`
- Password: `password123`

---

## 7) Start the backend

From the repo root:

```powershell
$env:DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/inkknits"
$env:JWT_SECRET_KEY = "replace-with-a-random-secret"
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

Expected backend URL:

```text
http://127.0.0.1:8000
```

Quick health check:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/docs" -Method Get | Out-Null
```

Or simply browse to:

```text
http://localhost:8000/docs
```

---

## 8) Install frontend dependencies

From the repo root:

```powershell
cd frontend
npm install
```

---

## 9) Start the frontend

```powershell
cd frontend
npm run dev -- --host 0.0.0.0
```

Frontend dev server defaults to:

```text
http://localhost:5173
```

---

## 10) Browser smoke test flow

Open the frontend at:

```text
http://localhost:5173
```

Then test the read-only browsing flow:

1. Log in with:
   - Email: `admin@example.com`
   - Password: `password123`
2. Confirm the app loads the workspace shell.
3. Confirm you see the organization/project/station selectors.
4. Confirm the station board lists stations for the selected project.
5. Click a station card.
6. Confirm the asset library renders assets in a grid or list.
7. Click an asset.
8. Confirm the asset detail panel opens.
9. Check the version timeline and history rendered from `/versions/{asset_id}`.
10. Log out and confirm the app returns to the login page.

---

## 11) Useful API endpoints

The app uses these endpoints directly:

- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /organizations`
- `GET /projects`
- `GET /stations`
- `GET /stations/{station_id}/dashboard`
- `GET /assets`
- `GET /assets/{asset_id}`
- `GET /versions/{asset_id}`
- `GET /activities`

---

## 12) Common Troubleshooting

### Backend 401s / login fails

Check:

```powershell
$env:DATABASE_URL
```

and confirm the database is reachable:

```powershell
$env:PGPASSWORD = "postgres"
psql -h localhost -U postgres -d postgres -c "SELECT 1;"
```

If Postgres rejects the password, reset it to `postgres` and retry the backend.

### Frontend cannot connect

Make sure the backend is already running on port 8000 before you start Vite.

### Tokens not persisting after refresh

Check browser localStorage for the `inkknits_tokens` key and make sure the backend refresh call succeeds.

---

## 13) Quick full startup sequence

```powershell
cd C:\Users\BrownCurryyy.LAPTOP-LK24DON8\Documents\InkKnits
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
$env:DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/inkknits"
$env:JWT_SECRET_KEY = "replace-with-a-random-secret"
python backend\scripts\local_dev_setup.py
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

In a second terminal:

```powershell
cd C:\Users\BrownCurryyy.LAPTOP-LK24DON8\Documents\InkKnits\frontend
npm install
npm run dev -- --host 0.0.0.0
```

---

## 14) Notes

- The backend has no `/api` prefix in the app routes.
- The frontend is configured to call the backend at `http://localhost:8000` unless overridden by an environment variable.
- The current browsing implementation is intentionally read-only and does not include create, edit, or restore flows.
