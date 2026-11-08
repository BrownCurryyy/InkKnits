from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATASETS = ROOT / "datasets"
RESULTS = DATASETS / "results"
RAW_DATASET = DATASETS / "raw_articles.csv"
CLEANED_DATASET = DATASETS / "cleaned_articles.csv"
BENCHMARK_SAMPLE = DATASETS / "benchmark_sample.csv"
QUALITY_REPORT = DATASETS / "dataset_quality_report.json"
SEED = int(os.getenv("INKKNITS_RESEARCH_SEED", "20261108"))
DEFAULT_SAMPLE_SIZE = int(os.getenv("INKKNITS_BENCHMARK_SAMPLE_SIZE", "45"))
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma2:2b")

SHORT_MAX = 500
MEDIUM_MAX = 1000
LONG_MAX = 2000

ATOMIZATION_FORMATS_2 = ["LinkedIn post", "Short newsletter section"]
ATOMIZATION_FORMATS_5 = [
    "LinkedIn post",
    "Short newsletter section",
    "X/Twitter-style post",
    "Blog introduction",
    "Short promotional description",
]
