"""Drop and reseed the local InkKnits development database.

This command is intentionally restricted to localhost database URLs.
Run from the repository root:
    python backend/scripts/reset_db.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from sqlalchemy.engine import make_url
import subprocess

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

from backend.database.connection import DEFAULT_DATABASE_URL


def main() -> None:
    database_url = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    parsed_url = make_url(database_url)
    if parsed_url.host not in {"localhost", "127.0.0.1", "::1"}:
        raise SystemExit("Refusing to reset a non-local database. DATABASE_URL must point to localhost.")

    print(f"Resetting local database at {parsed_url.render_as_string(hide_password=True)}")
    subprocess.run([sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "downgrade", "base"], cwd=REPO_ROOT, check=True)
    subprocess.run([sys.executable, "-m", "alembic", "-c", "backend/alembic.ini", "upgrade", "head"], cwd=REPO_ROOT, check=True)
    subprocess.run([sys.executable, "backend/scripts/local_dev_setup.py"], cwd=REPO_ROOT, check=True)
    print("Database reset, migrations applied, and seed data restored.")


if __name__ == "__main__":
    main()
