# InkKnits Research Benchmark

This directory contains reproducible dataset, local Ollama benchmark, quality-evaluation, and reporting tools. The original `datasets/raw_articles.csv` is read-only and is never overwritten.

## Environment

Use `backend/.venv/Scripts/python.exe` on Windows. Install research-only dependencies with:

```powershell
backend\.venv\Scripts\python.exe -m pip install -r research\requirements.txt
```

Ollama must be running locally. The benchmark reads `OLLAMA_MODEL` and `OLLAMA_BASE_URL`; defaults are `gemma2:2b` and `http://127.0.0.1:11434`. It records the actual `/api/tags` and `/api/show` responses when available.

## Pipeline

```powershell
$env:PYTHONPATH='.'
backend\.venv\Scripts\python.exe -m research.inspect_dataset --output datasets\dataset_inspection.json
backend\.venv\Scripts\python.exe -m research.clean_dataset --sample-size 45
backend\.venv\Scripts\python.exe -m research.eda
backend\.venv\Scripts\python.exe -m research.benchmark --sample-size 3 --run-label smoke
# Review smoke outputs and call/runtime estimate before the larger run.
backend\.venv\Scripts\python.exe -m research.benchmark --sample-size 45 --run-label full
backend\.venv\Scripts\python.exe -m research.evaluate_quality
backend\.venv\Scripts\python.exe -m research.generate_report
```

Each article requires 9 direct model calls in the default benchmark: one summary, one shortening call, two-child atomization with two calls, and five-child atomization with five calls. A 3-article smoke test therefore makes 27 calls; the 45-article configuration makes 405 calls, excluding warm-up. The runner records queue waiting as zero for direct calls and labels these as direct-model experiments, not scheduler tests.

No ROUGE/BERTScore or fabricated references are used. Lexical overlap, output compliance, distinctness, compression, and optional automated judge scores are supplementary proxies only.

## Image benchmark

The image benchmark is separate from the completed text benchmark and uses the checked-in ComfyUI workflow in `backend/final4.json`. It reads the same 45-article sample, derives deterministic prompts and seeds, and writes only `image_*` outputs under `datasets/results/`.

```powershell
$env:PYTHONPATH='.'
backend\.venv\Scripts\python.exe -m pip install -r research\requirements.txt
backend\.venv\Scripts\python.exe -m research.image_benchmark --sample-size 1 --run-label smoke
backend\.venv\Scripts\python.exe -m research.image_analysis --run-id <completed-image-run-id>
backend\.venv\Scripts\python.exe -m research.image_audit --run-id <completed-image-run-id>
```

ComfyUI must be running at `http://127.0.0.1:8188` with the configured checkpoint available. The successful full image run is recorded under `image-full-20261108T131126Z-c4c3d9e4`; the earlier failed smoke run remains preserved.
