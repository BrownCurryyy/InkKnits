# Local Application Benchmark Results

## Outcome

This is a **local-only application-level benchmark** against the isolated benchmark project. No benchmark request, credential, article content, or generated output was sent through Cloudflare or another third-party path. The Cloudflare connectivity probe was skipped. This is not a cloud-compute, geographic-client, or local-versus-Cloudflare comparison.

The fresh smoke run completed **2/2** requests (one text and one image), with both generated assets retrieved and verified. The full campaign recorded all **225/225** planned requests over **3,601.64 seconds**:

| Workload | Attempted | Succeeded | Failed |
|---|---:|---:|---:|
| Summarization | 45 | 45 | 0 |
| Shortening | 45 | 45 | 0 |
| Two-output atomization | 45 | 45 | 0 |
| Five-output atomization | 45 | 45 | 0 |
| Image generation | 45 | 16 | 29 |
| **Total** | **225** | **196** | **29** |

All **196 successful requests** had their expected assets fetched and verified in the isolated project. The run is therefore fully recorded but **not a 225/225-success campaign**. No request was retried.

## Failure diagnosis

- **28 requests** were rejected with HTTP 401 during image generation. The run lasted just over one hour; the backend access token expires after 60 minutes, and the runner authenticates once at startup without refreshing the token. These failures are retained in `records.csv`.
- **1 image request** was accepted with HTTP 202 but ended with an `UNKNOWN` job status. Its completion and persistence could not be verified; it was not retried.
- The backend, Ollama, and ComfyUI health endpoints responded successfully after the run. The pattern is consistent with access-token expiry, not a persistent inference-service outage.

The runner marks the single-path root manifest `PRELIMINARY` and returns exit code 2 by design. Its per-condition manifest says `COMPLETED` because all 225 records were written; the success/failure counts above are the outcome.

## Successful-request timing

Latency distributions below include only the 196 successful requests. Percentiles use nearest-rank p95. Values are seconds.

| Operation | Successes | Client median / p95 | Inference median / p95 |
|---|---:|---:|---:|
| Summarization | 45/45 | 4.11 / 6.14 | 3.75 / 5.84 |
| Shortening | 45/45 | 10.15 / 40.32 | 9.30 / 38.84 |
| Two-output atomization | 45/45 | 14.24 / 60.49 | 13.78 / 59.09 |
| Five-output atomization | 45/45 | 26.36 / 96.92 | 25.95 / 96.42 |
| Image generation | 16/45 | 15.12 / 20.18 | 14.08 / 20.09 |

Across successful requests, client latency median/p95 was **14.08/60.40 s**; backend total median/p95 was **12.26/59.09 s**; queue wait was **0.0018/0.0026 s**; and client-observed persistence verification was **0.0292/0.1415 s**. Total attempted-request throughput was **3.75 requests/minute**, including serial inference and persistence.

## Resource and setup notes

The resource file contains **3,427 samples** (approximately one-second sampling): CPU averaged **15.0%** (maximum 65.2%); RAM averaged **90.3%** (maximum 100%); GPU utilization averaged **86.0%** (maximum 100%); VRAM utilization averaged **65.4%** (maximum 82.3%); GPU temperature peaked at **81 C**. The report retains the full samples.

The workload used the existing local application configuration, text options `temperature=0.2` and `num_ctx=8192`, and image size `512x512`. Dataset integrity was checked: 45 unique text article IDs and 45 unique image article IDs, prompts, and seeds. The run records include SHA-256 hashes for both input datasets.

## Evidence

- Successful smoke: `local/app-20261112T231519Z-dbb86fb9-local/`
- Full run: `local/app-20261112T231634Z-582c4cb5-local/`
- Full-run files: `records.csv`, `events.jsonl`, `resources.jsonl`, `network_metadata.json`, `summary.json`, and `run_manifest.json`
- Root manifest: `manifests/app-20261112T231634Z-582c4cb5.json`
- Earlier failed smoke and historical evidence remain preserved in their existing run/archive locations.

The completed component benchmarks and research paper were not changed. The dedicated benchmark password remains in the existing local DPAPI-protected store; no password or access token was written to this report or the benchmark evidence. Because this campaign has unresolved failures, credentials were not revoked.

