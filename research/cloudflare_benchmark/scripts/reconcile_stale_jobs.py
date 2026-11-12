from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT))

from sqlalchemy import and_

from backend.database.connection import SessionLocal
from backend.models.ai_job import AIJob
from backend.models.station import Station

OUTPUT_DIR = ROOT / "research" / "cloudflare_benchmark" / "logs"


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def digest(value: str | None) -> str | None:
    return hashlib.sha256(value.encode("utf-8")).hexdigest() if value else None


def api_json(url: str, token: str | None = None, body: dict[str, Any] | None = None) -> dict[str, Any]:
    headers = {"Accept": "application/json"}
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers=headers, method="POST" if body is not None else "GET")
    with urllib.request.urlopen(request, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def health_check(base_url: str, email: str, password: str) -> dict[str, Any]:
    login = api_json(f"{base_url}/auth/login", body={"email": email, "password": password})
    return api_json(f"{base_url}/ai/health", token=login["access_token"])


def record(job: AIJob, station_project_id: uuid.UUID) -> dict[str, Any]:
    return {
        "task_id": str(job.id),
        "project_id": str(station_project_id),
        "job_type": job.job_type,
        "original_status": job.status,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "queue_position": job.queue_position,
        "result_asset": job.result_asset,
        "result_data_sha256": digest(job.result_data),
        "parameters_sha256": digest(job.parameters),
        "previous_error": job.error,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Snapshot and optionally terminalize orphaned benchmark-project AI jobs.")
    parser.add_argument("--apply", action="store_true", help="Mark eligible orphaned rows FAILED after writing a recovery snapshot.")
    parser.add_argument("--stale-minutes", type=int, default=15)
    args = parser.parse_args()
    project_id = os.getenv("INKKNITS_BENCHMARK_PROJECT_ID")
    email = os.getenv("INKKNITS_BENCHMARK_EMAIL")
    password = os.getenv("INKKNITS_BENCHMARK_PASSWORD")
    base_url = os.getenv("INKKNITS_LOCAL_API", "http://127.0.0.1:8000").rstrip("/")
    if not project_id or not email or not password:
        parser.error("Set benchmark project ID, email, and password in the environment")
    try:
        parsed_project_id = uuid.UUID(project_id)
    except ValueError:
        parser.error("Benchmark project ID must be a UUID")

    health = health_check(base_url, email, password)
    if not health.get("scheduler_running") or health.get("queued_jobs") != 0 or health.get("active_jobs") != 0:
        raise SystemExit(f"Refusing recovery while scheduler is not idle: {health}")

    now = utc_now()
    cutoff = now - timedelta(minutes=max(1, args.stale_minutes))
    session = SessionLocal()
    try:
        jobs = (
            session.query(AIJob)
            .join(Station, AIJob.station_id == Station.id)
            .filter(
                and_(
                    Station.project_id == parsed_project_id,
                    AIJob.status.in_(["QUEUED", "RUNNING"]),
                    AIJob.created_at < cutoff,
                )
            )
            .order_by(AIJob.created_at.asc())
            .all()
        )
        snapshots = [record(job, parsed_project_id) for job in jobs]
        if not snapshots:
            print(json.dumps({"eligible_jobs": 0, "applied": False, "scheduler": health}, indent=2))
            return 0
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        suffix = now.strftime("%Y%m%dT%H%M%SZ")
        snapshot_path = OUTPUT_DIR / f"scheduler_recovery_{suffix}.json"
        if snapshot_path.exists():
            raise SystemExit(f"Recovery snapshot already exists: {snapshot_path}")
        snapshot = {
            "captured_at_utc": now.isoformat(),
            "project_id": project_id,
            "stale_cutoff_utc": cutoff.isoformat(),
            "scheduler_health": health,
            "applied": False,
            "eligible_job_count": len(snapshots),
            "jobs": snapshots,
        }
        snapshot_path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
        if args.apply:
            for job in jobs:
                if job.status in {"QUEUED", "RUNNING"} and job.created_at < cutoff:
                    job.status = "FAILED"
                    job.error = "Recovered as orphaned after scheduler process restart; no automatic retry was performed and execution outcome is unverified."
                    job.completed_at = now
                    job.queue_position = None
            session.commit()
            snapshot["applied"] = True
            snapshot["terminal_status"] = "FAILED"
            snapshot["updated_at_utc"] = utc_now().isoformat()
            snapshot_path.write_text(json.dumps(snapshot, indent=2), encoding="utf-8")
        else:
            session.rollback()
        print(json.dumps({"eligible_jobs": len(snapshots), "applied": args.apply, "snapshot": str(snapshot_path.relative_to(ROOT)), "task_ids": [item["task_id"] for item in snapshots]}, indent=2))
        return 0
    finally:
        session.close()


if __name__ == "__main__":
    raise SystemExit(main())
