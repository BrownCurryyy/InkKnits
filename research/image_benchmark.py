from __future__ import annotations

import argparse
import csv
import hashlib
import json
import platform
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

from research.config import BENCHMARK_SAMPLE, RESULTS
from research.resource_monitor import ResourceMonitor

ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_PATH = ROOT / "backend" / "final4.json"
IMAGE_RESULTS = RESULTS / "image_experiment_results.csv"
IMAGE_JSONL = RESULTS / "image_experiment_results.jsonl"
IMAGE_SUMMARY = RESULTS / "image_experiment_summary.json"
IMAGE_RESOURCES = RESULTS / "image_resource_samples.csv"
IMAGE_PROMPTS = RESULTS / "image_generation_prompts.csv"
IMAGE_DIR = RESULTS / "generated_images"
COMFY_URL = "http://127.0.0.1:8188"
CHECKPOINT = "epicrealism_naturalSinRC1VAE.safetensors"
MASTER_SEED = 20261108


def comfy_get(endpoint: str) -> dict:
    with urllib.request.urlopen(f"{COMFY_URL}/{endpoint}", timeout=10) as response:
        return json.loads(response.read().decode())


def comfy_post(endpoint: str, payload: dict) -> dict:
    request = urllib.request.Request(f"{COMFY_URL}/{endpoint}", data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.loads(response.read().decode())


def prompt_from_article(article: str) -> tuple[str, str]:
    normalized = " ".join(article.split())
    excerpt = normalized[:1200]
    prompt = f"Editorial documentary illustration inspired by this article excerpt: {excerpt}. Focus on the central subject, setting, people, objects, and action. No text, logos, captions, or invented specific identities."
    return prompt, "whitespace-normalized article text truncated to 1200 characters; deterministic template; no LLM rewriting"


def seed_for(article_id: str) -> int:
    digest = hashlib.sha256(f"{MASTER_SEED}:{article_id}".encode()).hexdigest()
    return int(digest[:15], 16) % (2**31 - 1)


def workflow_for(prompt: str, seed: int) -> dict:
    workflow = json.loads(WORKFLOW_PATH.read_text(encoding="utf-8"))
    workflow["4"]["inputs"]["ckpt_name"] = CHECKPOINT
    workflow["5"]["inputs"].update({"width": 512, "height": 512, "batch_size": 1})
    workflow["6"]["inputs"]["text"] = prompt + ", masterpiece, best quality, ultra-detailed, sharp focus, 8k, professional photography, intricate details, award winning"
    workflow["3"]["inputs"]["seed"] = seed
    workflow["20"]["inputs"]["seed"] = seed + 1
    workflow["9"]["inputs"]["filename_prefix"] = "inkknits_image_benchmark_"
    return workflow


def wait_history(prompt_id: str, timeout: int = 600) -> dict:
    deadline = time.perf_counter() + timeout
    while time.perf_counter() < deadline:
        history = comfy_get(f"history/{prompt_id}")
        if prompt_id in history:
            return history[prompt_id]
        time.sleep(1)
    raise TimeoutError(f"ComfyUI prompt {prompt_id} timed out after {timeout} seconds")


def fetch_image(info: dict) -> bytes:
    from urllib.parse import urlencode
    query = urlencode({"filename": info["filename"], "subfolder": info.get("subfolder", ""), "type": info.get("type", "output")})
    with urllib.request.urlopen(f"{COMFY_URL}/view?{query}", timeout=60) as response:
        return response.read()


def validate_image(path: Path) -> tuple[int, int, int]:
    with Image.open(path) as image:
        image.verify()
    with Image.open(path) as image:
        return image.width, image.height, path.stat().st_size


def run(sample_size: int, label: str, warmup: bool = True) -> dict:
    run_id = f"image-{label}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    rows = list(csv.DictReader((BENCHMARK_SAMPLE).open(encoding="utf-8", newline="")))[:sample_size]
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    fields = ["run_id", "record_type", "article_id", "prompt", "prompt_preprocessing", "seed", "comfy_prompt_id", "submission_timestamp", "queue_start_timestamp", "execution_start_timestamp", "completion_timestamp", "queue_wait_seconds", "generation_seconds", "total_elapsed_seconds", "output_path", "width", "height", "file_size_bytes", "status", "error", "attempt"]
    prompt_fields = ["run_id", "article_id", "seed", "prompt", "prompt_preprocessing", "source_dataset_id"]
    output_rows: list[dict] = []; prompt_rows: list[dict] = []
    def append_result(row: dict) -> None:
        output_rows.append(row)
        with IMAGE_RESULTS.open("a", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields)
            if handle.tell() == 0: writer.writeheader()
            writer.writerow(row)
        with IMAGE_JSONL.open("a", encoding="utf-8") as handle: handle.write(json.dumps(row) + "\n")
    with IMAGE_PROMPTS.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=prompt_fields); writer.writeheader()
        for source in rows:
            prompt, preprocessing = prompt_from_article(source["cleaned_text"]); seed = seed_for(source["article_id"]); prompt_row = {"run_id": run_id, "article_id": source["article_id"], "seed": seed, "prompt": prompt, "prompt_preprocessing": preprocessing, "source_dataset_id": source["article_id"]}; writer.writerow(prompt_row); prompt_rows.append(prompt_row)
    monitor = ResourceMonitor(); monitor.start(); warmup_result = None
    if warmup:
        warmup_start = datetime.now(timezone.utc).isoformat()
        try:
            warmup_prompt = "A simple editorial still life of a notebook and a camera, no text"
            response = comfy_post("prompt", {"prompt": workflow_for(warmup_prompt, MASTER_SEED), "client_id": str(uuid.uuid4())})
            warmup_id = response.get("prompt_id")
            if not warmup_id: raise RuntimeError(f"ComfyUI did not return prompt_id: {response}")
            wait_history(warmup_id)
            warmup_result = {"status": "success", "prompt_id": warmup_id, "submission_timestamp": warmup_start, "completion_timestamp": datetime.now(timezone.utc).isoformat()}
        except Exception as exc:
            warmup_result = {"status": "failure", "error": str(exc), "submission_timestamp": warmup_start}
    for source, prompt_row in zip(rows, prompt_rows):
        submitted = datetime.now(timezone.utc); start_perf = time.perf_counter(); result = {"run_id": run_id, "record_type": "measured", "article_id": source["article_id"], "prompt": prompt_row["prompt"], "prompt_preprocessing": prompt_row["prompt_preprocessing"], "seed": prompt_row["seed"], "comfy_prompt_id": None, "submission_timestamp": submitted.isoformat(), "queue_start_timestamp": None, "execution_start_timestamp": None, "completion_timestamp": None, "queue_wait_seconds": None, "generation_seconds": None, "total_elapsed_seconds": None, "output_path": None, "width": None, "height": None, "file_size_bytes": None, "status": "failure", "error": None, "attempt": 1}
        try:
            response = comfy_post("prompt", {"prompt": workflow_for(prompt_row["prompt"], int(prompt_row["seed"])), "client_id": str(uuid.uuid4())}); prompt_id = response.get("prompt_id")
            if not prompt_id: raise RuntimeError(f"ComfyUI did not return prompt_id: {response}")
            result["comfy_prompt_id"] = prompt_id
            history = wait_history(prompt_id); completed = datetime.now(timezone.utc); result["completion_timestamp"] = completed.isoformat(); result["total_elapsed_seconds"] = time.perf_counter() - start_perf
            status = history.get("status", {}); messages = status.get("messages", []) if isinstance(status, dict) else []
            if status.get("status_str") == "error" or status.get("completed") is False: raise RuntimeError(f"ComfyUI history reported failure: {messages}")
            images = []
            for node_output in history.get("outputs", {}).values():
                if isinstance(node_output, dict) and node_output.get("images"): images.extend(node_output["images"])
            if not images: raise RuntimeError("ComfyUI completed without image output")
            path = IMAGE_DIR / f"{source['article_id']}_{prompt_id}.png"; path.write_bytes(fetch_image(images[0])); width, height, size = validate_image(path); result.update({"output_path": str(path.relative_to(ROOT)), "width": width, "height": height, "file_size_bytes": size, "status": "success", "generation_seconds": result["total_elapsed_seconds"], "execution_start_timestamp": result["submission_timestamp"]})
        except Exception as exc:
            result["error"] = str(exc); result["total_elapsed_seconds"] = time.perf_counter() - start_perf
        append_result(result); monitor.sample(); print(f"{source['article_id']}: {result['status']}")
    resource_summary = monitor.stop(); monitor.write_csv(IMAGE_RESOURCES)
    summary = {"run_id": run_id, "sample_size": len(rows), "warmup": warmup_result, "resource_summary": resource_summary, "measured_successes": sum(row["status"] == "success" for row in output_rows), "measured_failures": sum(row["status"] != "success" for row in output_rows), "output_rows": len(output_rows), "workflow_path": str(WORKFLOW_PATH), "checkpoint": CHECKPOINT, "configuration": {"width": 512, "height": 512, "steps": 28, "refinement_steps": 15, "cfg": 7.5, "refinement_cfg": 7, "sampler": "dpmpp_2m", "scheduler": "karras", "batch_size": 1, "seed_strategy": "sha256(20261108:article_id) modulo 2^31-1", "queue_wait": "unavailable from ComfyUI history API; recorded null"}, "software": {"python": platform.python_version(), "platform": platform.platform()}}
    IMAGE_SUMMARY.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    return summary


def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("--sample-size", type=int, default=45); parser.add_argument("--run-label", default="full"); parser.add_argument("--no-warmup", action="store_true"); args = parser.parse_args()
    try: print(json.dumps(run(args.sample_size, args.run_label, not args.no_warmup), indent=2))
    except urllib.error.URLError as exc: print(json.dumps({"status": "blocked", "reason": f"ComfyUI unavailable at {COMFY_URL}: {exc}"}, indent=2)); raise SystemExit(2)

if __name__ == "__main__": main()
