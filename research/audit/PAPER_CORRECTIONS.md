# Paper Corrections

These corrections apply to paper prose, captions, and methods. They do not alter the original benchmark outputs.

## Scope and System Claims

**Avoid:**

> InkKnits was evaluated and demonstrated scheduler-aware collaborative multimedia production.

**Use:**

> The InkKnits research harness measured direct local Ollama transformations using Gemma 2:2B on a fixed 45-article sample. This experiment characterizes model-request latency, output volume, atomization completion, and local resource observations; it does not benchmark the production application scheduler or collaborative workflow features.

## Throughput Definition

**Use:**

> Throughput is reported as successful experiment observations per summed observation-processing minute. For atomization, one observation contains two or five sequential model calls. Therefore the values are not model-call throughput and must not be interpreted as scheduler or GPU throughput.

## Resource Measurements

**Use:**

> CPU and RAM values are system-wide measurements from `psutil`. GPU utilization and device memory are queried through `nvidia-smi`; VRAM is device-reported `memory.used`, not process allocator reservation. Historical pagefile, swap, and hard-fault counters were not captured, so paging and memory-induced latency effects cannot be established.

## Monitoring Timeline

Use the audit-only chronological resource figures, not the original order-dependent timeline figures:

- `research/audit/corrected_figures/figure_07_gpu_utilization_chronological.*`
- `research/audit/corrected_figures/figure_08_vram_utilization_chronological.*`
- `research/audit/corrected_figures/figure_09_cpu_ram_chronological.*`

Caption wording:

> Resource traces are plotted after timestamp sorting from 8,292 system/device samples collected during the direct benchmark. A rolling mean is shown only for GPU readability; raw samples remain in the audit source log.

## Statistical Methods

**Use:**

> Paired bootstrap intervals used 5,000 resamples with seed 20261108. For operation-level latency intervals, the resampling unit was an observation. For operation comparisons, one difference was computed per paired article ID and those 45 article-level differences were resampled. Wilcoxon signed-rank tests were not performed because SciPy was unavailable; no p-values are reported.

Add the bootstrap settings to the final experiment manifest before submission.

## Atomization Interpretation

**Avoid:**

> Five-output atomization is more efficient and better than two-output atomization.

**Use:**

> Five-output atomization produced 1.97 times the mean output-word volume and required a mean 14.28 additional seconds per paired article relative to two-output atomization. Mean seconds per successful child was lower in the five-output condition, but this derived ratio is descriptive and does not establish better content quality or production efficiency.

## Quality Claims

**Use:**

> Because verified human reference summaries were unavailable, no ROUGE or BERTScore results are reported. Lexical overlap, non-emptiness, output-count compliance, and compression are automated proxies only; they do not establish factual consistency, relevance, readability, or human preference.

## Input-Length Claims

**Avoid:**

> Longer inputs caused higher latency.

**Use:**

> The benchmark includes descriptive input-length versus latency plots. Because the sample is stratified and the experiment does not isolate input length from output behavior and local machine state, these plots do not establish a causal input-length effect.

## Figure 14 Caption

> Throughput of completed experiment observations per minute, calculated from successful observations divided by summed observation-processing time. Atomization observations contain multiple model calls.

## Paper Readiness

The benchmark is suitable for paper drafting after these wording and figure-selection corrections. It is not sufficient to support claims about production scheduler performance, collaborative approval, version lineage, or generalized model superiority.
