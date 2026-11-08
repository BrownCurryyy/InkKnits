# InkKnits Research Findings Summary

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
