from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import platform
import random
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import matplotlib.pyplot as plt

from research.config import BENCHMARK_SAMPLE, CLEANED_DATASET, RESULTS, SEED
from research.metrics import safe_ratio, summarize_numbers
from research.text_utils import length_group, word_count

RUN_ID = "full-20261108T110310Z-f766ae7b"
FULL_RESULTS = RESULTS / "experiment_results.csv"
FIGURES = Path("research/figures/publication")
FIGURE_DATA = FIGURES / "data"
TABLES = Path("research/tables")
REPORTS = Path("research/reports")


def read_csv(path: Path) -> list[dict]:
    csv.field_size_limit(50_000_000)
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def bootstrap(values: list[float], seed: int = SEED, iterations: int = 5000) -> tuple[float | None, float | None]:
    if not values:
        return None, None
    rng = random.Random(seed)
    estimates = [statistics.mean(rng.choices(values, k=len(values))) for _ in range(iterations)]
    estimates.sort()
    return estimates[int(iterations * .025)], estimates[int(iterations * .975)]


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = list(rows[0]) if rows else ["metric"]
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader(); writer.writerows(rows)


def stat_row(operation: str, rows: list[dict]) -> dict:
    latencies = [float(row["processing_time_seconds"]) for row in rows]
    success = [row for row in rows if row["status"] == "success"]
    ci_low, ci_high = bootstrap(latencies)
    total = sum(latencies)
    return {"operation": operation, "observations": len(rows), "successful_observations": len(success), "failed_observations": len(rows) - len(success), "success_rate": safe_ratio(len(success), len(rows)), "mean_latency_seconds": statistics.mean(latencies), "median_latency_seconds": statistics.median(latencies), "stddev_latency_seconds": statistics.stdev(latencies) if len(latencies) > 1 else 0.0, "min_latency_seconds": min(latencies), "max_latency_seconds": max(latencies), "p25_latency_seconds": statistics.quantiles(latencies, n=4, method="inclusive")[0], "p75_latency_seconds": statistics.quantiles(latencies, n=4, method="inclusive")[2], "p95_latency_seconds": statistics.quantiles(latencies, n=20, method="inclusive")[18], "latency_bootstrap_95ci_low": ci_low, "latency_bootstrap_95ci_high": ci_high, "total_processing_seconds": total, "throughput_completed_per_minute": safe_ratio(len(success), total / 60), "input_words_mean": statistics.mean(float(row["input_word_count"]) for row in rows), "output_words_mean": statistics.mean(float(row["output_word_count"]) for row in rows), "compression_ratio_mean": statistics.mean(float(row["compression_ratio"]) for row in rows if row["compression_ratio"]), "requested_outputs": sum(int(row["requested_output_count"]) for row in rows), "successful_outputs": sum(int(row["successful_output_count"]) for row in rows), "model_calls": sum(int(row["model_call_count"]) for row in rows)}


def quality_rows(rows: list[dict]) -> list[dict]:
    result = []
    for row in rows:
        source = set(token.lower() for token in row["input_text"].split() if len(token) > 3)
        output = set(token.lower() for token in row["output_text"].split() if len(token) > 3)
        overlap = len(source & output) / len(source) if source else None
        result.append({"run_id": row["run_id"], "experiment_type": row["experiment_type"], "article_id": row["article_id"], "output_nonempty": bool(row["output_text"].strip()), "source_lexical_overlap": overlap, "requested_output_count": row["requested_output_count"], "successful_output_count": row["successful_output_count"], "output_count_compliant": row["requested_output_count"] == row["successful_output_count"], "output_word_count": row["output_word_count"], "compression_ratio": row["compression_ratio"]})
    return result


def plot_save(name: str, data_rows: list[dict], draw) -> None:
    path = FIGURES / name
    figure = plt.figure(figsize=(7.2, 4.5)); draw(figure); figure.tight_layout(); figure.savefig(path.with_suffix(".png"), dpi=300, bbox_inches="tight"); figure.savefig(path.with_suffix(".svg"), bbox_inches="tight"); figure.savefig(path.with_suffix(".pdf"), bbox_inches="tight"); plt.close(figure); write_csv(FIGURE_DATA / f"{name}.csv", data_rows)


def generate(run_id: str = RUN_ID) -> dict:
    rows = [row for row in read_csv(FULL_RESULTS) if row["run_id"] == run_id]
    by_op = defaultdict(list)
    for row in rows: by_op[row["experiment_type"]].append(row)
    for directory in (FIGURES, FIGURE_DATA, TABLES, REPORTS): directory.mkdir(parents=True, exist_ok=True)
    plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.titlesize": 11, "axes.labelsize": 9, "figure.dpi": 150, "savefig.dpi": 300, "axes.spines.top": False, "axes.spines.right": False})
    colors = {"summarization": "#355C7D", "shortening": "#6C8EAD", "atomization_2": "#C06C84", "atomization_5": "#F67280"}
    order = ["summarization", "shortening", "atomization_2", "atomization_5"]
    stats = [stat_row(op, by_op[op]) for op in order]
    write_csv(TABLES / "performance_metrics.csv", stats)
    quality = quality_rows(rows); write_csv(TABLES / "quality_proxy_metrics.csv", quality)
    dataset = read_csv(CLEANED_DATASET); sample = read_csv(BENCHMARK_SAMPLE); resources = read_csv(RESULTS / f"resource_samples_{run_id}.csv")
    write_csv(TABLES / "resource_samples.csv", resources)
    words = [int(row["word_count"]) for row in dataset]
    groups = Counter(length_group(value) for value in words)
    quality_counts = Counter("valid and unique" if row["quality_status"] == "valid" and row["duplicate_indicator"] == "unique" else "questionable duplicate" if row["duplicate_indicator"] == "duplicate" else "invalid or empty" for row in dataset)
    write_csv(TABLES / "dataset_statistics.csv", [{"metric": key, "value": value} for key, value in {"records": len(dataset), "valid_unique": quality_counts["valid and unique"], "questionable_duplicates": quality_counts["questionable duplicate"], "short": groups["short"], "medium": groups["medium"], "long": groups["long"], "very_long": groups["very_long"], "mean_words": statistics.mean(words), "median_words": statistics.median(words), "p95_words": statistics.quantiles(words, n=20, method="inclusive")[18]}.items()])
    plot_save("figure_01_dataset_word_distribution", [{"word_count": value} for value in words], lambda fig: (lambda ax: (ax.hist(words, bins=40, color="#355C7D"), ax.set(title=f"Dataset word-count distribution (N={len(words)})", xlabel="Words per article", ylabel="Articles")))(fig.add_subplot(111)))
    group_rows = [{"category": key, "count": groups[key], "percentage": groups[key] / len(words) * 100} for key in ["short", "medium", "long", "very_long"]]
    plot_save("figure_02_length_categories", group_rows, lambda fig: (lambda ax: (ax.bar([r["category"] for r in group_rows], [r["count"] for r in group_rows], color="#6C8EAD"), ax.set(title=f"Dataset length categories (N={len(words)})", xlabel="Word-count category", ylabel="Articles"), [ax.text(i, r["count"], f"{r['count']} ({r['percentage']:.1f}%)", ha="center", va="bottom") for i, r in enumerate(group_rows)]))(fig.add_subplot(111)))
    quality_rows_data = [{"category": key, "count": quality_counts[key]} for key in ["valid and unique", "questionable duplicate", "invalid or empty"]]
    plot_save("figure_03_quality_breakdown", quality_rows_data, lambda fig: (lambda ax: (ax.bar([r["category"] for r in quality_rows_data], [r["count"] for r in quality_rows_data], color="#355C7D"), ax.set(title=f"Dataset quality breakdown (N={len(dataset)})", ylabel="Records"), ax.tick_params(axis="x", rotation=15), [ax.text(i, r["count"], str(r["count"]), ha="center", va="bottom") for i, r in enumerate(quality_rows_data)]))(fig.add_subplot(111)))
    latency_rows = [{"operation": op, "mean": next(r["mean_latency_seconds"] for r in stats if r["operation"] == op), "median": next(r["median_latency_seconds"] for r in stats if r["operation"] == op)} for op in order]
    plot_save("figure_04_latency_comparison", latency_rows, lambda fig: (lambda ax: (ax.bar([r["operation"] for r in latency_rows], [r["mean"] for r in latency_rows], color="#355C7D", label="Mean"), ax.scatter([r["operation"] for r in latency_rows], [r["median"] for r in latency_rows], color="#F67280", zorder=3, label="Median"), ax.set(title="Latency comparison by operation", ylabel="Seconds per observation"), ax.legend(), ax.tick_params(axis="x", rotation=20)))(fig.add_subplot(111)))
    plot_save("figure_05_latency_distribution", [{"operation": op, "latency_seconds": float(row["processing_time_seconds"])} for op in order for row in by_op[op]], lambda fig: (lambda ax: (ax.boxplot([[float(row["processing_time_seconds"]) for row in by_op[op]] for op in order], tick_labels=order, showfliers=True), ax.set(title="Latency distributions by operation", ylabel="Seconds per observation"), ax.tick_params(axis="x", rotation=20)))(fig.add_subplot(111)))
    atom_rows = []
    for op in ["atomization_2", "atomization_5"]:
        for row in by_op[op]: atom_rows.append({"operation": op, "total_seconds": float(row["processing_time_seconds"]), "seconds_per_output": safe_ratio(float(row["processing_time_seconds"]), int(row["successful_output_count"])), "output_words": int(row["output_word_count"]), "success_rate": int(row["successful_output_count"]) / int(row["requested_output_count"])})
    def draw_atomization(fig):
        axis = fig.add_subplot(111)
        axis.boxplot([[row["total_seconds"] for row in atom_rows if row["operation"] == operation] for operation in ["atomization_2", "atomization_5"]], tick_labels=["2 outputs", "5 outputs"])
        axis.set(title="Atomization processing time", ylabel="Total seconds per source article")
    atom_summary = [{"operation": operation, "total_seconds_mean": statistics.mean(row["total_seconds"] for row in atom_rows if row["operation"] == operation), "seconds_per_output_mean": statistics.mean(row["seconds_per_output"] for row in atom_rows if row["operation"] == operation), "output_words_mean": statistics.mean(row["output_words"] for row in atom_rows if row["operation"] == operation), "success_rate": statistics.mean(row["success_rate"] for row in atom_rows if row["operation"] == operation)} for operation in ["atomization_2", "atomization_5"]]
    def draw_atomization_summary(fig):
        axis = fig.add_subplot(111)
        positions = [0, 1]
        axis.bar([position - .18 for position in positions], [row["total_seconds_mean"] for row in atom_summary], width=.18, label="Total seconds")
        axis.bar(positions, [row["seconds_per_output_mean"] for row in atom_summary], width=.18, label="Seconds per output")
        axis.set(title="Atomization workload comparison", ylabel="Mean seconds", xticks=positions, xticklabels=["2 outputs", "5 outputs"]); axis.legend()
    plot_save("figure_06_atomization_comparison", atom_summary, draw_atomization_summary)
    resource_rows = [{**row, "elapsed_seconds": float(row["timestamp"]) - float(resources[0]["timestamp"])} for row in resources]
    def draw_gpu(fig):
        axis = fig.add_subplot(111); axis.plot([r["elapsed_seconds"] for r in resource_rows], [float(r["gpu_utilization_percent"]) for r in resource_rows], color="#C06C84", alpha=.18, linewidth=.5); axis.plot([r["elapsed_seconds"] for r in resource_rows], [statistics.mean(float(item["gpu_utilization_percent"]) for item in resource_rows[max(0, i - 49):i + 1]) for i in range(len(resource_rows))], color="#355C7D", linewidth=1.5, label="50-sample rolling mean"); axis.set(title="GPU utilization across full benchmark", xlabel="Elapsed seconds", ylabel="GPU utilization (%)"); axis.legend()
    plot_save("figure_07_gpu_utilization", resource_rows, draw_gpu)
    plot_save("figure_08_vram_utilization", resource_rows, lambda fig: (lambda ax: (ax.plot([r["elapsed_seconds"] for r in resource_rows], [float(r["gpu_memory_used_bytes"]) / 1024 ** 3 for r in resource_rows], color="#F67280"), ax.set(title="VRAM usage across full benchmark", xlabel="Elapsed seconds", ylabel="VRAM used (GiB)")))(fig.add_subplot(111)))
    plot_save("figure_09_cpu_ram", resource_rows, lambda fig: (lambda ax: (ax.plot([r["elapsed_seconds"] for r in resource_rows], [float(r["cpu_percent"]) for r in resource_rows], label="CPU (%)"), ax.plot([r["elapsed_seconds"] for r in resource_rows], [float(r["ram_percent"]) for r in resource_rows], label="RAM (%)"), ax.set(title="CPU and RAM utilization", xlabel="Elapsed seconds", ylabel="Utilization (%)"), ax.legend()))(fig.add_subplot(111)))
    scatter_rows = [{"operation": row["experiment_type"], "input_words": int(row["input_word_count"]), "latency_seconds": float(row["processing_time_seconds"])} for row in rows]
    plot_save("figure_10_input_latency", scatter_rows, lambda fig: (lambda ax: ([ax.scatter([r["input_words"] for r in scatter_rows if r["operation"] == op], [r["latency_seconds"] for r in scatter_rows if r["operation"] == op], label=op, color=colors[op]) for op in order], ax.set(title="Input length versus processing latency", xlabel="Input words", ylabel="Seconds per observation"), ax.legend()))(fig.add_subplot(111)))
    output_rows = [{"operation": row["experiment_type"], "input_words": int(row["input_word_count"]), "output_words": int(row["output_word_count"])} for row in rows]
    plot_save("figure_11_input_output_length", output_rows, lambda fig: (lambda ax: ([ax.scatter([r["input_words"] for r in output_rows if r["operation"] == op], [r["output_words"] for r in output_rows if r["operation"] == op], label=op, color=colors[op]) for op in order], ax.set(title="Input length versus output length", xlabel="Input words", ylabel="Output words"), ax.legend()))(fig.add_subplot(111)))
    compression_rows = [{"operation": row["experiment_type"], "compression_ratio": float(row["compression_ratio"])} for row in rows if row["experiment_type"] in ["summarization", "shortening"]]
    def draw_compression(fig):
        axis = fig.add_subplot(111)
        axis.boxplot([[row["compression_ratio"] for row in compression_rows if row["operation"] == operation] for operation in ["summarization", "shortening"]], tick_labels=["Summarization", "Shortening"])
        axis.set(title="Compression ratio comparison", ylabel="Output words / input words")
    plot_save("figure_12_compression_ratio", compression_rows, draw_compression)
    compliance = [{"operation": op, "compliance_percentage": statistics.mean(int(row["successful_output_count"]) == int(row["requested_output_count"]) for row in by_op[op]) * 100} for op in ["atomization_2", "atomization_5"]]
    plot_save("figure_13_output_count_compliance", compliance, lambda fig: (lambda ax: (ax.bar([r["operation"] for r in compliance], [r["compliance_percentage"] for r in compliance], color="#C06C84"), ax.set(title="Atomization output-count compliance", ylabel="Complete requests (%)", ylim=(0, 100))))(fig.add_subplot(111)))
    throughput = [{"operation": row["operation"], "throughput_completed_per_minute": row["throughput_completed_per_minute"]} for row in stats]
    plot_save("figure_14_throughput", throughput, lambda fig: (lambda ax: (ax.bar([r["operation"] for r in throughput], [r["throughput_completed_per_minute"] for r in throughput], color="#6C8EAD"), ax.set(title="Throughput by operation", ylabel="Completed observations per minute"), ax.tick_params(axis="x", rotation=20)))(fig.add_subplot(111)))
    proxy = [{"operation": op, "mean_lexical_overlap": statistics.mean(float(r["source_lexical_overlap"]) for r in quality if r["experiment_type"] == op)} for op in order]
    plot_save("figure_15_quality_proxies", proxy, lambda fig: (lambda ax: (ax.bar([r["operation"] for r in proxy], [r["mean_lexical_overlap"] for r in proxy], color="#355C7D"), ax.set(title="Lexical-retention proxy", ylabel="Mean source token overlap"), ax.tick_params(axis="x", rotation=20)))(fig.add_subplot(111)))
    paired = []
    by_article = {op: {row["article_id"]: row for row in by_op[op]} for op in order}
    for left, right in [("atomization_5", "atomization_2"), ("shortening", "summarization")]:
        differences = [float(by_article[left][aid]["processing_time_seconds"]) - float(by_article[right][aid]["processing_time_seconds"]) for aid in by_article[left]]
        low, high = bootstrap(differences)
        paired.append({"comparison": f"{left} - {right}", "n_pairs": len(differences), "mean_difference_seconds": statistics.mean(differences), "median_difference_seconds": statistics.median(differences), "bootstrap_95ci_low": low, "bootstrap_95ci_high": high, "wilcoxon_p_value": "unavailable: scipy not installed"})
    write_csv(TABLES / "statistical_comparisons.csv", paired)
    prompt_hash = hashlib.sha256("\n".join(sorted(set(row["prompt_text"] for row in rows))).encode()).hexdigest()
    script_hash = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
    metadata = json.loads((RESULTS / f"run_{run_id}.json").read_text(encoding="utf-8"))
    manifest = {"run_id": run_id, "generated_at": datetime.now(timezone.utc).isoformat(), "start_timestamp_utc": datetime.fromtimestamp(float(resources[0]["timestamp"]), timezone.utc).isoformat(), "end_timestamp_utc": datetime.fromtimestamp(float(resources[-1]["timestamp"]), timezone.utc).isoformat(), "duration_seconds": float(resources[-1]["timestamp"]) - float(resources[0]["timestamp"]), "dataset_hash": hashlib.sha256(CLEANED_DATASET.read_bytes()).hexdigest(), "raw_dataset_hash": metadata.get("raw_dataset_sha256"), "sample_hash": hashlib.sha256(BENCHMARK_SAMPLE.read_bytes()).hexdigest(), "sample_ids": [row["article_id"] for row in sample], "model": "gemma2:2b", "model_metadata": metadata.get("ollama_model_metadata"), "generation_parameters": {"temperature": 0.2, "num_ctx": 8192}, "prompt_template_hash": prompt_hash, "analysis_script_sha256": script_hash, "observations": len(rows), "model_calls": sum(int(row["model_call_count"]) for row in rows), "successful_observations": sum(row["status"] == "success" for row in rows), "failed_observations": sum(row["status"] != "success" for row in rows), "atomization_outputs": sum(int(row["successful_output_count"]) for row in rows if row["experiment_type"].startswith("atomization")), "resource_samples": len(resources), "resource_monitor_interval_seconds": 0.25, "figures": sorted(str(path) for path in FIGURES.glob("figure_*.*") if path.suffix in {".png", ".svg", ".pdf"}), "tables": sorted(str(path) for path in TABLES.glob("*.csv")), "output_references": ["datasets/results/experiment_results.csv", "datasets/results/experiment_results.jsonl", f"datasets/results/resource_samples_{run_id}.csv"], "limitations": ["direct Ollama calls bypass the production scheduler", "no verified human reference summaries", "single model and local hardware", "formal Wilcoxon tests unavailable because scipy is not installed"]}
    Path("research/FINAL_EXPERIMENT_MANIFEST.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return {"run_id": run_id, "observations": len(rows), "model_calls": manifest["model_calls"], "figures": len(list(FIGURES.glob("figure_*.png"))), "resource_samples": len(resources)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--run-id", default=RUN_ID); args = parser.parse_args(); print(json.dumps(generate(args.run_id), indent=2))
