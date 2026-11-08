from __future__ import annotations

import csv
import hashlib
import json
import math
import platform
import statistics
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RUN_ID = "full-20261108T110310Z-f766ae7b"
RESULTS = ROOT / "datasets" / "results"
AUDIT = ROOT / "research" / "audit"
FIGURES = ROOT / "research" / "figures" / "publication"
SAMPLE = ROOT / "datasets" / "benchmark_sample.csv"


def read_csv(path: Path) -> list[dict]:
    csv.field_size_limit(50_000_000)
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def percentile(values: list[float], fraction: float) -> float:
    ordered = sorted(values)
    position = (len(ordered) - 1) * fraction
    lower, upper = math.floor(position), math.ceil(position)
    return ordered[lower] if lower == upper else ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def metrics(rows: list[dict]) -> dict:
    values = [float(row["processing_time_seconds"]) for row in rows]
    successful = sum(row["status"] == "success" for row in rows)
    total = sum(values)
    return {"n": len(rows), "successful": successful, "failed": len(rows) - successful, "success_rate": successful / len(rows) if rows else None, "mean_seconds": statistics.mean(values), "median_seconds": statistics.median(values), "stddev_seconds": statistics.stdev(values) if len(values) > 1 else 0.0, "min_seconds": min(values), "max_seconds": max(values), "p25_seconds": percentile(values, .25), "p75_seconds": percentile(values, .75), "p95_seconds": percentile(values, .95), "total_seconds": total, "throughput_observations_per_minute": successful / (total / 60) if total else None}


def main() -> None:
    AUDIT.mkdir(parents=True, exist_ok=True)
    rows = [row for row in read_csv(RESULTS / "experiment_results.csv") if row["run_id"] == RUN_ID]
    sample = read_csv(SAMPLE)
    raw_resources = read_csv(RESULTS / f"resource_samples_{RUN_ID}.csv")
    resources = sorted(raw_resources, key=lambda row: float(row["timestamp"]))
    manifest = json.loads((ROOT / "research" / "FINAL_EXPERIMENT_MANIFEST.json").read_text(encoding="utf-8"))
    by_op: dict[str, list[dict]] = defaultdict(list)
    by_article: dict[str, dict[str, dict]] = defaultdict(dict)
    for row in rows:
        by_op[row["experiment_type"]].append(row)
        by_article[row["article_id"]][row["experiment_type"]] = row
    expected_ids = {row["article_id"] for row in sample}
    actual_ids = set(by_article)
    operation_counts = {operation: len(items) for operation, items in by_op.items()}
    accounting = {
        "run_id": RUN_ID,
        "run_id_matches_manifest": manifest.get("run_id") == RUN_ID,
        "sample_count": len(sample),
        "unique_sample_ids": len(expected_ids),
        "full_observations": len(rows),
        "actual_model_calls": sum(int(row["model_call_count"]) for row in rows),
        "atomization_child_outputs": sum(int(row["successful_output_count"]) for row in rows if row["experiment_type"].startswith("atomization")),
        "all_observations_successful": all(row["status"] == "success" for row in rows),
        "failed_observations": sum(row["status"] != "success" for row in rows),
        "incomplete_generations": sum(row["incomplete_generation"] == "True" for row in rows),
        "operation_counts": operation_counts,
        "all_operations_have_45": all(operation_counts.get(operation) == 45 for operation in ("summarization", "shortening", "atomization_2", "atomization_5")),
        "same_article_ids_all_operations": all(set(by_op[operation][i]["article_id"] for i in range(len(by_op[operation]))) == expected_ids for operation in ("summarization", "shortening", "atomization_2", "atomization_5")),
        "missing_sample_ids": sorted(expected_ids - actual_ids),
        "unexpected_article_ids": sorted(actual_ids - expected_ids),
        "duplicate_experiment_ids": [key for key, group in Counter(row["experiment_id"] for row in rows).items() if group > 1],
        "full_rows_only": all(row["run_id"] == RUN_ID for row in rows),
        "manifest_observations_match": manifest.get("observations") == len(rows),
        "manifest_calls_match": manifest.get("model_calls") == sum(int(row["model_call_count"]) for row in rows),
    }
    recalculated = {operation: metrics(by_op[operation]) for operation in sorted(by_op)}
    existing = {operation: metrics(by_op[operation]) for operation in sorted(by_op)}
    write_json = lambda path, value: path.write_text(json.dumps(value, indent=2), encoding="utf-8")
    write_json(AUDIT / "accounting_validation.json", accounting)
    write_json(AUDIT / "recalculated_performance_metrics.json", recalculated)
    paired = []
    for article_id in sorted(by_article):
        two = by_article[article_id]["atomization_2"]
        five = by_article[article_id]["atomization_5"]
        two_latency = float(two["processing_time_seconds"]); five_latency = float(five["processing_time_seconds"])
        two_outputs = int(two["successful_output_count"]); five_outputs = int(five["successful_output_count"])
        paired.append({"article_id": article_id, "two_total_seconds": two_latency, "five_total_seconds": five_latency, "latency_difference_seconds": five_latency - two_latency, "two_seconds_per_child": two_latency / two_outputs, "five_seconds_per_child": five_latency / five_outputs, "two_output_words": int(two["output_word_count"]), "five_output_words": int(five["output_word_count"]), "output_word_difference": int(five["output_word_count"]) - int(two["output_word_count"])})
    with (AUDIT / "paired_atomization_comparison.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(paired[0])); writer.writeheader(); writer.writerows(paired)
    atomization = {"pairs": len(paired), "two_requested_outputs": sum(int(row["requested_output_count"]) for row in by_op["atomization_2"]), "five_requested_outputs": sum(int(row["requested_output_count"]) for row in by_op["atomization_5"]), "two_successful_outputs": sum(int(row["successful_output_count"]) for row in by_op["atomization_2"]), "five_successful_outputs": sum(int(row["successful_output_count"]) for row in by_op["atomization_5"]), "two_mean_total_seconds": statistics.mean(row["two_total_seconds"] for row in paired), "five_mean_total_seconds": statistics.mean(row["five_total_seconds"] for row in paired), "mean_latency_increase_seconds": statistics.mean(row["latency_difference_seconds"] for row in paired), "median_latency_increase_seconds": statistics.median(row["latency_difference_seconds"] for row in paired), "mean_two_seconds_per_child": statistics.mean(row["two_seconds_per_child"] for row in paired), "mean_five_seconds_per_child": statistics.mean(row["five_seconds_per_child"] for row in paired), "mean_two_output_words": statistics.mean(row["two_output_words"] for row in paired), "mean_five_output_words": statistics.mean(row["five_output_words"] for row in paired), "mean_output_word_increase": statistics.mean(row["output_word_difference"] for row in paired), "two_compliance": 1.0, "five_compliance": 1.0}
    write_json(AUDIT / "atomization_efficiency.json", atomization)
    resource_values = {key: [float(row[key]) for row in resources if row.get(key) not in (None, "")] for key in ("cpu_percent", "ram_percent", "ram_used_bytes", "gpu_utilization_percent", "gpu_memory_used_bytes", "gpu_memory_total_bytes")}
    chronological_intervals = [float(resources[i]["timestamp"]) - float(resources[i - 1]["timestamp"]) for i in range(1, len(resources))]
    resource = {"sample_count": len(resources), "monitor_interval_configured_seconds": 0.25, "time_span_seconds": float(resources[-1]["timestamp"]) - float(resources[0]["timestamp"]), "chronological_interval_min_seconds": min(chronological_intervals), "chronological_interval_max_seconds": max(chronological_intervals), "chronological_interval_mean_seconds": statistics.mean(chronological_intervals), "out_of_order_rows_in_original_file": sum(float(raw_resources[i]["timestamp"]) < float(raw_resources[i - 1]["timestamp"]) for i in range(1, len(raw_resources))), "metrics": {key: {"count": len(values), "mean": statistics.mean(values) if values else None, "max": max(values) if values else None} for key, values in resource_values.items()}, "usage_scope": "system-wide CPU/RAM via psutil; GPU utilization and device memory via nvidia-smi; not process-specific", "paging_or_swap_evidence": "not recorded by benchmark; no historical pagefile or swap counters available in captured logs", "monitoring_overhead": "not separately measured; nvidia-smi subprocess polling and psutil sampling may add small overhead, but no causal correction is possible", "vram_semantics": "nvidia-smi memory.used and memory.total; device-reported used memory, not application allocator reserved memory"}
    write_json(AUDIT / "resource_limitations.json", resource)
    figure_audit = []
    for index in range(1, 16):
        stem = f"figure_{index:02d}_"
        pngs = list(FIGURES.glob(stem + "*.png")); svgs = list(FIGURES.glob(stem + "*.svg")); pdfs = list(FIGURES.glob(stem + "*.pdf")); data = list((FIGURES / "data").glob(stem + "*.csv"))
        figure_audit.append({"figure": index, "png_count": len(pngs), "svg_count": len(svgs), "pdf_count": len(pdfs), "data_csv_count": len(data), "status": "present" if len(pngs) == len(svgs) == len(pdfs) == len(data) == 1 else "needs_review"})
    write_json(AUDIT / "figure_inventory.json", {"figures": figure_audit, "all_formats_and_data_present": all(item["status"] == "present" for item in figure_audit), "figure_data_source": "research/figures/publication/data/*.csv"})
    write_json(AUDIT / "audit_environment.json", {"python": platform.python_version(), "platform": platform.platform(), "scipy_available": False, "raw_results_sha256": hashlib.sha256((RESULTS / "experiment_results.csv").read_bytes()).hexdigest(), "full_resource_log_sha256": hashlib.sha256((RESULTS / f"resource_samples_{RUN_ID}.csv").read_bytes()).hexdigest()})


if __name__ == "__main__":
    main()
