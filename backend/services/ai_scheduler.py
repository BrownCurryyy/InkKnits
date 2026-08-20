"""
AIScheduler — asyncio.PriorityQueue-based single-GPU job scheduler.

Rules (from RULES.md §7-8):
  - Every AI request creates exactly one Job.
  - Jobs are immutable after creation.
  - Every Job immediately returns a task_id.
  - GPU concurrency is permanently locked to 1.
  - Text-generation Jobs always have higher priority than image-generation Jobs.
  - Prompt enrichment must complete before image generation begins.
  - Long-running Jobs never block the API server.

Priority order:
  1  TEXT_GENERATE
  2  SUMMARIZE
  3  EXPAND
  4  ATOMIZE
  5  IMAGE_GENERATE
  6  IMAGE_UPSCALE
"""

import asyncio
import json
import uuid
from datetime import datetime, timezone
from enum import IntEnum
from pathlib import Path
from typing import Any

from backend.services.ollama_service import OllamaService
from backend.services.comfyui_service import ComfyUIService
from backend.services.storage import StorageService

# ---------------------------------------------------------------------------
# Priority constants
# ---------------------------------------------------------------------------

class JobPriority(IntEnum):
    TEXT_GENERATE  = 1
    SUMMARIZE      = 2
    EXPAND         = 3
    ATOMIZE        = 4
    IMAGE_GENERATE = 5
    IMAGE_UPSCALE  = 6


JOB_TYPE_TO_PRIORITY: dict[str, JobPriority] = {
    "TEXT":       JobPriority.TEXT_GENERATE,
    "SUMMARIZE":  JobPriority.SUMMARIZE,
    "EXPAND":     JobPriority.EXPAND,
    "ATOMIZE":    JobPriority.ATOMIZE,
    "IMAGE":      JobPriority.IMAGE_GENERATE,
    "UPSCALE":    JobPriority.IMAGE_UPSCALE,
    # text action aliases
    "REWRITE":        JobPriority.TEXT_GENERATE,
    "IMPROVE_TONE":   JobPriority.TEXT_GENERATE,
    "CHANGE_AUDIENCE":JobPriority.TEXT_GENERATE,
}


# ---------------------------------------------------------------------------
# In-memory Job store
# ---------------------------------------------------------------------------

class AIJob:
    """Runtime representation of a single AI job (in-memory only)."""

    __slots__ = (
        "task_id", "job_type", "priority", "status",
        "payload", "result", "error",
        "queue_position", "created_at", "started_at", "completed_at",
    )

    def __init__(self, job_type: str, payload: dict, task_id: str | None = None) -> None:
        self.task_id: str = task_id or str(uuid.uuid4())
        self.job_type: str = job_type.upper()
        self.priority: int = int(JOB_TYPE_TO_PRIORITY.get(self.job_type, JobPriority.TEXT_GENERATE))
        self.status: str = "QUEUED"
        self.payload: dict = payload
        self.result: Any = None
        self.error: str | None = None
        self.queue_position: int | None = None
        self.created_at: datetime = datetime.now(timezone.utc)
        self.started_at: datetime | None = None
        self.completed_at: datetime | None = None

    def to_dict(self) -> dict:
        return {
            "task_id":        self.task_id,
            "job_type":       self.job_type,
            "priority":       self.priority,
            "status":         self.status,
            "result":         self.result,
            "error":          self.error,
            "queue_position": self.queue_position,
            "created_at":     self.created_at.isoformat(),
            "started_at":     self.started_at.isoformat() if self.started_at else None,
            "completed_at":   self.completed_at.isoformat() if self.completed_at else None,
        }

    # Priority queue comparison (lower number = higher priority)
    def __lt__(self, other: "AIJob") -> bool:
        return self.priority < other.priority


# ---------------------------------------------------------------------------
# Scheduler singleton
# ---------------------------------------------------------------------------

class AIScheduler:
    """
    Single-GPU asyncio scheduler.
    Start with scheduler.start() inside the FastAPI lifespan handler.
    """

    def __init__(self) -> None:
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._jobs: dict[str, AIJob] = {}          # task_id → AIJob
        self._worker_task: asyncio.Task | None = None
        self._sequence = 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def submit(self, job_type: str, payload: dict, task_id: str | None = None) -> AIJob:
        """Create, enqueue, and return a new AIJob immediately."""
        job = AIJob(job_type, payload, task_id=task_id)
        self._jobs[job.task_id] = job
        self._sequence += 1
        self._queue.put_nowait((job.priority, self._sequence, job))
        self._update_queue_positions()
        return job

    def get_job(self, task_id: str) -> AIJob | None:
        return self._jobs.get(task_id)

    def queue_size(self) -> int:
        return self._queue.qsize()

    def cancel(self, task_id: str) -> bool:
        """Cancel a queued or running job if it is still cancellable."""
        job = self._jobs.get(task_id)
        if job is None:
            return False
        if job.status in {"COMPLETED", "FAILED", "CANCELLED"}:
            return False
        if job.status == "RUNNING":
            # The worker cannot safely interrupt an external Ollama/ComfyUI call.
            # Marking it cancelled prevents its result from being published.
            job.status = "CANCELLED"
            job.completed_at = datetime.now(timezone.utc)
            self._persist_job_state(job)
            return True
        job.status = "CANCELLED"
        job.completed_at = datetime.now(timezone.utc)
        self._persist_job_state(job)
        return True

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Launch the background worker coroutine (call once on app startup)."""
        if self._worker_task is None or self._worker_task.done():
            self._worker_task = asyncio.create_task(self._worker_loop())

    async def stop(self) -> None:
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass

    # ------------------------------------------------------------------
    # Internal worker loop — GPU concurrency = 1
    # ------------------------------------------------------------------

    async def _worker_loop(self) -> None:
        while True:
            _priority, _sequence, job = await self._queue.get()
            await self._execute(job)
            self._queue.task_done()
            self._update_queue_positions()

    async def _execute(self, job: AIJob) -> None:
        if job.status == "CANCELLED":
            self._persist_job_state(job)
            return

        job.status = "RUNNING"
        job.started_at = datetime.now(timezone.utc)
        await asyncio.to_thread(self._persist_job_state, job)

        try:
            if job.job_type in ("TEXT", "REWRITE", "IMPROVE_TONE", "CHANGE_AUDIENCE"):
                job.result = await asyncio.to_thread(self._run_text, job.payload)

            elif job.job_type == "SUMMARIZE":
                job.result = await asyncio.to_thread(self._run_summarize, job.payload)

            elif job.job_type == "EXPAND":
                job.result = await asyncio.to_thread(self._run_expand, job.payload)

            elif job.job_type == "ATOMIZE":
                job.result = await asyncio.to_thread(self._run_atomize, job.payload)

            elif job.job_type == "IMAGE":
                job.result = await asyncio.to_thread(self._run_image, job.payload)

            elif job.job_type == "UPSCALE":
                job.result = await asyncio.to_thread(self._run_upscale, job.payload)

            else:
                raise ValueError(f"Unknown job type: {job.job_type}")

            if job.status != "CANCELLED":
                job.status = "COMPLETED"

        except Exception as exc:
            if job.status != "CANCELLED":
                job.status = "FAILED"
                job.error = str(exc)

        finally:
            job.completed_at = datetime.now(timezone.utc)
            await asyncio.to_thread(self._persist_job_state, job)

    # ------------------------------------------------------------------
    # Handlers (run inside thread pool via asyncio.to_thread)
    # ------------------------------------------------------------------

    @staticmethod
    def _run_text(payload: dict) -> dict:
        text = OllamaService.generate(
            prompt=payload.get("prompt", ""),
            draft=payload.get("draft", ""),
            action=payload.get("action", "generate"),
            mood=payload.get("mood", "Professional"),
            style=payload.get("style", "Narrative"),
            audience=payload.get("audience", ""),
            content_length=payload.get("content_length", ""),
        )
        return {"content": text}

    @staticmethod
    def _run_summarize(payload: dict) -> dict:
        text = OllamaService.generate(
            prompt="Summarize the following content.",
            draft=payload.get("draft", ""),
            action="summarize",
            content_length=payload.get("content_length", "Short"),
        )
        return {"content": text}

    @staticmethod
    def _run_expand(payload: dict) -> dict:
        text = OllamaService.generate(
            prompt="Expand the following content.",
            draft=payload.get("draft", ""),
            action="expand",
            mood=payload.get("mood", "Professional"),
            style=payload.get("style", "Narrative"),
            audience=payload.get("audience", ""),
            content_length=payload.get("content_length", "Medium"),
        )
        return {"content": text}

    @staticmethod
    def _run_atomize(payload: dict) -> dict:
        results = OllamaService.atomize(
            parent_content=payload.get("parent_content", ""),
            formats=payload.get("formats", []),
            mood=payload.get("mood", "Professional"),
            audience=payload.get("audience", ""),
            content_length=payload.get("content_length", ""),
        )
        return {"results": results}

    @staticmethod
    def _run_image(payload: dict) -> dict:
        """
        Full image pipeline:
          1. Gemma enriches user prompt → enriched prompt
          2. ComfyUI dual-KSampler + 4x upscaler → PNG on SSD
          3. Base64 encoded for API response
        """
        user_prompt = payload.get("prompt", "")
        organization_id = payload.get("organization_id")
        asset_id = payload.get("output_asset_id", str(uuid.uuid4()))

        # Step 1: Gemma prompt enrichment (MUST complete before ComfyUI)
        enriched_prompt = OllamaService.enrich_image_prompt(user_prompt)

        # Step 2: Build save path
        project_id = payload.get("project_id")
        if not project_id:
            raise ValueError("Image generation requires project_id")
        save_dir = StorageService.get_asset_directory(
            organization_id=organization_id,
            project_id=project_id,
        )
        save_path = save_dir / f"{asset_id}.png"

        # Step 3: ComfyUI generation
        # Optional API model values may be present as JSON null; do not let
        # that overwrite the checkpoint declared by the canonical workflow.
        model = payload.get("model") or "epicrealism_naturalSinRC1VAE.safetensors"
        width = payload.get("width", 512)
        height = payload.get("height", 512)

        saved_path = ComfyUIService.generate_image(
            enriched_prompt=enriched_prompt,
            save_path=save_path,
            model_filename=model,
            width=width,
            height=height,
        )

        # Step 4: Base64 encode for response
        encoded = StorageService.read_file_as_base64(saved_path)

        return {
            "enriched_prompt": enriched_prompt,
            "storage_path": saved_path,
            "data": encoded,
            "encoding": "base64",
            "asset_ids": [asset_id],
        }

    @staticmethod
    def _run_upscale(payload: dict) -> dict:
        """Upscale an existing image using the 4x model via ComfyUI."""
        # For now, this re-generates via the upscale-only workflow.
        # Placeholder for direct upscale-only ComfyUI workflow.
        return {"status": "upscale_not_yet_implemented"}

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _update_queue_positions(self) -> None:
        """Re-number queue positions for all QUEUED jobs (best-effort)."""
        queued = [j for j in self._jobs.values() if j.status == "QUEUED"]
        queued.sort(key=lambda j: j.priority)
        for i, j in enumerate(queued):
            j.queue_position = i + 1
            self._persist_job_state(j)

    @staticmethod
    def _persist_job_state(job: AIJob) -> None:
        """Persist a terminal job state and materialize generated assets."""
        from backend.database.connection import SessionLocal
        from backend.models.ai_job import AIJob as PersistedAIJob

        session = SessionLocal()
        try:
            persisted = session.get(PersistedAIJob, uuid.UUID(job.task_id))
            if persisted is None:
                return

            persisted.status = job.status
            persisted.started_at = job.started_at
            persisted.completed_at = job.completed_at
            persisted.queue_position = job.queue_position
            persisted.error = job.error
            if job.result is not None:
                persisted.result_data = json.dumps(job.result, default=str)
            if job.status == "COMPLETED":
                asset_ids = AIScheduler._create_result_assets(session, job)
                if asset_ids:
                    persisted.result_asset = json.dumps(asset_ids)
            session.commit()
        except Exception:
            session.rollback()
            return
        finally:
            session.close()

    @staticmethod
    def _create_result_assets(session: Any, job: AIJob) -> list[str]:
        """Turn atomized and generated image output into first-class assets."""
        from backend.models.asset import Asset
        from backend.models.asset_link import AssetLink

        result = job.result or {}
        if job.job_type == "IMAGE":
            asset_id = uuid.UUID(result["asset_ids"][0])
            completed_at = job.completed_at
            session.add(Asset(
                id=asset_id,
                organization_id=uuid.UUID(str(job.payload["organization_id"])),
                station_id=uuid.UUID(str(job.payload["station_id"])),
                owner_id=uuid.UUID(str(job.payload["created_by"])) if job.payload.get("created_by") else None,
                name=job.payload.get("name") or f"Generated image {asset_id}",
                title=job.payload.get("title"),
                asset_type="IMAGE",
                storage_path=result["storage_path"],
                raw_metadata={
                    "prompt": job.payload["prompt"],
                    "enriched_prompt": result["enriched_prompt"],
                    "model": job.payload.get("model", "epiCRealism.safetensors"),
                },
                created_at=completed_at,
                updated_at=completed_at,
            ))
            session.flush()
            from backend.services.version_service import VersionService
            from backend.services.activity_service import ActivityService

            VersionService.create_snapshot(session, session.get(Asset, asset_id), user_id=job.payload.get("created_by"))
            ActivityService.log(
                session,
                "ASSET_CREATED",
                f"Generated image asset '{job.payload.get('name') or asset_id}' created",
                organization_id=uuid.UUID(str(job.payload["organization_id"])),
                asset_id=asset_id,
                user_id=uuid.UUID(str(job.payload["created_by"])) if job.payload.get("created_by") else None,
            )
            return [str(asset_id)]

        if job.job_type != "ATOMIZE":
            return []

        parent_id = uuid.UUID(str(job.payload["asset_id"]))
        completed_at = job.completed_at
        asset_ids: list[str] = []
        from backend.services.activity_service import ActivityService
        from backend.services.version_service import VersionService

        for item in result.get("results", []):
            child_id = uuid.uuid4()
            child_asset = Asset(
                id=child_id,
                organization_id=uuid.UUID(str(job.payload["organization_id"])),
                station_id=uuid.UUID(str(job.payload["station_id"])),
                owner_id=uuid.UUID(str(job.payload["created_by"])) if job.payload.get("created_by") else None,
                name=f"{item['format']} from {parent_id}",
                title=item["format"],
                content=item["content"],
                asset_type=item["format"].upper().replace(" ", "_"),
                raw_metadata={"parent_asset_id": str(parent_id), "generation": job.payload},
                created_at=completed_at,
                updated_at=completed_at,
            )
            session.add(child_asset)
            session.add(AssetLink(
                parent_asset_id=parent_id,
                child_asset_id=child_id,
                relationship_type="ATOMIZED_FROM",
                created_at=completed_at,
            ))
            session.flush()
            VersionService.create_snapshot(session, child_asset, user_id=uuid.UUID(str(job.payload["created_by"])))
            ActivityService.log(
                session,
                "ASSET_CREATED",
                f"Atomized child asset '{child_asset.name}' created from parent {parent_id}",
                organization_id=child_asset.organization_id,
                asset_id=child_asset.id,
                user_id=uuid.UUID(str(job.payload["created_by"])),
                raw_metadata={"parent_asset_id": str(parent_id), "relationship_type": "ATOMIZED_FROM"},
            )
            ActivityService.log(
                session,
                "ATOMIZED",
                f"Asset {child_asset.id} atomized from parent {parent_id}",
                organization_id=child_asset.organization_id,
                asset_id=child_asset.id,
                user_id=uuid.UUID(str(job.payload["created_by"])),
                raw_metadata={"parent_asset_id": str(parent_id), "format": item["format"]},
            )
            asset_ids.append(str(child_id))
        return asset_ids


# ---------------------------------------------------------------------------
# Module-level singleton — imported by main.py and routers
# ---------------------------------------------------------------------------

scheduler = AIScheduler()
