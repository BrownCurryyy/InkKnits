from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
RESULTS = ROOT / "datasets" / "results"

def read(path: Path) -> list[dict]:
    csv.field_size_limit(50_000_000)
    if not path.exists(): return []
    with path.open(encoding="utf-8", newline="") as handle: return list(csv.DictReader(handle))

def run(run_id: str) -> dict:
    rows = [row for row in read(RESULTS / "image_experiment_results.csv") if row.get("run_id") == run_id and row.get("record_type") == "measured"]
    requested = [row for row in read(RESULTS / "image_generation_prompts.csv") if row.get("run_id") == run_id]
    seen = [row["article_id"] for row in rows]; successes = [row for row in rows if row["status"] == "success"]; integrity = []
    for row in successes:
        path = ROOT / row["output_path"]
        item = {"article_id": row["article_id"], "exists": path.exists(), "nonempty": path.exists() and path.stat().st_size > 0, "readable": False, "dimensions_match": False}
        if path.exists():
            try:
                with Image.open(path) as image: item.update({"readable": True, "dimensions_match": image.size == (int(row["width"]), int(row["height"]))})
            except Exception as exc: item["error"] = str(exc)
        integrity.append(item)
    audit = {"run_id": run_id, "request_rows": len(rows), "prompt_rows": len(requested), "unique_article_ids": len(set(seen)), "duplicate_article_ids": sorted({article for article in seen if seen.count(article) > 1}), "successes": len(successes), "failures": len(rows) - len(successes), "all_success_outputs_valid": bool(successes) and all(item["exists"] and item["nonempty"] and item["readable"] and item["dimensions_match"] for item in integrity), "warmup_excluded": all(row.get("record_type") == "measured" for row in rows), "resource_log_exists": (RESULTS / "image_resource_samples.csv").exists(), "queue_wait_available": False, "notes": ["ComfyUI queue timestamps are unavailable from the exercised API path; queue wait remains null.", "Prior blocked smoke records remain separate from this run."]}
    (ROOT / "research" / "image_audit_report.json").write_text(json.dumps(audit, indent=2), encoding="utf-8")
    return audit

if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--run-id", required=True); args = parser.parse_args(); print(json.dumps(run(args.run_id), indent=2))
