from __future__ import annotations

import csv
from pathlib import Path

import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[2]
RUN_ID = "full-20261108T110310Z-f766ae7b"
source = ROOT / "datasets" / "results" / f"resource_samples_{RUN_ID}.csv"
out = ROOT / "research" / "audit" / "corrected_figures"
out.mkdir(parents=True, exist_ok=True)
csv.field_size_limit(50_000_000)
with source.open(encoding="utf-8", newline="") as handle:
    rows = sorted(list(csv.DictReader(handle)), key=lambda row: float(row["timestamp"]))
start = float(rows[0]["timestamp"])
elapsed = [float(row["timestamp"]) - start for row in rows]
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "savefig.dpi": 300, "axes.spines.top": False, "axes.spines.right": False})

def save(name: str, draw) -> None:
    figure = plt.figure(figsize=(7.2, 4.5)); draw(figure); figure.tight_layout(); figure.savefig(out / f"{name}.png", dpi=300, bbox_inches="tight"); figure.savefig(out / f"{name}.svg", bbox_inches="tight"); figure.savefig(out / f"{name}.pdf", bbox_inches="tight"); plt.close(figure)

save("figure_07_gpu_utilization_chronological", lambda fig: (lambda ax: (ax.plot(elapsed, [float(row["gpu_utilization_percent"]) for row in rows], color="#C06C84", alpha=.18, linewidth=.5), ax.plot(elapsed, [sum(float(item["gpu_utilization_percent"]) for item in rows[max(0, i - 49):i + 1]) / len(rows[max(0, i - 49):i + 1]) for i in range(len(rows))], color="#355C7D", label="50-sample rolling mean"), ax.set(title="GPU utilization across full benchmark (chronological)", xlabel="Elapsed seconds", ylabel="GPU utilization (%)"), ax.legend()))(fig.add_subplot(111)))
save("figure_08_vram_utilization_chronological", lambda fig: (lambda ax: (ax.plot(elapsed, [float(row["gpu_memory_used_bytes"]) / 1024 ** 3 for row in rows], color="#F67280"), ax.set(title="VRAM usage across full benchmark (chronological)", xlabel="Elapsed seconds", ylabel="VRAM used (GiB)")))(fig.add_subplot(111)))
save("figure_09_cpu_ram_chronological", lambda fig: (lambda ax: (ax.plot(elapsed, [float(row["cpu_percent"]) for row in rows], label="CPU (%)"), ax.plot(elapsed, [float(row["ram_percent"]) for row in rows], label="RAM (%)"), ax.set(title="CPU and RAM utilization (chronological)", xlabel="Elapsed seconds", ylabel="Utilization (%)"), ax.legend()))(fig.add_subplot(111)))
