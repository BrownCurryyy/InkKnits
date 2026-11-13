from __future__ import annotations

import argparse
import base64
import csv
import hashlib
import json
import os
import platform
import re
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path
from statistics import median
from typing import Any, Callable

import psutil

ROOT = Path(__file__).resolve().parents[3]
TEXT_DATASET = ROOT / "datasets" / "benchmark_sample.csv"
IMAGE_DATASET = ROOT / "datasets" / "results" / "image_generation_prompts.csv"
OUTPUT_ROOT = ROOT / "research" / "cloudflare_benchmark"
LOCAL_BASE = "http://127.0.0.1:8000"
CLOUDFLARE_BASE = "https://inkknits.trustium.tech"
EMAIL = os.getenv("INKKNITS_BENCHMARK_EMAIL")
PASSWORD = os.getenv("INKKNITS_BENCHMARK_PASSWORD")
PROJECT_ID = os.getenv("INKKNITS_BENCHMARK_PROJECT_ID")

FIELDS = [
    "benchmark_id", "run_id", "access_path", "workload", "article_id", "operation",
    "request_id", "task_id", "http_status", "job_status", "success", "utc_start",
    "utc_end", "monotonic_elapsed_s", "persistence_observed_s", "persistence_verified",
    "expected_asset_count", "persisted_asset_count", "payload_size_bytes", "response_size_bytes",
    "created_at", "started_at", "completed_at", "queue_wait_s", "inference_duration_s",
    "backend_total_s", "asset_ids", "persisted_asset_ids", "status", "error",
    "failure_category", "request_accepted", "failure_http_status", "auth_401_retries",
    "model_job_type", "seed", "image_path", "project_id", "prompt",
]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def atomic_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(payload, indent=2, sort_keys=True), encoding="utf-8")
    temp.replace(path)


def checkpoint_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    with temp.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows({key: row.get(key) for key in FIELDS} for row in rows)
    temp.replace(path)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def component_prompt(operation: str, article: str, output_format: str | None = None) -> str:
    if operation == "summarization":
        return "Summarize this article concisely. Preserve its main event, important entities, and central information. Do not invent facts. Output only the summary."
    elif operation == "shortening":
        return "Shorten this article to approximately 50 percent of its original word count while preserving important meaning and factual details. Do not invent facts. Output only the shortened article."
    return f"Create one independently understandable {output_format} from this article. Preserve important source information, do not invent facts, and output only that asset."


def dataset_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_sha256(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def benchmark_configuration() -> dict[str, Any]:
    workflow_path = Path(os.getenv("COMFYUI_WORKFLOW_PATH", ROOT / "backend" / "final4.json")).resolve()
    return {
        "text_model": os.getenv("OLLAMA_MODEL", "gemma2:2b"),
        "text_model_options": {"temperature": 0.2, "num_ctx": 8192},
        "image_prompt_enrichment_model": os.getenv("OLLAMA_MODEL", "gemma2:2b"),
        "image_checkpoint": "epicrealism_naturalSinRC1VAE.safetensors",
        "image_width": 512,
        "image_height": 512,
        "image_workflow_sha256": dataset_sha256(workflow_path),
        "operations": [
            "summarization", "shortening", "atomization_2", "atomization_5",
            "image_generation",
        ],
    }


def request_plan_sha256(text_rows: list[dict[str, str]], image_rows: list[dict[str, str]]) -> str:
    plan: list[dict[str, Any]] = []
    operations = [
        ("summarization", "SUMMARIZE", component_prompt("summarization", ""), 1),
        ("shortening", "REWRITE", component_prompt("shortening", ""), 1),
        ("atomization_2", "ATOMIZE", "\n\n".join(
            component_prompt("atomization", "", fmt)
            for fmt in ["LinkedIn post", "Short newsletter section"]
        ), 2),
        ("atomization_5", "ATOMIZE", "\n\n".join(
            component_prompt("atomization", "", fmt)
            for fmt in [
                "LinkedIn post", "Short newsletter section",
                "X/Twitter-style post", "Blog introduction",
                "Short promotional description",
            ]
        ), 5),
    ]
    for article in text_rows:
        for operation, job_type, _, expected_count in operations:
            prompt = component_prompt(operation, article["cleaned_text"]) if operation in {"summarization", "shortening"} else ""
            if operation.startswith("atomization"):
                formats = (
                    ["LinkedIn post", "Short newsletter section"]
                    if operation == "atomization_2"
                    else [
                        "LinkedIn post", "Short newsletter section",
                        "X/Twitter-style post", "Blog introduction",
                        "Short promotional description",
                    ]
                )
                prompt = "\n\n".join(
                    component_prompt("atomization", article["cleaned_text"], fmt)
                    for fmt in formats
                )
            plan.append({
                "workload": "text",
                "article_id": article["article_id"],
                "operation": operation,
                "prompt": prompt,
                "model_job_type": job_type,
                "seed": None,
                "expected_asset_count": expected_count,
            })
    for row in image_rows:
        plan.append({
            "workload": "image",
            "article_id": row["article_id"],
            "operation": "image_generation",
            "prompt": row["prompt"],
            "model_job_type": "IMAGE",
            "seed": int(row["seed"]),
            "expected_asset_count": 1,
        })
    return canonical_sha256(plan)


class ApiError(RuntimeError):
    def __init__(self, message: str, http_status: int | None = None) -> None:
        super().__init__(message)
        self.http_status = http_status


def request(base: str, path: str, token: str | None = None, method: str = "GET", body: dict[str, Any] | None = None, timeout: int = 60) -> tuple[int, dict[str, Any], int]:
    headers = {"Accept": "application/json"}
    data = None
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(base + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            content = response.read()
            status = response.status
    except urllib.error.HTTPError as error:
        content = error.read()
        status = error.code
    parsed: dict[str, Any]
    try:
        parsed = json.loads(content.decode("utf-8")) if content else {}
    except (UnicodeDecodeError, json.JSONDecodeError):
        parsed = {"raw_response_bytes": len(content)}
    return status, parsed, len(content)


def jwt_expiration(token: str) -> float | None:
    try:
        payload = token.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        claims = json.loads(base64.urlsafe_b64decode(payload.encode("ascii")))
        expiration = claims.get("exp")
        return float(expiration) if expiration is not None else None
    except (IndexError, ValueError, TypeError, json.JSONDecodeError):
        return None


class AuthSession:
    def __init__(
        self,
        base: str,
        login_fn: Callable[[str], str] | None = None,
        clock: Callable[[], float] = time.monotonic,
        wall_clock: Callable[[], float] = time.time,
        refresh_margin_seconds: int = 300,
    ) -> None:
        self.base = base
        self.login_fn = login_fn or login
        self.clock = clock
        self.wall_clock = wall_clock
        self.refresh_margin_seconds = refresh_margin_seconds
        self._token: str | None = None
        self._expires_at: float | None = None
        self.login_count = 0
        self.unauthorized_retries = 0

    def _login(self) -> str:
        token = self.login_fn(self.base)
        remaining = jwt_expiration(token)
        lifetime = remaining - self.wall_clock() if remaining is not None else 55 * 60
        if lifetime <= 0:
            raise ApiError("Authentication returned an expired access token.")
        self._token = token
        self._expires_at = self.clock() + lifetime
        self.login_count += 1
        return token

    def get_token(self) -> str:
        if (
            self._token is None
            or self._expires_at is None
            or self.clock() >= self._expires_at - self.refresh_margin_seconds
        ):
            return self._login()
        return self._token

    def reauthenticate(self) -> str:
        return self._login()


def authenticated_request(
    session: AuthSession,
    path: str,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    timeout: int = 60,
) -> tuple[int, dict[str, Any], int]:
    for attempt in range(2):
        status, payload, response_size = request(
            session.base, path, session.get_token(), method, body, timeout
        )
        if status != 401 or attempt == 1:
            return status, payload, response_size
        # A received 401 is an explicit rejection; transport failures are never retried.
        session.unauthorized_retries += 1
        session.reauthenticate()
    raise AssertionError("bounded authentication retry loop exited unexpectedly")


def require_auth_ok(
    session: AuthSession,
    path: str,
    method: str = "GET",
    body: dict[str, Any] | None = None,
    timeout: int = 60,
) -> tuple[dict[str, Any], int]:
    status, payload, response_size = authenticated_request(session, path, method, body, timeout)
    if status >= 400:
        raise ApiError(f"{method} {session.base}{path} returned HTTP {status}")
    return payload, response_size


def login(base: str) -> str:
    if not EMAIL or not PASSWORD or not PROJECT_ID:
        raise ApiError("Set benchmark email, password, and project ID in the environment.")
    status, response, _ = request(
        base, "/auth/login", method="POST",
        body={"email": EMAIL, "password": PASSWORD}, timeout=30,
    )
    if status >= 400:
        raise ApiError(f"POST {base}/auth/login returned HTTP {status}")
    token = response.get("access_token")
    if not isinstance(token, str) or not token:
        raise ApiError("Authentication response did not contain an access token.")
    return token


def sanitize_error(error: Any) -> str:
    message = str(error)
    if PASSWORD:
        message = message.replace(PASSWORD, "[REDACTED]")
    message = re.sub(r"(?i)\bBearer\s+\S+", "Bearer [REDACTED]", message)
    message = re.sub(r"(?i)(access_token|refresh_token|password|authorization)([\"']?\s*[:=]\s*[\"']?)[^,\s\"'}]+", r"\1\2[REDACTED]", message)
    message = re.sub(r"\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b", "[REDACTED_TOKEN]", message)
    return message[:1000]


def parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def poll_job(session: AuthSession, task_id: str, timeout_seconds: int) -> tuple[dict[str, Any], int]:
    deadline = time.monotonic() + timeout_seconds
    total_response_bytes = 0
    latest: dict[str, Any] = {}
    while time.monotonic() < deadline:
        status, latest, response_size = authenticated_request(
            session, f"/ai/jobs/{task_id}", timeout=60
        )
        total_response_bytes += response_size
        if status >= 400:
            raise ApiError(f"Polling task returned HTTP {status}", status)
        if latest.get("status") not in {"QUEUED", "RUNNING"}:
            return latest, total_response_bytes
        time.sleep(2)
    raise TimeoutError(f"Task {task_id} did not reach a terminal state within {timeout_seconds}s")


def verify_assets(session: AuthSession, project: dict[str, Any], station: dict[str, Any], final: dict[str, Any], expected_count: int, timeout_seconds: int = 45) -> tuple[list[dict[str, Any]], float, str | None, int]:
    started = time.perf_counter()
    deadline = started + timeout_seconds
    response_bytes = 0
    last_error = None
    current = final
    while time.perf_counter() < deadline:
        result = current.get("result") or {}
        ids = result.get("asset_ids") if isinstance(result, dict) else None
        if current.get("status") != "COMPLETED":
            return [], time.perf_counter() - started, current.get("error") or f"job status was {current.get('status')}", response_bytes
        if isinstance(ids, list) and len(ids) >= expected_count:
            assets = []
            try:
                for asset_id in ids[:expected_count]:
                    asset, size = require_auth_ok(session, f"/assets/{asset_id}", timeout=60)
                    response_bytes += size
                    if asset.get("organization_id") != project.get("organization_id") or asset.get("station_id") != station.get("id"):
                        raise ApiError(f"Generated asset {asset_id} is outside the expected benchmark project station")
                    if asset.get("asset_type") == "IMAGE":
                        storage_path = asset.get("storage_path")
                        if not storage_path or not Path(storage_path).is_file():
                            raise ApiError(f"Image asset {asset_id} has no readable persisted image file")
                    elif not (asset.get("content") or "").strip():
                        raise ApiError(f"Text asset {asset_id} has empty persisted content")
                    assets.append(asset)
                return assets, time.perf_counter() - started, None, response_bytes
            except Exception as error:
                last_error = str(error)
        time.sleep(0.5)
        status, current, size = authenticated_request(
            session, f"/ai/jobs/{final['task_id']}", timeout=60
        )
        response_bytes += size
        if status >= 400:
            last_error = f"Asset verification poll returned HTTP {status}"
    return [], time.perf_counter() - started, last_error or f"Expected {expected_count} persisted assets were not available within {timeout_seconds}s", response_bytes


def tcp_rtt(host: str, port: int, attempts: int = 10) -> dict[str, Any]:
    samples = []
    failures = 0
    for _ in range(attempts):
        started = time.perf_counter()
        try:
            with socket.create_connection((host, port), timeout=5):
                samples.append((time.perf_counter() - started) * 1000)
        except OSError:
            failures += 1
    return {"host": host, "port": port, "attempts": attempts, "failures": failures, "median_tcp_connect_ms": median(samples) if samples else None, "samples_ms": samples}


def network_metadata(include_cloudflare: bool = True) -> dict[str, Any]:
    profiles: Any = None
    if os.name == "nt":
        try:
            output = subprocess.check_output(
                ["powershell", "-NoProfile", "-Command", "Get-NetConnectionProfile | Select-Object InterfaceAlias,NetworkCategory,IPv4Connectivity | ConvertTo-Json -Compress"],
                text=True, timeout=10, stderr=subprocess.DEVNULL,
            ).strip()
            profiles = json.loads(output) if output else []
        except Exception as error:
            profiles = {"unavailable": type(error).__name__}
    return {
        "captured_at_utc": utc_now(),
        "platform": platform.platform(),
        "connection_profiles": profiles,
        "local_tcp_connect": tcp_rtt("127.0.0.1", 8000),
        "cloudflare_tcp_connect": tcp_rtt("inkknits.trustium.tech", 443) if include_cloudflare else None,
        "cloudflare_tcp_connect_note": None if include_cloudflare else "Skipped for local-only run.",
        "bandwidth_mbps": None,
        "bandwidth_note": "No independent bandwidth test was run; application transfer times include inference and persistence.",
    }


def resource_sample() -> dict[str, Any]:
    sample: dict[str, Any] = {
        "timestamp_utc": utc_now(),
        "cpu_percent": psutil.cpu_percent(interval=None),
        "ram_percent": psutil.virtual_memory().percent,
        "gpu_util_percent": None,
        "vram_util_percent": None,
        "gpu_temp_c": None,
        "gpu_power_w": None,
    }
    try:
        output = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu,power.draw", "--format=csv,noheader,nounits"],
            text=True, timeout=5,
        ).strip().splitlines()[0].split(",")
        if len(output) >= 5:
            sample["gpu_util_percent"] = float(output[0])
            sample["vram_util_percent"] = float(output[1]) / float(output[2]) * 100 if float(output[2]) else None
            sample["gpu_temp_c"] = float(output[3])
            sample["gpu_power_w"] = float(output[4])
    except Exception:
        pass
    return sample


def monitor_resources(path: Path, stop: threading.Event) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    while not stop.is_set():
        with path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps(resource_sample()) + "\n")
        stop.wait(1)


def append_event(path: Path, record: dict[str, Any]) -> None:
    safe = {key: value for key, value in record.items() if key not in {"prompt"}}
    if safe.get("error"):
        safe["error"] = sanitize_error(safe["error"])
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(safe, default=str) + "\n")


def create_input_asset(session: AuthSession, project: dict[str, Any], station: dict[str, Any], article: dict[str, str]) -> dict[str, Any]:
    payload = {
        "organization_id": project["organization_id"],
        "station_id": station["id"],
        "name": f"{article['article_id']}-benchmark-source-{uuid.uuid4().hex[:8]}",
        "title": f"{article['article_id']} benchmark source",
        "content": article["cleaned_text"],
        "asset_type": "TEXT",
    }
    asset, _ = require_auth_ok(session, "/assets", "POST", payload, timeout=60)
    return asset


def record_failure(benchmark_id: str, run_id: str, access: str, workload: str, article_id: str, operation: str, prompt: str, job_type: str, project_id: str, error: str, started: str, elapsed: float, seed: int | None = None) -> dict[str, Any]:
    sanitized = sanitize_error(error)
    status_match = re.search(r"HTTP\s+(\d{3})", sanitized, re.I)
    failure_http_status = int(status_match.group(1)) if status_match else None
    failure_category = "authentication_failure" if failure_http_status == 401 else "source_asset_failure"
    return {
        "benchmark_id": benchmark_id, "run_id": run_id, "access_path": access,
        "workload": workload, "article_id": article_id, "operation": operation,
        "request_id": str(uuid.uuid4()), "task_id": None, "http_status": 0,
        "job_status": "CLIENT_ERROR", "success": False, "utc_start": started,
        "utc_end": utc_now(), "monotonic_elapsed_s": elapsed,
        "persistence_observed_s": None, "persistence_verified": False,
        "expected_asset_count": None, "persisted_asset_count": 0,
        "payload_size_bytes": 0, "response_size_bytes": 0, "created_at": None,
        "started_at": None, "completed_at": None, "queue_wait_s": None,
        "inference_duration_s": None, "backend_total_s": None, "asset_ids": None,
        "persisted_asset_ids": None, "status": "FAILED", "error": sanitized,
        "failure_category": failure_category, "request_accepted": "not_submitted",
        "failure_http_status": failure_http_status, "auth_401_retries": 0,
        "prompt": prompt, "model_job_type": job_type, "seed": seed,
        "image_path": None, "project_id": project_id,
    }


def result_record(benchmark_id: str, run_id: str, access: str, workload: str, article_id: str, operation: str, prompt: str, job_type: str, project: dict[str, Any], station: dict[str, Any], payload: dict[str, Any], start_utc: str, start_mono: float, timeout_seconds: int, session: AuthSession, seed: int | None = None) -> dict[str, Any]:
    request_id = str(uuid.uuid4())
    task_id = None
    http_status = 0
    failure_http_status = None
    final: dict[str, Any] = {}
    error = None
    failure_category = None
    phase = "submission"
    auth_retries_start = session.unauthorized_retries
    assets: list[dict[str, Any]] = []
    persistence_s = None
    expected_count = len(payload.get("formats") or []) or 1
    response_size = 0
    payload_size = len(json.dumps(payload).encode("utf-8"))
    try:
        status, submitted, size = authenticated_request(
            session, "/ai/jobs", method="POST", body=payload, timeout=120
        )
        http_status = status
        response_size += size
        if status >= 400:
            failure_http_status = status
            if status == 401:
                failure_category = "authentication_failure"
            elif status < 500:
                failure_category = "request_rejected"
            else:
                failure_category = "submission_state_unknown"
            raise ApiError(f"Job submission returned HTTP {status}", status)
        task_id = str(submitted["task_id"])
        phase = "polling"
        final, poll_bytes = poll_job(session, task_id, timeout_seconds)
        response_size += poll_bytes
        phase = "persistence"
        assets, persistence_s, persistence_error, verification_bytes = verify_assets(
            session, project, station, final, expected_count
        )
        response_size += verification_bytes
        error = persistence_error
    except Exception as exception:
        error = sanitize_error(exception)
        failure_http_status = failure_http_status or getattr(exception, "http_status", None)
    if failure_http_status is None and error:
        status_match = re.search(r"HTTP\s+(\d{3})", error, re.I)
        failure_http_status = int(status_match.group(1)) if status_match else None
    end_mono = time.perf_counter()
    created_at = final.get("created_at")
    started_at = final.get("started_at")
    completed_at = final.get("completed_at")
    created = parse_time(created_at)
    started = parse_time(started_at)
    completed = parse_time(completed_at)
    result = final.get("result") or {}
    result_ids = result.get("asset_ids") or [] if isinstance(result, dict) else []
    status = final.get("status", "CLIENT_ERROR" if error and not task_id else "UNKNOWN")
    if error and failure_category is None:
        if failure_http_status == 401:
            failure_category = "authentication_failure"
        elif not task_id and phase == "submission":
            failure_category = (
                "request_rejected"
                if failure_http_status is not None and 400 <= failure_http_status < 500
                else "submission_state_unknown"
            )
        elif status == "FAILED":
            failure_category = "inference_failure"
        elif status in {"QUEUED", "RUNNING", "UNKNOWN"}:
            failure_category = "unknown_job_state" if task_id else "submission_failure"
        elif status == "COMPLETED":
            failure_category = "persistence_failure"
        elif phase == "polling":
            failure_category = "unknown_job_state"
        else:
            failure_category = "client_failure"
    persisted_ids = [str(asset["id"]) for asset in assets]
    image_path = next((asset.get("storage_path") for asset in assets if asset.get("asset_type") == "IMAGE"), None)
    return {
        "benchmark_id": benchmark_id, "run_id": run_id, "access_path": access,
        "workload": workload, "article_id": article_id, "operation": operation,
        "request_id": request_id, "task_id": task_id, "http_status": http_status,
        "job_status": status, "success": status == "COMPLETED" and len(assets) == expected_count and error is None,
        "utc_start": start_utc, "utc_end": utc_now(),
        "monotonic_elapsed_s": end_mono - start_mono,
        "persistence_observed_s": persistence_s, "persistence_verified": len(assets) == expected_count,
        "expected_asset_count": expected_count, "persisted_asset_count": len(assets),
        "payload_size_bytes": payload_size, "response_size_bytes": response_size,
        "created_at": created_at, "started_at": started_at, "completed_at": completed_at,
        "queue_wait_s": (started - created).total_seconds() if started and created else None,
        "inference_duration_s": (completed - started).total_seconds() if completed and started else None,
        "backend_total_s": (completed - created).total_seconds() if completed and created else None,
        "asset_ids": ",".join(str(value) for value in result_ids) if result_ids else None,
        "persisted_asset_ids": ",".join(persisted_ids) if persisted_ids else None,
        "status": status if not error else ("PERSISTENCE_UNVERIFIED" if status == "COMPLETED" else status),
        "error": sanitize_error(error or final.get("error")) if error or final.get("error") else None,
        "failure_category": failure_category,
        "request_accepted": (
            "accepted" if task_id
            else "rejected" if failure_http_status is not None and 400 <= failure_http_status < 500
            else "unknown"
        ),
        "failure_http_status": failure_http_status,
        "auth_401_retries": session.unauthorized_retries - auth_retries_start,
        "prompt": prompt, "model_job_type": job_type,
        "seed": seed, "image_path": image_path, "project_id": project["id"],
    }


BASES = {"local": LOCAL_BASE, "cloudflare": CLOUDFLARE_BASE}
current_auth: dict[str, AuthSession] = {}


def checkpoint_record(record: dict[str, Any], rows: list[dict[str, Any]], records_path: Path, events_path: Path, summary_path: Path, started_utc: str, benchmark_id: str, run_id: str, access: str, expected_total: int) -> None:
    rows.append(record)
    checkpoint_csv(records_path, rows)
    append_event(events_path, record)
    elapsed = (datetime.now(timezone.utc) - datetime.fromisoformat(started_utc)).total_seconds()
    atomic_json(summary_path, {
        "benchmark_id": benchmark_id, "run_id": run_id, "access_path": access,
        "status": "RUNNING", "expected_requests": expected_total,
        "recorded_requests": len(rows), "successes": sum(bool(row["success"]) for row in rows),
        "failures": sum(not bool(row["success"]) for row in rows),
        "runtime_seconds": elapsed, "updated_at_utc": utc_now(),
    })
    print(f"{access}: {len(rows)}/{expected_total} requests recorded; latest={record['job_status']}; success={record['success']}", flush=True)


def run_condition(benchmark_id: str, access: str, text_rows: list[dict[str, str]], image_rows: list[dict[str, str]], smoke: bool, local_only: bool = False) -> dict[str, Any]:
    global current_auth
    base = BASES[access]
    run_id = f"{benchmark_id}-{access}"
    output_dir = OUTPUT_ROOT / access / run_id
    output_dir.mkdir(parents=True, exist_ok=False)
    records_path = output_dir / "records.csv"
    events_path = output_dir / "events.jsonl"
    resources_path = output_dir / "resources.jsonl"
    summary_path = output_dir / "summary.json"
    manifest_path = output_dir / "run_manifest.json"
    rows: list[dict[str, Any]] = []
    started_utc = utc_now()
    started_mono = time.perf_counter()
    stop_resources = threading.Event()
    resource_thread = threading.Thread(target=monitor_resources, args=(resources_path, stop_resources), daemon=True)
    configuration = benchmark_configuration()
    manifest: dict[str, Any] = {
        "benchmark_id": benchmark_id,
        "run_id": run_id,
        "access_path": access,
        "status": "RUNNING",
        "started_at_utc": started_utc,
        "project_id": PROJECT_ID,
        "text_rows": len(text_rows),
        "image_rows": len(image_rows),
        "text_dataset_sha256": dataset_sha256(TEXT_DATASET),
        "image_dataset_sha256": dataset_sha256(IMAGE_DATASET),
        "configuration": configuration,
        "configuration_sha256": canonical_sha256(configuration),
        "request_plan_sha256": request_plan_sha256(text_rows, image_rows),
        "smoke": smoke,
    }
    atomic_json(manifest_path, manifest)
    current_auth[access] = AuthSession(base)
    current_auth[access].get_token()
    session = current_auth[access]
    me, _ = require_auth_ok(session, "/auth/me")
    project, _ = require_auth_ok(session, f"/projects/{PROJECT_ID}")
    stations, _ = require_auth_ok(session, "/stations")
    writing = next((item for item in stations if item.get("project_id") == project["id"] and item.get("station_type") == "WRITING"), None)
    image = next((item for item in stations if item.get("project_id") == project["id"] and item.get("station_type") == "IMAGE"), None)
    if not writing or not image:
        raise ApiError("Benchmark project is missing a WRITING or IMAGE station")
    network_file = output_dir / "network_metadata.json"
    if access == "local":
        atomic_json(network_file, network_metadata(include_cloudflare=not local_only))
    expected_total = len(text_rows) * (1 if smoke else 4) + len(image_rows)
    checkpoint_csv(records_path, rows)
    atomic_json(summary_path, {"benchmark_id": benchmark_id, "run_id": run_id, "access_path": access, "status": "RUNNING", "expected_requests": expected_total, "recorded_requests": 0, "started_at_utc": started_utc})
    resource_thread.start()
    try:
        for article in text_rows:
            article_id = article["article_id"]
            try:
                source_asset = create_input_asset(session, project, writing, article)
                source_error = None
            except Exception as exception:
                source_asset = None
                source_error = str(exception)
            ops = [
                ("summarization", "SUMMARIZE", component_prompt("summarization", article["cleaned_text"]), "summarize", []),
                ("shortening", "REWRITE", component_prompt("shortening", article["cleaned_text"]), "rewrite", []),
                ("atomization_2", "ATOMIZE", "", "atomize_format", ["LinkedIn post", "Short newsletter section"]),
                ("atomization_5", "ATOMIZE", "", "atomize_format", ["LinkedIn post", "Short newsletter section", "X/Twitter-style post", "Blog introduction", "Short promotional description"]),
            ]
            if smoke:
                ops = ops[:1]
            for operation, job_type, prompt, action, formats in ops:
                started = time.perf_counter()
                started_utc_request = utc_now()
                if source_error:
                    record = record_failure(benchmark_id, run_id, access, "text", article_id, operation, prompt, job_type, project["id"], source_error, started_utc_request, time.perf_counter() - started)
                else:
                    child_prompts = [component_prompt("atomization", article["cleaned_text"], output_format) for output_format in formats]
                    payload = {"job_type": job_type, "asset_id": source_asset["id"], "draft": "", "prompt": prompt, "action": action, "formats": formats, "child_prompts": child_prompts, "model_options": {"temperature": 0.2, "num_ctx": 8192}}
                    record_prompt = prompt or "\n\n".join(child_prompts)
                    record = result_record(benchmark_id, run_id, access, "text", article_id, operation, record_prompt, job_type, project, writing, payload, started_utc_request, started, 600, session)
                checkpoint_record(record, rows, records_path, events_path, summary_path, started_utc, benchmark_id, run_id, access, expected_total)
        for image_row in image_rows:
            seed = int(image_row["seed"])
            prompt = image_row["prompt"]
            payload = {"job_type": "IMAGE", "station_id": image["id"], "prompt": prompt, "draft": prompt, "action": "generate", "name": f"{image_row['article_id']}-image-{run_id}", "title": f"{image_row['article_id']} benchmark image {access}", "width": 512, "height": 512, "seed": seed}
            start = time.perf_counter()
            start_utc = utc_now()
            record = result_record(benchmark_id, run_id, access, "image", image_row["article_id"], "image_generation", prompt, "IMAGE", project, image, payload, start_utc, start, 900, session, seed)
            checkpoint_record(record, rows, records_path, events_path, summary_path, started_utc, benchmark_id, run_id, access, expected_total)
        status = "COMPLETED" if len(rows) == expected_total else "INCOMPLETE"
    except KeyboardInterrupt:
        status = "INTERRUPTED"
        raise
    except Exception as exception:
        status = "FAILED"
        manifest["fatal_error"] = str(exception)
    finally:
        stop_resources.set()
        if resource_thread.is_alive():
            resource_thread.join(timeout=10)
        runtime = time.perf_counter() - started_mono
        successes = sum(bool(row["success"]) for row in rows)
        failures = len(rows) - successes
        manifest.update({"status": locals().get("status", "INTERRUPTED"), "ended_at_utc": utc_now(), "runtime_seconds": runtime, "recorded_requests": len(rows), "successes": successes, "failures": failures, "expected_requests": expected_total, "organization_id": me.get("organization_id"), "auth_login_count": session.login_count, "auth_401_retry_count": session.unauthorized_retries, "output_directory": str(output_dir.relative_to(ROOT))})
        atomic_json(manifest_path, manifest)
        atomic_json(summary_path, manifest)
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke", action="store_true", help="Run one text summarization and one image generation per access path.")
    parser.add_argument("--local-only", action="store_true")
    parser.add_argument("--cloudflare-only", action="store_true")
    args = parser.parse_args()
    if args.local_only and args.cloudflare_only:
        parser.error("Choose at most one access-path-only option")
    if not EMAIL or not PASSWORD or not PROJECT_ID:
        parser.error("Set benchmark email, password, and project ID environment variables")
    if not TEXT_DATASET.is_file() or not IMAGE_DATASET.is_file():
        parser.error("Required benchmark datasets are missing")
    text_rows = read_csv(TEXT_DATASET)
    image_rows = read_csv(IMAGE_DATASET)
    if args.smoke:
        text_rows = text_rows[:1]
        image_rows = image_rows[:1]
    benchmark_id = f"app-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    configuration = benchmark_configuration()
    conditions = []
    for access in ("local", "cloudflare"):
        if args.local_only and access != "local":
            continue
        if args.cloudflare_only and access != "cloudflare":
            continue
        result = run_condition(benchmark_id, access, text_rows, image_rows, args.smoke, local_only=args.local_only)
        conditions.append(result)
    if args.local_only:
        if args.smoke:
            root_status = "SMOKE_COMPLETED" if conditions and conditions[0]["status"] == "COMPLETED" and conditions[0]["failures"] == 0 else "SMOKE_FAILED"
        elif conditions and all(item["status"] == "COMPLETED" for item in conditions):
            root_status = "COMPLETED" if all(item["successes"] == item["expected_requests"] for item in conditions) else "COMPLETED_WITH_FAILURES"
        else:
            root_status = "INCOMPLETE"
        scope = "local_application_only"
    else:
        root_status = "COMPLETED" if len(conditions) == 2 and all(item["status"] == "COMPLETED" for item in conditions) else "PRELIMINARY"
        scope = "paired_local_cloudflare" if not args.cloudflare_only else "cloudflare_only"
    root_manifest = {
        "benchmark_id": benchmark_id,
        "status": root_status,
        "scope": scope,
        "created_at_utc": utc_now(),
        "project_id": PROJECT_ID,
        "conditions": conditions,
        "text_dataset": str(TEXT_DATASET.relative_to(ROOT)),
        "text_dataset_sha256": dataset_sha256(TEXT_DATASET),
        "text_rows": len(text_rows),
        "image_dataset": str(IMAGE_DATASET.relative_to(ROOT)),
        "image_dataset_sha256": dataset_sha256(IMAGE_DATASET),
        "image_rows": len(image_rows),
        "configuration": configuration,
        "configuration_sha256": canonical_sha256(configuration),
        "request_plan_sha256": request_plan_sha256(text_rows, image_rows),
        "paired_key": "workload + article_id + operation; image seeds reused from source prompt CSV",
        "limitations": ["Same laptop and AI services serve both paths; this is not cloud compute or geographic remote-client testing.", "No independent bandwidth test; TCP connect latency is recorded.", "Persistence timing is the client-observed interval from terminal job response until result assets are fetchable."]
    }
    atomic_json(OUTPUT_ROOT / "manifests" / f"{benchmark_id}.json", root_manifest)
    print(json.dumps({"benchmark_id": benchmark_id, "status": root_manifest["status"], "conditions": [{"access_path": row["access_path"], "requests": row["recorded_requests"], "successes": row["successes"], "failures": row["failures"], "runtime_seconds": row["runtime_seconds"]} for row in conditions]}, indent=2))
    return 0 if root_manifest["status"] in {"COMPLETED", "SMOKE_COMPLETED"} else 2


if __name__ == "__main__":
    raise SystemExit(main())
