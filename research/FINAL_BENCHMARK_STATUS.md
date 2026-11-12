# Final Benchmark Status

**Status:** Preliminary application evaluation; completed local component studies preserved.
**Updated:** 2026-11-12

## Executive Summary

The completed direct text-component and direct image-pipeline experiments remain authoritative and intact. The supplementary application evaluation includes successful authenticated smoke requests through local and Cloudflare access paths, plus a partial local-only condition. A complete matched local-versus-Cloudflare application benchmark was not completed. No full application image workload was started after the explicit stop instruction.

## Experiments

### Experiment 1: Direct Local Text Components

- Run: `full-20261108T110310Z-f766ae7b`
- Sample: 45 fixed article IDs, stratified from the 11,992-record cleaned corpus; sample seed `20261108`.
- Model/configuration: local Ollama `gemma2:2b`, Q4_0, temperature 0.2, context 8192.
- Results: 180 observations from 405 model calls; 180/180 observations succeeded, including all 315 requested atomization outputs.
- Runtime: 2,494.76 seconds.
- Mean latency: summarization 5.03 s; shortening 6.58 s; two-output atomization 14.61 s; five-output atomization 28.88 s.
- Resource samples: 8,292; mean CPU 20.51%, RAM 90.13%, GPU utilization 89.66%; mean GPU memory use approximately 2.70 GB decimal (2.51 GiB).
- Quality evidence is limited to automated lexical overlap, compression, non-empty output, and output-count compliance proxies. No human evaluation or verified reference summaries exist.

### Experiment 1b: Direct Image Pipeline

- Run: `image-full-20261108T131126Z-c4c3d9e4`.
- Results: 45/45 sequential ComfyUI generations succeeded; 768x768 PNG outputs.
- Runtime from first measured submission to last completion: 624.72 seconds.
- Mean generation time 13.814 s; median 14.067 s; P95 14.137 s; throughput 4.343 images/minute.
- Queue wait is unavailable from the ComfyUI history API. No human visual-quality rating was performed.
- The raw image CSV also contains two separate one-request smoke rows: one earlier failed smoke and one successful smoke. They are not part of the 45-row full-run summary.

### Experiment 2: Application Access Paths

- Local runner smoke `app-20261112T125418Z-135fc2ee`: 5/5 requests completed in 62.03 seconds (four text operations on one article and one seeded image request). All result assets were fetched and persistence was verified.
- Additional authenticated local smoke: one summarization job and one image job completed; the image file existed under the benchmark project storage path.
- Cloudflare smoke: one text and one image job completed through `https://inkknits.trustium.tech`; both assets were fetched at request time. The image file was 754,970 bytes. A later recheck could not retrieve every historical task record, so this is request-time smoke evidence rather than a durable matched dataset.
- Local-only partial run `app-20261112T125600Z-870967b9`: 59 of 225 planned requests recorded over 1,099.29 seconds; 47 succeeded with verified persisted outputs and 12 failed before job creation with HTTP 422. All 12 failures were summarization/shortening prompts that exceeded the API's 12,000-character prompt limit. No image requests were reached.
- The partial run's records are preserved locally. A sanitized 59-row derivative is included in `research/cloudflare_benchmark/results/application_partial_records_sanitized.csv`. The run is labeled `INTERRUPTED`; no retries or observation modifications were made.
- Fourteen stale rows in the benchmark project were snapshotted and marked failed after restart because the live scheduler was empty. No automatic retries occurred. A stale task in another project was not modified.
- No complete Cloudflare condition or matched full local-versus-Cloudflare comparison exists. No tunnel-overhead estimate is valid.

## Network and Backend Recovery

The partial local condition recorded Wi-Fi as the connection type. Ten TCP connection attempts to the Cloudflare hostname had a median connect time of 77.68 ms; ten local API connection attempts had a median of 15.23 ms. These are TCP connection times, not application latency or bandwidth. No independent bandwidth measurement was run.

Port 8000 was already listening on an InkKnits Uvicorn process and `/health` returned `{"status":"ok"}`. The process list showed a Uvicorn parent and child for this project. The observed Windows TCP excluded range was 50000-50059, not port 8000. Windows Firewall profiles were enabled and were not changed. The startup error is consistent with attempting to bind a second server to an occupied port; no unrelated process was terminated and no alternate port was required.

## Figures and Tables

The existing figures are preserved and verified:

- 15 text-component figures, each in 300-DPI PNG, SVG, and PDF, with 15 underlying chart-data CSVs.
- 7 image-pipeline figures, each in 300-DPI PNG, SVG, and PDF, with 7 underlying chart-data CSVs.
- No local-versus-Cloudflare chart was created because no matched full measurements exist.

## Research Files

Updated or added for this handoff:

- `research/RESEARCH_RESULTS_AND_METHODOLOGY.md`
- `research/PAPER_TABLES.md`
- `research/RESEARCH_FINDINGS_SUMMARY.md`
- `research/FINAL_BENCHMARK_STATUS.md`
- `research/cloudflare_benchmark/README.md`
- `research/cloudflare_benchmark/BLOCKER_STATUS.md`
- `research/cloudflare_benchmark/results/smoke_validation.json`
- `research/cloudflare_benchmark/results/application_network_conditions.json`
- `research/cloudflare_benchmark/results/application_partial_records_sanitized.csv`
- `research/cloudflare_benchmark/manifests/submission_manifest.json`
- `research/cloudflare_benchmark/scripts/cloudflare_app_benchmark.py`
- `research/cloudflare_benchmark/scripts/reconcile_stale_jobs.py`
- `research/cloudflare_benchmark/logs/scheduler_recovery_20261112T124844Z.json`
- `research/migration_manifest.json`
- `InkKnits_Paper.tex`

Raw application records containing article prompts, event logs, resource samples, and detailed network samples are excluded from Git. The completed component raw result files and manifests were not modified.

## Git Handoff

- Branch: `main`
- Remote: `origin` (`https://github.com/BrownCurryyy/InkKnits.git`)
- Commit: pending
- Push: pending
- Credentials, passwords, access tokens, `.env` files, generated model/image assets, and raw prompt logs are not to be staged.

## Submission Readiness

The paper's results/methodology text now separates the direct component experiments from the incomplete application evaluation and removes the unsupported local-versus-tunnel latency table, concurrency conclusions, and invented scheduler timing model. The checked-in schema description was aligned with repository tables. However, the manuscript is **not fully submission-ready** until its references are independently verified and the revised TeX is compiled in a LaTeX environment. The full matched application benchmark, human content/image evaluation, repeated-run variance, bandwidth measurement, and multi-user scalability study remain absent and must be disclosed as limitations; none is required to present the completed local component results honestly.
