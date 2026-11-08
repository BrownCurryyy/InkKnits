from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

from research.config import CLEANED_DATASET, RESULTS
from research.metrics import summarize_numbers
from research.text_utils import length_group


def load(path: Path) -> list[dict]:
    with path.open(encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def run(input_path: Path = CLEANED_DATASET, output_dir: Path = RESULTS / "eda") -> dict:
    rows = load(input_path)
    counts = Counter(row["quality_status"] for row in rows)
    groups = Counter(length_group(int(row["word_count"])) for row in rows)
    words = [int(row["word_count"]) for row in rows]
    chars = [int(row["character_count"]) for row in rows]
    report = {"record_count": len(rows), "word_count_statistics": summarize_numbers(words), "character_count_statistics": summarize_numbers(chars), "quality_breakdown": dict(counts), "length_group_counts": dict(groups)}
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "eda_statistics.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    with (output_dir / "eda_statistics.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["metric", "value"])
        for section, values in report.items():
            if isinstance(values, dict):
                for key, value in values.items():
                    writer.writerow([f"{section}.{key}", value])
    try:
        import matplotlib.pyplot as plt
    except ImportError as exc:
        (output_dir / "eda_plot_status.json").write_text(json.dumps({"status": "unavailable", "reason": str(exc)}, indent=2), encoding="utf-8")
        return report
    plt.rcParams.update({"figure.dpi": 150, "savefig.dpi": 300, "axes.grid": True, "grid.alpha": 0.25})
    charts = [(words, f"Full cleaned dataset: word-count distribution (N={len(words)})", "Words per article", "word_count_distribution.png", "hist"), (chars, f"Full cleaned dataset: character-count distribution (N={len(chars)})", "Characters per article", "character_count_distribution.png", "hist")]
    for values, title, xlabel, filename, kind in charts:
        figure, axis = plt.subplots(figsize=(7, 4.2)); axis.hist(values, bins=40); axis.set(title=title, xlabel=xlabel, ylabel="Articles"); figure.tight_layout(); figure.savefig(output_dir / filename); plt.close(figure)
    figure, axis = plt.subplots(figsize=(7, 4.2)); axis.bar(list(groups), [groups[key] for key in groups]); axis.set(title=f"Full cleaned dataset: length categories (N={len(words)})", xlabel="Length group by word count", ylabel="Articles"); figure.tight_layout(); figure.savefig(output_dir / "length_categories.png"); plt.close(figure)
    figure, axis = plt.subplots(figsize=(5, 4.2)); axis.boxplot(words, orientation="vertical", showfliers=True); axis.set(title=f"Full cleaned dataset: word-count box plot (N={len(words)})", ylabel="Words per article"); axis.set_yscale("log"); figure.tight_layout(); figure.savefig(output_dir / "word_count_boxplot.png"); plt.close(figure)
    short_long = {"very short (<50 words)": sum(value < 50 for value in words), "long (>2,000 words)": sum(value > 2000 for value in words)}
    figure, axis = plt.subplots(figsize=(5, 4.2)); axis.bar(list(short_long), list(short_long.values())); axis.set(title=f"Full cleaned dataset: very short versus long (N={len(words)})", ylabel="Articles"); axis.tick_params(axis="x", rotation=20); figure.tight_layout(); figure.savefig(output_dir / "short_vs_long.png"); plt.close(figure)
    quality = Counter({"valid and unique": sum(row["quality_status"] == "valid" and row["duplicate_indicator"] == "unique" for row in rows), "questionable duplicate": sum(row["quality_status"] == "questionable" and row["duplicate_indicator"] == "duplicate" for row in rows), "invalid or empty": sum(row["quality_status"] == "invalid" for row in rows)})
    figure, axis = plt.subplots(figsize=(6, 4.2)); bars = axis.bar(list(quality), list(quality.values())); axis.bar_label(bars, padding=3); axis.set(title=f"Full cleaned dataset: data quality breakdown (N={len(rows)})", ylabel="Records"); axis.tick_params(axis="x", rotation=15); figure.tight_layout(); figure.savefig(output_dir / "data_quality_breakdown.png"); plt.close(figure)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(); parser.add_argument("--input", type=Path, default=CLEANED_DATASET); parser.add_argument("--output-dir", type=Path, default=RESULTS / "eda"); args = parser.parse_args(); print(json.dumps(run(args.input, args.output_dir), indent=2))

if __name__ == "__main__":
    main()
