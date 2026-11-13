# Fresh Local Application Benchmark

## Scope and outcome

This is a **local-only application-level benchmark** on the same laptop that ran the InkKnits API, Ollama, and ComfyUI. No request, credential, article content, or generated output was sent through Cloudflare or another third-party path. This is not a Cloudflare comparison, cloud-compute experiment, or geographically distributed-client test.

The fresh smoke completed both required requests: one text generation and one image generation. Both jobs completed and their output assets were retrieved and persistence-checked. A separate local authentication check passed after the smoke.

The full campaign completed **225/225 requests successfully (100%)** in **2,961.42 seconds (49.36 minutes)**:

| Workload | Requests | Succeeded | Failed |
|---|---:|---:|---:|
| Summarization | 45 | 45 | 0 |
| Shortening | 45 | 45 | 0 |
| Two-output atomization | 45 | 45 | 0 |
| Five-output atomization | 45 | 45 | 0 |
| Image generation | 45 | 45 | 0 |
| **Total** | **225** | **225** | **0** |

All **225 jobs** are `COMPLETED`. The 450 generated output assets (including atomized outputs) were fetched by the runner, checked against the benchmark project, and persisted. A read-only post-run database validation independently found all 225 completed jobs and all 450 output assets; text content and image files were present, and every asset belonged to the isolated project.

## Workload and configuration validation

The fresh workload has the same 45 unique source article IDs, 45 image prompts, and 45 image seeds as the historical campaign. Input dataset SHA-256 values match the old manifest:

- Text dataset: `95855c3aac77e7d86995cf5c04a05c4fd47375659607c354f5b988f9b4dd9cd0`
- Image prompt/seed dataset: `8031f450c21a33620bddc98cea7ed928d52e43ee29a64b9a4fc446b6c07f4341`
- Historical-to-fresh request-definition SHA-256: `21337a08ed29aeba2d81ac6b8631c0b9acef2d946e83903732fc28a79a66e483` (exact match)
- Fresh configuration SHA-256: `a0b68a031946cc3397a2d858c8ec5e6bd2c9157e80d5a5b67dfd52eb76525252`

Configuration: Gemma 2 2B for text and image-prompt enrichment; text options `temperature=0.2`, `num_ctx=8192`; ComfyUI checkpoint `epicrealism_naturalSinRC1VAE.safetensors`; output resolution 512×512; the same checked-in ComfyUI workflow (SHA-256 `6824e7d4162ec8aff88c74a6ddbf2f2fe3ea16a3fdd9ed9c80f6309ede88c0cc`). The prior manifest did not store a configuration hash, so a direct persisted-hash comparison is unavailable. The input hashes and request-definition hash were compared directly; the prior runner report and configuration source confirm the same fixed generation settings.

## Latency and throughput

All statistics below use successful requests; all 225 fresh requests succeeded. Latencies are seconds. P95 uses nearest-rank; standard deviation is the sample standard deviation.

| Measurement | Mean | Std. dev. | Median | P95 |
|---|---:|---:|---:|---:|
| Client end-to-end | 13.144 | 13.948 | 10.253 | 42.290 |
| Backend total | 12.009 | 13.941 | 10.083 | 40.558 |
| Queue wait | 0.0020 | 0.0004 | 0.0019 | 0.0027 |
| Inference | 12.007 | 13.941 | 10.081 | 40.556 |
| Persistence verification | 0.0487 | 0.0746 | 0.0290 | 0.1241 |

Client latency by operation:

| Operation | Mean | Std. dev. | Median | P95 |
|---|---:|---:|---:|---:|
| Summarization | 3.914 | 1.204 | 4.089 | 6.127 |
| Shortening | 10.884 | 10.367 | 8.082 | 36.318 |
| Two-output atomization | 13.025 | 11.939 | 10.117 | 46.469 |
| Five-output atomization | 25.625 | 22.021 | 18.220 | 82.695 |
| Image generation | 12.273 | 1.247 | 12.136 | 12.182 |

Serial campaign throughput was **4.56 requests/minute** (225 requests over 49.36 minutes). Client latency includes generation and persistence verification; persistence timing is the client-observed interval from the terminal job response until output assets were fetchable.

## Resource samples

The run captured **2,810 approximately one-second samples**. Values are mean / sample standard deviation / P95 / maximum.

| Resource | Mean | Std. dev. | P95 | Maximum |
|---|---:|---:|---:|---:|
| CPU utilization | 24.98% | 13.00 | 57.8% | 91.5% |
| RAM utilization | 87.55% | 12.58 | 96.6% | 100% |
| GPU utilization | 79.68% | 28.60 | 100% | 100% |
| VRAM utilization | 67.42% | 4.33 | 77.45% | 82.19% |
| GPU temperature | 77.10 °C | 6.04 | 86 °C | 88 °C |
| GPU power | 64.99 W | 16.82 | 79.24 W | 90.77 W |

## Comparison with the historical local campaign

The historical campaign recorded **196/225 successful requests (87.11%)** and **29 failures**: 28 explicit HTTP 401 responses after its single access token expired, plus one accepted image job whose polling received HTTP 401. The fresh campaign is **225/225 (100%)**, with no failed or unknown jobs; the success rate is higher by **12.89 percentage points**.

The previously unknown job was inspected before the fresh smoke or full run: it had since reached `COMPLETED` and its image asset was persisted and retrievable in the isolated project. Its historical request record remains unchanged. It was not counted as a success in the old campaign report.

Historical successful-request client latency was mean **18.309 s**, sample standard deviation **20.517 s**, median **14.082 s**, and P95 **60.402 s**. Fresh values were **13.144 s**, **13.948 s**, **10.253 s**, and **42.290 s**, respectively. These are descriptive campaign-level comparisons, not a controlled speedup claim: the historical latency distribution omitted its failed requests, only 16/45 historical image requests succeeded, and runs were separated in time. The matched request-definition hash confirms the same intended workload.

The runner now reauthenticates five minutes before token expiry and permits at most one reauthentication/retry after an explicit HTTP 401. It does not retry generation after a timeout, connection loss, or server error where acceptance could be ambiguous. The full run completed in under 60 minutes and used one login with zero 401 retries; a controlled-clock regression test verified automatic reauthentication beyond the 60-minute expiry. All five focused authentication tests passed.

## Evidence paths

- Results report: `research/cloudflare_benchmark/reports/fresh_local_application_benchmark_20261113.md`
- Full-run root manifest: `research/cloudflare_benchmark/manifests/app-20261113T053322Z-203e3244.json`
- Full-run directory: `research/cloudflare_benchmark/local/app-20261113T053322Z-203e3244-local/`
- Full-run records: `research/cloudflare_benchmark/local/app-20261113T053322Z-203e3244-local/records.csv`
- Full-run sanitized event log: `research/cloudflare_benchmark/local/app-20261113T053322Z-203e3244-local/events.jsonl`
- Full-run resource samples: `research/cloudflare_benchmark/local/app-20261113T053322Z-203e3244-local/resources.jsonl`
- Full-run condition manifest and summary: `research/cloudflare_benchmark/local/app-20261113T053322Z-203e3244-local/run_manifest.json` and `summary.json`
- Local-only network metadata: `research/cloudflare_benchmark/local/app-20261113T053322Z-203e3244-local/network_metadata.json` (Cloudflare probe skipped)
- Smoke evidence: `research/cloudflare_benchmark/local/app-20261113T053233Z-491c36c1-local/`
- Auth regression tests: `research/cloudflare_benchmark/scripts/test_cloudflare_app_benchmark.py`

Final validation confirmed 225 unique request IDs and workload/article/operation keys, matching dataset hashes and historical request-definition hash, reconciled manifests and counts, 225/225 persisted outputs, no Cloudflare probe, and no credential or token patterns in the new evidence. The earlier campaign, completed component benchmarks, and research paper were not modified.

