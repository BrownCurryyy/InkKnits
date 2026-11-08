from __future__ import annotations

import argparse
import csv
import json
import math
import statistics
from pathlib import Path

import matplotlib.pyplot as plt

from research.config import RESULTS

ROOT = Path(__file__).resolve().parents[1]
FIGURES = ROOT / "research" / "figures" / "image_generation"
DATA = FIGURES / "data"

def read_csv(path: Path) -> list[dict]:
    csv.field_size_limit(50_000_000)
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def rows_for(run_id: str) -> list[dict]:
    csv.field_size_limit(50_000_000)
    path = RESULTS / "image_experiment_results.csv"
    if not path.exists(): return []
    with path.open(encoding="utf-8", newline="") as handle:
        return [row for row in csv.DictReader(handle) if row.get("run_id") == run_id and row.get("record_type") == "measured"]


def summarize(values: list[float]) -> dict:
    if not values: return {"n": 0, "mean": None, "median": None, "stddev": None, "min": None, "max": None, "p25": None, "p75": None, "p95": None}
    ordered = sorted(values)
    q = lambda fraction: ordered[min(len(ordered) - 1, math.floor((len(ordered) - 1) * fraction))]
    return {"n": len(values), "mean": statistics.mean(values), "median": statistics.median(values), "stddev": statistics.stdev(values) if len(values) > 1 else 0.0, "min": min(values), "max": max(values), "p25": q(.25), "p75": q(.75), "p95": q(.95)}


def save_figure(name: str, data: list[dict], draw) -> None:
    FIGURES.mkdir(parents=True, exist_ok=True); DATA.mkdir(parents=True, exist_ok=True)
    figure = plt.figure(figsize=(7.2, 4.5)); draw(figure); figure.tight_layout(); figure.savefig(FIGURES / f"{name}.png", dpi=300); figure.savefig(FIGURES / f"{name}.svg"); figure.savefig(FIGURES / f"{name}.pdf"); plt.close(figure)
    fields = list(data[0]) if data else ["status"]
    with (DATA / f"{name}.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader(); writer.writerows(data)


def run(run_id: str) -> dict:
    rows = rows_for(run_id); successes = [row for row in rows if row["status"] == "success"]; failures = [row for row in rows if row["status"] != "success"]
    generation = [float(row["generation_seconds"]) for row in successes if row.get("generation_seconds")]; total = [float(row["total_elapsed_seconds"]) for row in successes if row.get("total_elapsed_seconds")]; sizes = [int(row["file_size_bytes"]) for row in successes if row.get("file_size_bytes")]
    summary = {"run_id": run_id, "requests": len(rows), "successes": len(successes), "failures": len(failures), "success_rate": len(successes) / len(rows) if rows else None, "generation_latency": summarize(generation), "end_to_end_latency": summarize(total), "queue_wait": {"available": False, "reason": "ComfyUI history API did not expose queue timestamps"}, "throughput_completed_images_per_minute": len(successes) / (sum(total) / 60) if total else None, "file_size_bytes": summarize([float(value) for value in sizes]), "dimensions": sorted({f"{row['width']}x{row['height']}" for row in successes}), "quality_evaluation": "pending human evaluation; no reference images or fabricated FID/CLIP scores"}
    (RESULTS / "image_experiment_summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    if successes:
        save_figure("image_latency_distribution", [{"generation_seconds": value} for value in generation], lambda fig: (lambda ax: (ax.hist(generation, bins=min(15, len(generation))), ax.set(title="Image-generation latency distribution", xlabel="Generation seconds", ylabel="Images")))(fig.add_subplot(111)))
        save_figure("image_latency_per_article", [{"article_id": row["article_id"], "generation_seconds": row["generation_seconds"]} for row in successes], lambda fig: (lambda ax: (ax.bar([row["article_id"] for row in successes], generation), ax.set(title="Image-generation latency per article", xlabel="Article ID", ylabel="Generation seconds"), ax.tick_params(axis="x", labelrotation=90)))(fig.add_subplot(111)))
        save_figure("image_file_sizes", [{"article_id": row["article_id"], "file_size_bytes": row["file_size_bytes"]} for row in successes], lambda fig: (lambda ax: (ax.hist(sizes, bins=min(15, len(sizes))), ax.set(title="Generated image file sizes", xlabel="File size (bytes)", ylabel="Images")))(fig.add_subplot(111)))
    resource_path = RESULTS / "image_resource_samples.csv"
    if resource_path.exists():
        resource_rows = sorted(read_csv(resource_path), key=lambda row: float(row["timestamp"]))
        elapsed = [float(row["timestamp"]) - float(resource_rows[0]["timestamp"]) for row in resource_rows]
        save_figure("image_gpu_utilization", [{"elapsed_seconds": elapsed[i], "gpu_utilization_percent": row["gpu_utilization_percent"]} for i, row in enumerate(resource_rows)], lambda fig: (lambda ax: (ax.plot(elapsed, [float(row["gpu_utilization_percent"]) for row in resource_rows], color="#C06C84"), ax.set(title="Image benchmark GPU utilization", xlabel="Elapsed seconds", ylabel="GPU utilization (%)")))(fig.add_subplot(111)))
        save_figure("image_vram_utilization", [{"elapsed_seconds": elapsed[i], "vram_gib": float(row["gpu_memory_used_bytes"]) / 1024 ** 3} for i, row in enumerate(resource_rows)], lambda fig: (lambda ax: (ax.plot(elapsed, [float(row["gpu_memory_used_bytes"]) / 1024 ** 3 for row in resource_rows], color="#F67280"), ax.set(title="Image benchmark VRAM usage", xlabel="Elapsed seconds", ylabel="VRAM used (GiB)")))(fig.add_subplot(111)))
        save_figure("image_cpu_ram_utilization", [{"elapsed_seconds": elapsed[i], "cpu_percent": row["cpu_percent"], "ram_percent": row["ram_percent"]} for i, row in enumerate(resource_rows)], lambda fig: (lambda ax: (ax.plot(elapsed, [float(row["cpu_percent"]) for row in resource_rows], label="CPU (%)"), ax.plot(elapsed, [float(row["ram_percent"]) for row in resource_rows], label="RAM (%)"), ax.set(title="Image benchmark CPU and RAM", xlabel="Elapsed seconds", ylabel="Utilization (%)"), ax.legend()))(fig.add_subplot(111)))
        save_figure("image_temperature_power", [{"elapsed_seconds": elapsed[i], "temperature_celsius": row["gpu_temperature_celsius"], "power_watts": row["gpu_power_watts"]} for i, row in enumerate(resource_rows)], lambda fig: (lambda ax: (ax.plot(elapsed, [float(row["gpu_temperature_celsius"]) for row in resource_rows], label="Temperature (C)"), ax.plot(elapsed, [float(row["gpu_power_watts"]) for row in resource_rows], label="Power (W)"), ax.set(title="Image benchmark GPU temperature and power", xlabel="Elapsed seconds", ylabel="Measured value",), ax.legend()))(fig.add_subplot(111)))
    return summary


if __name__ == "__main__":
    parser = argparse.ArgumentParser(); parser.add_argument("--run-id", required=True); args = parser.parse_args(); print(json.dumps(run(args.run_id), indent=2))
