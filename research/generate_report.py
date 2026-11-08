from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path

from research.config import RESULTS
from research.metrics import summarize_numbers


def load_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    csv.field_size_limit(50_000_000)
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def run(results_dir: Path = RESULTS, run_id: str | None = None) -> Path:
    all_rows = load_rows(results_dir / "experiment_results.csv")
    run_ids = sorted({row.get("run_id", "") for row in all_rows})
    selected_run_id = run_id or (run_ids[-1] if run_ids else "unavailable")
    rows = [row for row in all_rows if row.get("run_id") == selected_run_id]
    metadata_files = list(results_dir.glob(f"run_{selected_run_id}.json"))
    metadata = json.loads(metadata_files[0].read_text(encoding="utf-8")) if metadata_files else {}
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row.get("experiment_type", "unknown")].append(row)
    summary = {"run_id": selected_run_id, "total_records": len(rows), "operations": {}}
    for operation, items in grouped.items():
        latencies = [float(item["processing_time_seconds"]) for item in items if item.get("processing_time_seconds")]
        successes = sum(item.get("status") == "success" for item in items)
        summary["operations"][operation] = {
            "count": len(items),
            "success_count": successes,
            "failure_count": len(items) - successes,
            "success_rate": successes / len(items) if items else None,
            "failure_rate": 1 - successes / len(items) if items else None,
            "throughput_completed_per_minute": successes / (sum(latencies) / 60) if sum(latencies) else None,
            "latency_seconds": summarize_numbers(latencies),
            "input_word_count": summarize_numbers(float(item["input_word_count"]) for item in items),
            "output_word_count": summarize_numbers(float(item["output_word_count"]) for item in items),
        }
    (results_dir / "experiment_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    report = [
        "# InkKnits Research Benchmark Report", "", "## Run scope",
        f"This report contains only run `{selected_run_id}`. Smoke and full benchmark rows are never aggregated together.",
        "", "## Dataset and methodology",
        "The source dataset is a single-column collection of article bodies. Cleaning preserved the raw file, assigned stable row IDs, repaired only conservatively reversible mojibake, and retained questionable records with flags. The benchmark uses a fixed stratified sample and fixed random seed recorded in each run metadata file.",
        "", "## Model and execution",
        "The benchmark calls the configured local Ollama endpoint directly. It does not claim to test the production FastAPI scheduler. Queue waiting is recorded as zero because direct HTTP calls have no InkKnits scheduler queue. Warm-up calls are excluded from measured latency. For direct calls, model execution time is the measured HTTP request elapsed time and total end-to-end time is identical.",
        "", "## Results", f"Measured operation rows: {len(rows)}.", "",
        "| Operation | N | Success rate | Mean latency (s) | Median latency (s) |", "|---|---:|---:|---:|---:|",
    ]
    for operation, data in summary["operations"].items():
        latency = data["latency_seconds"]
        if latency["mean"] is None:
            report.append(f"| {operation} | {data['count']} | unavailable | unavailable | unavailable |")
        else:
            report.append(f"| {operation} | {data['count']} | {data['success_rate']:.3f} | {latency['mean']:.3f} | {latency['median']:.3f} |")
    report += [
        "", "## Resources",
        f"This run recorded {metadata.get('resource_summary', {}).get('sample_count', 'unavailable')} real resource samples. GPU utilization mean/max were {metadata.get('resource_summary', {}).get('gpu_utilization_percent_mean', 'unavailable')}%/{metadata.get('resource_summary', {}).get('gpu_utilization_percent_max', 'unavailable')}%, and GPU memory mean/max were {metadata.get('resource_summary', {}).get('gpu_memory_used_bytes_mean', 'unavailable')}/{metadata.get('resource_summary', {}).get('gpu_memory_used_bytes_max', 'unavailable')} bytes. Continuous background interval sampling was used for this full run. Unavailable metrics are left blank/null, never replaced with zero.",
        "", "## Quality and limitations",
        "No ROUGE or BERTScore is reported because verified human reference summaries are unavailable. Non-emptiness, output counts, compression, lexical overlap, and distinctness checks are automated proxies only. The optional human evaluation CSV is a template, not completed ground truth. Results must not be interpreted as superiority over competing products.",
        "", "## Reproducibility",
        "Use the commands in research/README.md. Preserve the run metadata JSON, sample IDs, dataset hash, model metadata, prompts, generation parameters, and environment details with each reported result.",
    ]
    report_path = results_dir / "analysis_report.md"
    report_path.write_text("\n".join(report) + "\n", encoding="utf-8")
    return report_path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--results-dir", type=Path, default=RESULTS)
    parser.add_argument("--run-id", default=None)
    args = parser.parse_args()
    print(run(args.results_dir, args.run_id))


if __name__ == "__main__":
    main()
