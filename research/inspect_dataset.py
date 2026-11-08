from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import statistics
from collections import Counter
from pathlib import Path

from research.config import RAW_DATASET
from research.text_utils import MOJIBAKE_MARKERS, detect_language_hint, word_count


def percentile(values: list[int], fraction: float) -> float:
    ordered = sorted(values)
    if not ordered:
        return 0.0
    position = (len(ordered) - 1) * fraction
    lower = math.floor(position)
    upper = math.ceil(position)
    if lower == upper:
        return float(ordered[lower])
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (position - lower)


def inspect(path: Path) -> dict:
    sha256 = hashlib.sha256()
    row_count = 0
    missing = 0
    empty = 0
    texts: list[str] = []
    word_counts: list[int] = []
    char_counts: list[int] = []
    mojibake = 0
    language_hints = Counter()
    with path.open("rb") as raw:
        for chunk in iter(lambda: raw.read(1024 * 1024), b""):
            sha256.update(chunk)
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        columns = reader.fieldnames or []
        for row in reader:
            row_count += 1
            text = row.get("Article")
            if text is None:
                missing += 1
                continue
            if not text.strip():
                empty += 1
                continue
            texts.append(text)
            words = word_count(text)
            word_counts.append(words)
            char_counts.append(len(text))
            if any(marker in text for marker in MOJIBAKE_MARKERS):
                mojibake += 1
            language_hints[detect_language_hint(text)] += 1
    frequencies = Counter(texts)
    duplicate_rows = sum(count - 1 for count in frequencies.values() if count > 1)
    stats = lambda values: {
        "mean": statistics.mean(values) if values else 0,
        "median": statistics.median(values) if values else 0,
        "stddev": statistics.stdev(values) if len(values) > 1 else 0,
        "min": min(values) if values else 0,
        "max": max(values) if values else 0,
        "p25": percentile(values, 0.25),
        "p75": percentile(values, 0.75),
        "p90": percentile(values, 0.90),
        "p95": percentile(values, 0.95),
    }
    return {
        "source": str(path),
        "sha256": sha256.hexdigest(),
        "columns": columns,
        "record_count": row_count,
        "valid_nonempty_count": len(texts),
        "missing_text_count": missing,
        "empty_text_count": empty,
        "exact_duplicate_row_count": duplicate_rows,
        "unique_nonempty_count": len(frequencies),
        "encoding_mojibake_marker_count": mojibake,
        "word_count_statistics": stats(word_counts),
        "character_count_statistics": stats(char_counts),
        "very_short_under_50_words": sum(value < 50 for value in word_counts),
        "very_long_over_5000_words": sum(value > 5000 for value in word_counts),
        "language_hints": dict(language_hints),
        "near_duplicate_detection": "not performed in streaming inspection; exact duplicates are measured",
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, default=RAW_DATASET)
    parser.add_argument("--output", type=Path, default=None)
    args = parser.parse_args()
    report = inspect(args.input)
    print(json.dumps(report, indent=2))
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
