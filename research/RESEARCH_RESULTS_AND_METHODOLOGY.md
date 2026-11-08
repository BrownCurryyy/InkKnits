# InkKnits Full Benchmark: Results and Methodology

## 1. Executive Summary

InkKnits was evaluated with 45 fixed article IDs sampled from the cleaned 11,992-record dataset. The same articles were used for summarization, shortening, two-output atomization, and five-output atomization. Local Ollama `gemma2:2b` inference produced 180 experiment observations from 405 model calls. All 180 observations completed successfully, and all 315 requested atomization child outputs were produced.

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

The experiment uses one model, one local machine, one temperature, and one 45-article sample. It has no verified human summaries, so ROUGE and BERTScore are intentionally absent. Lexical overlap is only a proxy. Direct Ollama calls bypass the InkKnits scheduler, so queue ordering, concurrency, persistence, and scheduler fairness were not tested. No image generation was measured. Formal nonparametric tests were unavailable in the installed environment. The full run is one repetition and does not quantify run-to-run variance.

## 12. Implications for InkKnits

The results support the practical observation that atomization cost grows with the number of requested child assets. They provide local workload evidence relevant to resource-aware orchestration, but they do not validate the production scheduler itself. A future scheduler experiment should submit equivalent jobs through the FastAPI application and separately measure queue wait, execution, persistence, cancellation, and priority behavior.

## 13. Future Experiments

Future work should benchmark the actual InkKnits scheduler under concurrent requests, repeat the fixed sample across multiple runs, compare additional local models, expand the sample, conduct human ratings, and measure image-generation jobs separately. A verified reference set would enable stronger quality metrics. Scheduler tests should preserve the same run-level traceability used here.

## 14. Paper-Ready Conclusions

On a local Windows workstation using Gemma 2:2B, InkKnits content transformations completed 405 direct model calls across 45 paired articles without observed call failures. Mean latency increased from 5.03 seconds for summarization to 28.88 seconds for five-output atomization, while five-output atomization produced more content and required more model calls. These observations characterize one local model configuration and support workload-aware orchestration considerations; they do not establish scheduler performance, factual quality, or superiority over competing systems.
