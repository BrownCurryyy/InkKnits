# InkKnits Research Findings Summary

This document summarizes separate direct-model studies and a preliminary, incomplete application-access evaluation. The direct component results are the primary completed text benchmark; application-path observations are not interchangeable with them.

## What We Built

A reproducible local benchmark for InkKnits content transformations. It preserves raw experiment rows, prompts, child outputs, model metadata, resource samples, hashes, and run configuration.

## What We Tested

Forty-five fixed article IDs were processed with local Ollama `gemma2:2b` for summarization, shortening, two-child atomization, and five-child atomization. The same articles were used across all four operations.

## Why This Dataset

The dataset contains 11,992 article bodies with no dependable titles or reference summaries. It provides varied real article lengths for measuring input-size and workload behavior, while requiring honest proxy quality evaluation.

## Main Findings

1. The full run completed 405 direct model calls and 180 observations without failures.
2. Mean latency was 5.03 s for summarization and 6.58 s for shortening.
3. Two-child atomization averaged 14.61 s; five-child atomization averaged 28.88 s.
4. All 315 requested atomization outputs were produced.
5. Five-child atomization generated approximately 883 output words per observation versus 450 for two-child atomization.
6. GPU utilization averaged 89.7% and peaked at 100%; VRAM averaged approximately 2.51 GiB.
7. Latency was variable, especially for five-child atomization, whose standard deviation was 12.85 s.
8. Lexical overlap and output compliance are automated proxies, not proof of factual accuracy or editorial quality.

## What the Charts Demonstrate

The figures show corpus length distribution, quality counts, operation latency, atomization workload differences, local resource behavior, input/output relationships, compression, compliance, throughput, and lexical-retention proxies. All are generated from actual CSV records and have underlying plotted-data CSV files.

## Important Limitations

This is one model, one local machine, one full run, and a 45-article stratified sample. Human evaluation and verified reference summaries are absent. The direct Ollama path bypasses the production scheduler, so these results do not measure queue priority, persistence, cancellation, or concurrency behavior.

## What the Results Prove

They provide reproducible measurements of direct Gemma 2:2B transformation latency, output volume, atomization completion, and local resource behavior for this sample and environment.

## What the Results Do Not Prove

They do not prove superior content quality, factual consistency, general performance across models or machines, production scheduler performance, or superiority over Adobe, Jasper, Bynder, or other systems.

## Image Benchmark Extension

The complementary ComfyUI image benchmark used the same 45 article IDs. After an initial blocked smoke attempt, the successful run generated 45/45 valid 768x768 PNGs using the configured `epicrealism_naturalSinRC1VAE.safetensors` workflow. Mean generation time was 13.814 seconds, median 14.067 seconds, and p95 14.137 seconds. GPU utilization averaged 90.27%, with mean VRAM use of approximately 2.60 GB. Queue wait was unavailable from the ComfyUI history API. These are direct sequential image-pipeline measurements, not application scheduler or visual-quality claims.

## Application Evaluation: Preliminary Only

- Local application smoke run `app-20261112T125418Z-135fc2ee` completed 5/5 requests in 62.03 seconds. It used one article for the four text operations and one 512x512 image request; result assets were verified in the isolated benchmark project.
- Two authenticated requests through the Cloudflare hostname (one text, one image) completed and their assets were fetched at the time. Historical Cloudflare task re-queries are no longer consistently available, so the task IDs and request-time asset verification are recorded as smoke evidence, not a durable paired dataset.
- A later local-only full condition stopped after 59/225 request records over 1,099.29 seconds: 47 successful with persisted outputs and 12 HTTP 422 submission failures. All failures were summarization/shortening prompts that exceeded the API's 12,000-character prompt limit. No image requests were reached.
- The partial app run is not paired with Cloudflare and its successful-only means must not be interpreted as a full workload result or compared against direct Ollama timings.
- The 920 resource samples through the partial-run checkpoint averaged 19.18% CPU, 92.22% RAM, 82.34% GPU utilization, and 65.80% VRAM utilization. These are partial, system-wide/device samples, not scheduler capacity measurements.
- Fourteen stale task rows in the benchmark project were snapshotted and marked failed after restart because the in-memory scheduler was empty. No retries were made; one stale row belonging to another project was left untouched.

Cloudflare Tunnel exposes the same laptop-hosted app, model, image pipeline, and storage. It is not cloud compute or geographic remote-client testing. No complete matched local-versus-Cloudflare result exists, and no tunnel-overhead claim is supported.

## Submission Boundary

The completed text and direct image experiments support descriptive claims about these local configurations and samples only. They do not establish human-rated quality, factual accuracy, production scheduler performance, multi-user scalability, cloud-hosted inference, or superiority over other platforms. See `FINAL_BENCHMARK_STATUS.md` for the execution record and push status.
