from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import platform
import subprocess
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone
from pathlib import Path

from research.config import ATOMIZATION_FORMATS_2, ATOMIZATION_FORMATS_5, BENCHMARK_SAMPLE, DEFAULT_SAMPLE_SIZE, OLLAMA_BASE_URL, OLLAMA_MODEL, RAW_DATASET, RESULTS, SEED
from research.metrics import safe_ratio
from research.resource_monitor import ResourceMonitor
from research.text_utils import length_group, word_count


def ollama_json(path: str, payload: dict | None = None, timeout: int = 180) -> dict:
    url = f"{OLLAMA_BASE_URL}{path}"
    request = urllib.request.Request(url, data=json.dumps(payload).encode() if payload is not None else None, headers={"Content-Type": "application/json"}, method="POST" if payload is not None else "GET")
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def generate(prompt: str, model: str, options: dict) -> tuple[str, dict]:
    response = ollama_json("/api/generate", {"model": model, "prompt": prompt, "stream": False, "options": options})
    return response.get("response", "").strip(), response


def model_metadata(model: str) -> dict:
    metadata = {}
    for endpoint, payload in (("/api/tags", None), ("/api/show", {"name": model})):
        try:
            metadata[endpoint] = ollama_json(endpoint, payload)
        except Exception as exc:
            metadata[endpoint] = {"unavailable": str(exc)}
    return metadata


def prompt_for(experiment: str, article: str, fmt: str | None = None) -> str:
    if experiment == "summarization":
        task = "Summarize this article concisely. Preserve its main event, important entities, and central information. Do not invent facts. Output only the summary."
    elif experiment == "shortening":
        task = "Shorten this article to approximately 50 percent of its original word count while preserving important meaning and factual details. Do not invent facts. Output only the shortened article."
    else:
        task = f"Create one independently understandable {fmt} from this article. Preserve important source information, do not invent facts, and output only that asset."
    return f"{task}\n\nSOURCE ARTICLE:\n{article}"


def load_sample(path: Path, size: int) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    return rows[:size]


def run(size: int, label: str, sample_path: Path = BENCHMARK_SAMPLE) -> dict:
    rows = load_sample(sample_path, size)
    run_id = f"{label}-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}-{uuid.uuid4().hex[:8]}"
    options = {"temperature": 0.2, "num_ctx": 8192}
    output_path = RESULTS / "experiment_results.csv"; output_path.parent.mkdir(parents=True, exist_ok=True)
    fields = ["run_id", "experiment_id", "experiment_type", "article_id", "length_group", "model", "execution_path", "input_text", "input_word_count", "input_char_count", "output_text", "output_word_count", "output_char_count", "compression_ratio", "requested_output_count", "successful_output_count", "processing_time_seconds", "queue_wait_seconds", "total_end_to_end_seconds", "status", "error", "context_window_error", "truncation", "empty_response", "incomplete_generation", "timeout_failure", "timestamp", "prompt_text", "child_formats_json", "child_outputs_json", "model_call_count", "model_execution_time_seconds", "prompt_provenance", "prompt_tokens", "output_tokens", "total_tokens", "prompt_eval_duration_ns", "eval_duration_ns"]
    existing = output_path.exists()
    if existing:
        with output_path.open(encoding="utf-8", newline="") as handle:
            existing_fields = csv.DictReader(handle).fieldnames or []
        if existing_fields != fields:
            raise RuntimeError("Existing experiment_results.csv schema differs; migrate or archive it before starting a new benchmark.")
    else:
        with output_path.open("w", encoding="utf-8", newline="") as handle:
            csv.DictWriter(handle, fieldnames=fields).writeheader()
    monitor = ResourceMonitor(); monitor.start(); results: list[dict] = []
    warmup = None
    if rows:
        try:
            warmup_start = time.perf_counter(); generate("Reply with the single word READY.", OLLAMA_MODEL, options); warmup = time.perf_counter() - warmup_start
        except Exception as exc:
            warmup = {"error": str(exc)}
    for row in rows:
        article = row["cleaned_text"]; article_id = row["article_id"]
        experiments = [("summarization", [None]), ("shortening", [None]), ("atomization_2", ATOMIZATION_FORMATS_2), ("atomization_5", ATOMIZATION_FORMATS_5)]
        for experiment_type, formats in experiments:
            outputs: list[tuple[str, str, dict]] = []; prompts: list[str] = []; start = time.perf_counter(); error = None; status = "success"
            try:
                for fmt in formats:
                    prompt = prompt_for(experiment_type, article, fmt); prompts.append(prompt)
                    output, raw = generate(prompt, OLLAMA_MODEL, options); outputs.append((fmt or "summary", output, raw))
                    if not output: raise ValueError("empty response")
            except (Exception, urllib.error.URLError) as exc:
                error = str(exc); status = "failure"
            elapsed = time.perf_counter() - start; output_text = "\n\n".join(text for _fmt, text, _raw in outputs); requested = len(formats); successful = len([text for _fmt, text, _raw in outputs if text.strip()]); raw_incomplete = any(raw.get("done") is False or raw.get("done_reason") not in (None, "stop", "load") for _fmt, _text, raw in outputs); truncation = any(raw.get("done_reason") in ("length", "max_tokens") for _fmt, _text, raw in outputs); incomplete = raw_incomplete or (experiment_type.startswith("atomization") and successful != requested)
            raw_last = outputs[-1][2] if outputs else {}
            result = {"run_id": run_id, "experiment_id": f"{run_id}-{article_id}-{experiment_type}", "experiment_type": experiment_type, "article_id": article_id, "length_group": row.get("length_group", length_group(int(row["word_count"]))), "model": OLLAMA_MODEL, "execution_path": "direct_ollama_http_not_production_scheduler", "input_text": article, "input_word_count": word_count(article), "input_char_count": len(article), "output_text": output_text, "output_word_count": word_count(output_text), "output_char_count": len(output_text), "compression_ratio": safe_ratio(word_count(output_text), word_count(article)), "requested_output_count": requested if experiment_type.startswith("atomization") else 1, "successful_output_count": successful if experiment_type.startswith("atomization") else (1 if status == "success" else 0), "processing_time_seconds": elapsed, "queue_wait_seconds": 0.0, "total_end_to_end_seconds": elapsed, "status": "failure_incomplete" if incomplete else status, "error": error, "context_window_error": bool(error and "context" in error.lower()), "truncation": truncation, "empty_response": not bool(output_text), "incomplete_generation": incomplete, "timeout_failure": bool(error and "timed out" in error.lower()), "timestamp": datetime.now(timezone.utc).isoformat(), "prompt_text": prompts[0] if len(prompts) == 1 else json.dumps(prompts), "child_formats_json": json.dumps(formats) if experiment_type.startswith("atomization") else "[]", "child_outputs_json": json.dumps([{"format": fmt, "content": text} for fmt, text, _raw in outputs]), "model_call_count": len(prompts), "model_execution_time_seconds": elapsed, "prompt_provenance": "exact_prompt_persisted", "prompt_tokens": sum(raw.get("prompt_eval_count", 0) or 0 for _fmt, _text, raw in outputs), "output_tokens": sum(raw.get("eval_count", 0) or 0 for _fmt, _text, raw in outputs), "total_tokens": sum((raw.get("prompt_eval_count", 0) or 0) + (raw.get("eval_count", 0) or 0) for _fmt, _text, raw in outputs), "prompt_eval_duration_ns": sum(raw.get("prompt_eval_duration", 0) or 0 for _fmt, _text, raw in outputs), "eval_duration_ns": sum(raw.get("eval_duration", 0) or 0 for _fmt, _text, raw in outputs)}
            results.append(result)
            with output_path.open("a", encoding="utf-8", newline="") as handle:
                csv.DictWriter(handle, fieldnames=fields).writerow(result)
            with (RESULTS / "experiment_results.jsonl").open("a", encoding="utf-8") as handle:
                handle.write(json.dumps(result) + "\n")
            monitor.sample(); print(f"{article_id} {experiment_type}: {result['status']} {elapsed:.2f}s")
    resource_summary = monitor.stop(); monitor.write_csv(RESULTS / f"resource_samples_{run_id}.csv")
    metadata = {"run_id": run_id, "sample_ids": [row["article_id"] for row in rows], "sample_size": len(rows), "random_seed": SEED, "model": OLLAMA_MODEL, "ollama_base_url": OLLAMA_BASE_URL, "ollama_model_metadata": model_metadata(OLLAMA_MODEL), "generation_options": options, "prompt_templates": "prompt_for in research/benchmark.py; exact prompt text is stored per result row", "warmup_seconds_excluded": warmup, "resource_summary": resource_summary, "software": {"python": platform.python_version(), "platform": platform.platform()}, "raw_dataset_sha256": hashlib.sha256(RAW_DATASET.read_bytes()).hexdigest(), "cleaned_dataset_sha256": hashlib.sha256(Path("datasets/cleaned_articles.csv").read_bytes()).hexdigest(), "dataset_sha256": hashlib.sha256(Path("datasets/cleaned_articles.csv").read_bytes()).hexdigest()}
    (RESULTS / f"run_{run_id}.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("--sample-size", type=int, default=DEFAULT_SAMPLE_SIZE); parser.add_argument("--run-label", default="benchmark"); args = parser.parse_args(); print(json.dumps(run(args.sample_size, args.run_label), indent=2))

if __name__ == "__main__":
    main()
