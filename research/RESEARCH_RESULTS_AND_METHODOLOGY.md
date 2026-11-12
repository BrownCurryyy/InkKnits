# InkKnits Research Results and Methodology

## 1. Executive Summary

The research package contains two completed direct-component studies and an incomplete application-access evaluation. The text component experiment used 45 fixed article IDs for four operations, producing 180 observations from 405 Gemma model calls; all 180 observations completed. A separate direct ComfyUI experiment generated 45/45 images. The authenticated application test has verified local and Cloudflare smoke outputs, plus an interrupted local-only run with 59 recorded requests (47 successful, 12 rejected before job creation). No full matched local-versus-Cloudflare application benchmark was completed.

Mean request latency was 5.03 seconds for summarization, 6.58 seconds for shortening, 14.61 seconds for two-output atomization, and 28.88 seconds for five-output atomization. These are direct local Ollama measurements and do not measure the production InkKnits scheduler. Continuous monitoring collected 8,292 samples over approximately 2,495 seconds.

## 2. Research Objective

The benchmark asks how a local Gemma 2:2B model behaves when one article is transformed into concise and atomized content assets. It contributes evidence about latency, throughput, output volume, input-length effects, and local resource demand. It does not establish factual quality against human references, validate the application scheduler, or compare InkKnits with another product.

## 3. Dataset Description

The source file contains one `Article` column and 11,992 article bodies. No reliable title or reference-summary column exists. The cleaned dataset preserves original and cleaned text, stable IDs, counts, flags, duplicate status, and quality status. Cleaning strips surrounding whitespace and applies only a conservative reversible mojibake repair; questionable content is flagged rather than rewritten.

There is one exact duplicate pair, represented by two questionable retained records. Both duplicate IDs were excluded from the benchmark sample. The 45-article sample has 45 unique IDs and is stratified by actual word-count groups: 11 short, 11 medium, 12 long, and 11 very long. The seed is `20261108`. Dataset limitations include absent provenance metadata, absent human references, and a sample that is small relative to the full corpus.

## 4. Experimental Environment

The experiment ran on Windows 11 with Python 3.13.5, local Ollama, and the installed `gemma2:2b` model. Ollama reported Gemma 2, approximately 2.6B parameters, GGUF Q4_0 quantization, and an 8192 context length. The endpoint was `http://127.0.0.1:11434`. Generation parameters were temperature `0.2` and requested context `8192`.

The benchmark used direct Ollama HTTP calls. It bypassed the authenticated FastAPI application and its `asyncio.PriorityQueue` scheduler. Queue waiting is therefore recorded as `0.0`, not as a scheduler performance measurement. CPU, RAM, GPU utilization, and VRAM were sampled by a background monitor at a nominal 0.25-second interval. Metrics unavailable in any environment are retained as null rather than replaced by zero.

## 5. Experimental Methodology

Each selected article was sent through four operations:

1. **Summarization:** one prompt asks for a concise summary preserving the main event, entities, and central information.
2. **Shortening:** one prompt requests approximately 50% of the source word count while preserving meaning and facts.
3. **Atomization with two children:** two separate model calls generate a LinkedIn post and a short newsletter section.
4. **Atomization with five children:** five separate model calls generate LinkedIn, newsletter, X/Twitter-style, blog introduction, and promotional-description outputs.

A complete atomization is successful only when every requested child call returns non-empty output. Exact prompts and child outputs are retained in the result CSV/JSONL for the full run.

## 6. Metric Definitions

- **Latency:** wall-clock seconds for one direct Ollama HTTP request, or the sum of child request times for an atomization observation.
- **Mean:** arithmetic average latency; sensitive to slow outliers.
- **Median:** middle latency; more robust to skew.
- **Standard deviation:** spread around the mean in seconds.
- **IQR:** the interval between the 25th and 75th percentiles.
- **Throughput:** successful observations divided by total processing seconds, expressed as completed observations per minute.
- **Compression ratio:** output words divided by input words. Lower values indicate stronger shortening, but not necessarily better quality.
- **Output-count compliance:** complete atomization observations divided by requested atomization observations.
- **Lexical overlap proxy:** source tokens also appearing in the output, excluding no verified semantic judgment. It is not factual consistency or relevance ground truth.
- **Bootstrap interval:** a resampling-based 95% interval around a latency mean. It is an estimate, not a guarantee about future runs.

## 7. Results

| Operation | N | Success | Mean s | Median s | SD s | P95 s | Throughput/min |
|---|---:|---:|---:|---:|---:|---:|---:|
| Summarization | 45 | 45 | 5.03 | 4.22 | 2.57 | 10.13 | 11.92 |
| Shortening | 45 | 45 | 6.58 | 6.26 | 2.92 | 10.04 | 9.12 |
| Atomization, 2 | 45 | 45 | 14.61 | 13.10 | 6.20 | 24.63 | 4.11 |
| Atomization, 5 | 45 | 45 | 28.88 | 24.09 | 12.85 | 54.18 | 2.08 |

Five-output atomization took a mean 14.28 seconds longer than two-output atomization in paired article comparisons; the bootstrap 95% interval for this difference was 12.18 to 16.54 seconds. This is expected to reflect five model calls versus two, and should not be interpreted as a per-call model slowdown.

Mean output volume was approximately 143 words for summarization, 212 for shortening, 450 for two-output atomization, and 883 for five-output atomization. The five-output mean is larger because it contains five derivative assets, not because it is a directly comparable summary.

Resource measurements were actual samples: mean CPU 20.5%, peak CPU 84%; mean RAM utilization 90.1%, peak 99.9%; mean GPU utilization 89.7%, peak 100%; mean VRAM use approximately 2.51 GiB, peak approximately 2.55 GiB. Resource values describe the entire direct benchmark timeline and are not scheduler-specific.

## 8. Statistical Analysis

The 45 articles are paired across all operations. Paired bootstrap intervals were computed for latency differences. For shortening minus summarization, the mean paired difference was 1.55 seconds with a bootstrap 95% interval of 0.92 to 2.29 seconds. Formal Wilcoxon signed-rank tests were not run because SciPy was not installed; no p-values are claimed. Multiple-comparison correction is therefore not applicable.

The sample supports descriptive paired comparisons but is not large enough to establish broad model or product claims. The article sample is stratified rather than naturally representative, and latency is affected by local machine state and model warm-up.

## 9. Chart Interpretation Guide

- **Figure 1:** shows the full cleaned corpus word-count distribution. It documents the long right tail and does not describe model outputs.
- **Figure 2:** shows mutually exclusive length groups with counts and percentages summing to all records.
- **Figure 3:** reconciles valid unique and questionable duplicate records.
- **Figure 4:** compares means and medians; atomization totals include multiple child calls.
- **Figure 5:** shows latency spread and visible outliers; no observations are removed.
- **Figure 6:** compares total two-child and five-child atomization time, not equivalent single-call workloads.
- **Figures 7-9:** show continuously sampled local resource behavior over elapsed benchmark time.
- **Figures 10-11:** show input-length relationships; they are descriptive scatter plots, not causal models.
- **Figure 12:** compares compression only for summarization and shortening.
- **Figure 13:** shows complete requested-child compliance.
- **Figure 14:** reports completed observations per minute, not GPU throughput or scheduler throughput.
- **Figure 15:** shows lexical retention as an automated proxy, not human quality.

## 10. Research Findings

1. All 405 direct local model calls completed successfully in this run.
2. Five-output atomization required approximately twice the total latency of two-output atomization, consistent with five versus two calls.
3. Atomization increases output volume because it requests multiple assets; its total output should not be compared to a single summary as though they were the same task.
4. Latency is variable, with visible long-tail behavior and higher spread for five-output atomization.
5. The local GPU remained highly utilized during the measured run, while VRAM stayed near 2.5 GiB.
6. Input length and output behavior should be interpreted descriptively because this sample is stratified and the model has one fixed configuration.

## 11. Limitations

The text experiment uses one model, one local machine, one temperature, and one 45-article sample. It has no verified human summaries, so ROUGE and BERTScore are intentionally absent. Lexical overlap is only a proxy. Direct Ollama calls bypass the InkKnits scheduler, so queue ordering, concurrency, persistence, and scheduler fairness were not tested by this experiment. Image generation was measured separately through the direct ComfyUI integration (Section 15), not through the application scheduler. Formal nonparametric tests were unavailable in the installed environment. Each component study is one run and does not quantify run-to-run variance.

## 12. Implications for InkKnits

The results support the practical observation that atomization cost grows with the number of requested child assets. They provide local workload evidence relevant to resource-aware orchestration, but they do not validate the production scheduler itself. A future scheduler experiment should submit equivalent jobs through the FastAPI application and separately measure queue wait, execution, persistence, cancellation, and priority behavior.

## 13. Future Experiments

Future work should benchmark the actual InkKnits scheduler under concurrent requests, repeat the fixed sample across multiple runs, compare additional local models, expand the sample, conduct human ratings, and measure image-generation jobs separately. A verified reference set would enable stronger quality metrics. Scheduler tests should preserve the same run-level traceability used here.

## 14. Paper-Ready Conclusions

On a local Windows workstation using Gemma 2:2B, InkKnits content transformations completed 405 direct model calls across 45 paired articles without observed call failures. Mean latency increased from 5.03 seconds for summarization to 28.88 seconds for five-output atomization, while five-output atomization produced more content and required more model calls. These observations characterize one local model configuration and support workload-aware orchestration considerations; they do not establish scheduler performance, factual quality, or superiority over competing systems.

## 15. Separate Image-Generation Experiment

The complementary image benchmark is implemented separately in `research/image_benchmark.py` and targets the existing ComfyUI workflow in `backend/final4.json`. The verified workflow uses `epicrealism_naturalSinRC1VAE.safetensors`, 512x512 images, batch size 1, 28 primary steps, CFG 7.5, `dpmpp_2m`, `karras`, and a 15-step refinement node. It uses the same 45 article IDs and deterministic article-derived seeds, but it does not alter the text benchmark.

The initial image smoke run was blocked because ComfyUI was unavailable, and it remains preserved. After ComfyUI became available, smoke run `image-smoke2-20261108T130922Z-dc97cd1e` succeeded, followed by full run `image-full-20261108T131126Z-c4c3d9e4`: 45/45 sequential requests succeeded. Mean generation time was 13.814 seconds, median 14.067 seconds, p95 14.137 seconds, and throughput 4.343 completed images per minute. All saved outputs were valid 768x768 PNGs because the unchanged workflow applies a 1.5x latent upscale to the 512x512 input. Queue wait remained unavailable from the ComfyUI history API. No human image-quality evaluation was completed. See `IMAGE_GENERATION_METHODOLOGY.md`, `IMAGE_GENERATION_RESULTS.md`, and `IMAGE_GENERATION_AUDIT.md`.

## 16. Application-Level Access Evaluation (Preliminary)

The application experiment submits authenticated jobs to `/ai/jobs`, polls the app scheduler, and checks result assets through the asset API. The Cloudflare hostname routes to the same laptop-hosted application, database, Ollama model, ComfyUI service, and storage. It is an access-path test, not cloud inference or geographically remote-client testing.

**Completed smoke evidence.** A local application smoke run `app-20261112T125418Z-135fc2ee` completed 5/5 requests in 62.03 seconds (four text operations on one article and one seeded image request), with all result assets fetched and verified. Separate authenticated smoke requests through the Cloudflare hostname completed one text and one image job; their assets were fetched at the time. The image output was a readable PNG stored beneath the benchmark project's storage directory. Current task re-queries no longer resolve every historical Cloudflare task ID, so those smoke checks are historical request-time evidence, not currently replayable jobs. Task IDs and asset IDs are recorded in `research/cloudflare_benchmark/results/smoke_validation.json`.

**Interrupted local condition.** Run `app-20261112T125600Z-870967b9-local` recorded 59 of 225 planned requests over 1,099.29 seconds through its last checkpoint. It contains 47 successful requests whose result assets were verified and 12 HTTP 422 failures before job creation. All 12 failures occurred on summarization/shortening requests for longer source articles because the runner placed the full article in the API's 12,000-character-limited `prompt` field. The recorded operation counts are: summarization 9/15 successful, shortening 9/15, two-output atomization 15/15, and five-output atomization 14/14; no image requests were reached. The run is incomplete, local-only, and not paired with Cloudflare. Do not treat its operation means as a complete workload comparison. Raw records are retained locally; the sanitized 59-row derivative is `research/cloudflare_benchmark/results/application_partial_records_sanitized.csv`.

Among the 47 successful partial-run requests, client-observed mean elapsed times were 4.304 s for summarization (n=9), 10.796 s for shortening (n=9), 16.838 s for two-output atomization (n=15), and 50.550 s for five-output atomization (n=14). These values include application polling and verified asset retrieval and are incomplete, order-dependent observations; they are not comparable to direct component latency as if paired. The 920 system/resource samples collected through the last checkpoint averaged 19.18% CPU, 92.22% RAM, 82.34% GPU utilization, and 65.80% VRAM utilization. They describe only the partial run interval.

No independent network bandwidth test was run. Local and Cloudflare TCP connection measurements are retained in run metadata where available; they are not end-to-end application latency or bandwidth. There are no matched full conditions, so no local-versus-Cloudflare latency delta, statistical comparison, or tunnel-overhead claim is reported. The recovery record `research/cloudflare_benchmark/logs/scheduler_recovery_20261112T124844Z.json` documents 14 stale benchmark-project tasks terminalized as failed after the scheduler process restart; no retries were performed. An older stale task belonging to another project was excluded.

## 17. Reproducibility and Submission Boundaries

The direct component runs are reproduced with the scripts and exact manifests already in this repository. The source sample is `datasets/benchmark_sample.csv` (45 IDs, seed `20261108`); the image prompt/seed input is `datasets/results/image_generation_prompts.csv`. The completed direct results remain in `datasets/results/` and are not overwritten. Figures and chart data are under `research/figures/publication/` and `research/figures/image_generation/`; PNG exports are 300 DPI, with SVG/PDF companions.

The application benchmark runner and stale-job recovery utility are in `research/cloudflare_benchmark/scripts/`. The prior full app attempt is preserved as an interrupted local checkpoint. Re-running it requires the benchmark environment variables and a working local backend; a paired Cloudflare run additionally requires the hostname to remain available. No further full image workload is required for this submission. See `FINAL_BENCHMARK_STATUS.md` for actual counts, runtime, push status, and limitations.
