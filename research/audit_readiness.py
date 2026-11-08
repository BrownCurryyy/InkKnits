from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from research.benchmark import prompt_for
from research.config import ATOMIZATION_FORMATS_2, ATOMIZATION_FORMATS_5, RESULTS


def migrate_smoke(results_dir: Path = RESULTS, run_prefix: str = "smoke-") -> dict:
    path = results_dir / "experiment_results.csv"
    with path.open(encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
        old_fields = list(rows[0]) if rows else []
    fields = old_fields + [field for field in ["prompt_text", "child_formats_json", "child_outputs_json", "model_call_count", "model_execution_time_seconds", "prompt_provenance", "prompt_tokens", "output_tokens", "total_tokens", "prompt_eval_duration_ns", "eval_duration_ns"] if field not in old_fields]
    for row in rows:
        if not row.get("run_id", "").startswith(run_prefix):
            continue
        formats = {"summarization": [None], "shortening": [None], "atomization_2": ATOMIZATION_FORMATS_2, "atomization_5": ATOMIZATION_FORMATS_5}[row["experiment_type"]]
        prompts = [prompt_for(row["experiment_type"], row["input_text"], fmt) for fmt in formats]
        outputs = [{"format": "legacy_combined_output", "content": row.get("output_text", "")}] if row.get("output_text") else []
        row.update({"prompt_text": prompts[0] if len(prompts) == 1 else json.dumps(prompts), "child_formats_json": json.dumps(formats) if row["experiment_type"].startswith("atomization") else "[]", "child_outputs_json": json.dumps(outputs), "model_call_count": str(len(prompts)), "model_execution_time_seconds": row.get("processing_time_seconds", ""), "prompt_provenance": "reconstructed_from_frozen_prompt_template; legacy smoke run did not persist prompts or child boundaries", "prompt_tokens": "", "output_tokens": "", "total_tokens": "", "prompt_eval_duration_ns": "", "eval_duration_ns": ""})
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
    jsonl_path = results_dir / "experiment_results.jsonl"
    with jsonl_path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row) + "\n")
    metadata_files = list(results_dir.glob(f"run_{run_prefix}*.json"))
    for metadata_path in metadata_files:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        metadata["readiness_audit"] = {"legacy_smoke_prompts_reconstructed": True, "legacy_smoke_child_boundaries_preserved": False, "full_benchmark_not_started": True}
        metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return {"migrated_rows": sum(row.get("run_id", "").startswith(run_prefix) for row in rows), "legacy_child_boundaries": True, "prompt_provenance": "reconstructed_without_new_model_calls"}


def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("--results-dir", type=Path, default=RESULTS); args = parser.parse_args(); print(json.dumps(migrate_smoke(args.results_dir), indent=2))


if __name__ == "__main__":
    main()
