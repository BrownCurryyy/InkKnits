from __future__ import annotations

import argparse
import csv
import hashlib
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

from research.config import BENCHMARK_SAMPLE, CLEANED_DATASET, QUALITY_REPORT, RAW_DATASET, SEED
from research.text_utils import detect_language_hint, length_group, repair_mojibake, word_count

OUTPUT_FIELDS = ["article_id", "original_text", "cleaned_text", "word_count", "character_count", "cleaning_flags", "duplicate_indicator", "quality_status"]


def clean(input_path: Path = RAW_DATASET, output_path: Path = CLEANED_DATASET, sample_path: Path = BENCHMARK_SAMPLE, report_path: Path = QUALITY_REPORT, sample_size: int = 45) -> dict:
    records: list[dict] = []
    duplicate_counts: Counter[str] = Counter()
    raw_sha256 = hashlib.sha256()
    with input_path.open("rb") as raw:
        for chunk in iter(lambda: raw.read(1024 * 1024), b""):
            raw_sha256.update(chunk)
    with input_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row_number, row in enumerate(reader, 1):
            original = row.get("Article")
            if original is None:
                text = ""
                flags = ["missing_text"]
            else:
                text = original.strip()
                flags = []
                if not text:
                    flags.append("empty_text")
            cleaned, repaired = repair_mojibake(text)
            if repaired:
                flags.append("mojibake_repaired")
            if cleaned and detect_language_hint(cleaned) != "mostly_latin":
                flags.append("non_latin_or_mixed_hint")
            records.append({"row_number": row_number, "original_text": original or "", "cleaned_text": cleaned, "flags": flags})
            duplicate_counts[cleaned] += 1 if cleaned else 0
    for index, record in enumerate(records, 1):
        text = record["cleaned_text"]
        words = word_count(text)
        duplicate = bool(text) and duplicate_counts[text] > 1
        flags = list(record["flags"])
        if duplicate:
            flags.append("exact_duplicate")
        unusable = not text or words < 10
        quality = "invalid" if not text else ("questionable" if unusable or duplicate or "non_latin_or_mixed_hint" in flags else "valid")
        record.update({"article_id": f"ART-{index:06d}", "word_count": words, "character_count": len(text), "cleaning_flags": ";".join(sorted(set(flags))), "duplicate_indicator": "duplicate" if duplicate else "unique", "quality_status": quality})
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=OUTPUT_FIELDS)
        writer.writeheader()
        for record in records:
            writer.writerow({field: record[field] if field != "cleaning_flags" else record["cleaning_flags"] for field in OUTPUT_FIELDS})
    eligible = [record for record in records if record["quality_status"] == "valid" and record["duplicate_indicator"] == "unique"]
    by_group: dict[str, list[dict]] = defaultdict(list)
    for record in eligible:
        by_group[length_group(record["word_count"])].append(record)
    rng = random.Random(SEED)
    selected: list[dict] = []
    groups = ["short", "medium", "long", "very_long"]
    target_each = max(1, sample_size // len(groups))
    for group in groups:
        bucket = by_group[group][:]
        rng.shuffle(bucket)
        selected.extend(bucket[:target_each])
    remaining = [record for record in eligible if record not in selected]
    rng.shuffle(remaining)
    selected.extend(remaining[: max(0, sample_size - len(selected))])
    selected.sort(key=lambda record: record["article_id"])
    with sample_path.open("w", encoding="utf-8", newline="") as handle:
        fields = ["article_id", "cleaned_text", "word_count", "character_count", "length_group"]
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for record in selected:
            writer.writerow({"article_id": record["article_id"], "cleaned_text": record["cleaned_text"], "word_count": record["word_count"], "character_count": record["character_count"], "length_group": length_group(record["word_count"])})
    report = {"source_sha256": raw_sha256.hexdigest(), "original_record_count": len(records), "valid_record_count": sum(record["quality_status"] == "valid" for record in records), "invalid_record_count": sum(record["quality_status"] == "invalid" for record in records), "questionable_record_count": sum(record["quality_status"] == "questionable" for record in records), "duplicate_count": sum(record["duplicate_indicator"] == "duplicate" for record in records), "encoding_correction_count": sum("mojibake_repaired" in record["cleaning_flags"] for record in records), "missing_text_count": sum("missing_text" in record["cleaning_flags"] for record in records), "benchmark_sample_count": len(selected), "benchmark_sample_ids": [record["article_id"] for record in selected], "random_seed": SEED, "sampling_method": "stratified random sample across actual length groups; exact duplicates and invalid records excluded", "length_thresholds_words": {"short_max": 500, "medium_max": 1000, "long_max": 2000, "very_long": ">2000"}, "cleaning_operations": ["strip surrounding whitespace", "conservative cp1252-to-UTF8 mojibake repair when marker count decreases", "stable row-based IDs", "flag questionable records; retain them in cleaned output"], "files": {"raw": str(input_path), "cleaned": str(output_path), "sample": str(sample_path)}}
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample-size", type=int, default=45)
    args = parser.parse_args()
    print(json.dumps(clean(sample_size=args.sample_size), indent=2))


if __name__ == "__main__":
    main()
