from __future__ import annotations

import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path

from research.config import RESULTS
from research.text_utils import word_count

STOP = set("the a an and or of to in on for with is are was were this that from by as at be it its into".split())

def tokens(text: str) -> set[str]:
    return {token.lower() for token in re.findall(r"[A-Za-z0-9]+", text) if token.lower() not in STOP and len(token) > 2}

def run(results_path: Path = RESULTS / "experiment_results.csv", output_path: Path = RESULTS / "quality_results.csv", run_id: str | None = None) -> None:
    csv.field_size_limit(50_000_000)
    with results_path.open(encoding="utf-8", newline="") as handle:
        rows = [row for row in csv.DictReader(handle) if run_id is None or row.get("run_id") == run_id]
    evaluated = []
    for row in rows:
        source = tokens(row.get("input_text", "")); output = row.get("output_text", ""); output_tokens = tokens(output)
        row["output_nonempty"] = bool(output.strip()); row["source_overlap_ratio"] = len(source & output_tokens) / len(source) if source else None; row["output_word_count"] = word_count(output)
        evaluated.append(row)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        fields = list(evaluated[0]) if evaluated else ["article_id"]
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader(); writer.writerows(evaluated)
    template = RESULTS / "human_evaluation_template.csv"
    with template.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle); writer.writerow(["Article ID", "Experiment type", "Output ID", "Relevance (1-5)", "Information retention (1-5)", "Factual consistency (1-5)", "Readability (1-5)", "Format adherence (1-5)", "Evaluator comments"])
    print(json.dumps({"evaluated_rows": len(evaluated), "note": "Automated lexical checks are proxies, not human references or ground truth."}, indent=2))

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", default=None)
    args = parser.parse_args()
    run(run_id=args.run_id)
