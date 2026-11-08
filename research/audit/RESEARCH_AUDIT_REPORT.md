# Independent Research Results Audit

## Decision

**Ready after minor corrections.** The completed benchmark is internally accounted for and reproducible at the raw-result level, but the original package should not be submitted unchanged. The main required corrections are disclosure of resource-log ordering and monitoring semantics, explicit bootstrap configuration in the manifest, and use of the audit-only chronological resource figures for paper presentation.

No benchmark result, raw result file, sample, or production application file was modified by this audit.

## Experiment Accounting

The full run `full-20261108T110310Z-f766ae7b` was independently filtered from `datasets/results/experiment_results.csv`.

- 45 unique source article IDs were present.
- 180 experiment observations were present.
- 405 model calls were accounted for.
- 315 successful atomization child outputs were accounted for.
- Each operation had 45 observations.
- Every operation used the same 45 article IDs.
- All 180 observations had `status=success`.
- No incomplete, empty, truncation, or timeout flags were set.
- No duplicate experiment IDs or missing sample IDs were found.
- The full-run manifest matched the raw observation and call counts.
- The 12 smoke rows remained outside the full-run filter and did not enter the full-run analysis.

Machine-readable evidence: `accounting_validation.json`.

## Independent Performance Recalculation

The recalculated values match the existing full-run performance table to displayed precision:

| Operation | Mean s | Median s | SD s | Min s | Max s | P25 s | P75 s | P95 s | Total s | Throughput observations/min |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Summarization | 5.032 | 4.219 | 2.568 | 1.180 | 11.436 | 3.214 | 6.539 | 10.126 | 226.421 | 11.925 |
| Shortening | 6.582 | 6.262 | 2.920 | 1.696 | 19.449 | 4.848 | 7.522 | 10.043 | 296.188 | 9.116 |
| Atomization, 2 | 14.606 | 13.096 | 6.201 | 5.514 | 31.791 | 10.002 | 18.269 | 24.631 | 657.252 | 4.108 |
| Atomization, 5 | 28.884 | 24.087 | 12.847 | 10.355 | 63.860 | 19.932 | 34.226 | 54.180 | 1,299.788 | 2.077 |

Throughput is correctly calculated as successful completed **experiment observations** divided by the sum of observation processing seconds, multiplied by 60. It is not model-call throughput, GPU throughput, or production-scheduler throughput. Atomization totals contain multiple sequential model calls and must not be compared with one-call operations without stating the workload difference.

Machine-readable evidence: `recalculated_performance_metrics.json`.

## Atomization Efficiency

The 45 article IDs pair exactly between two-output and five-output atomization.

- Two-output: 90 requested and 90 successful children; 100% compliance.
- Five-output: 225 requested and 225 successful children; 100% compliance.
- Mean total latency: 14.606 s versus 28.884 s.
- Mean paired latency increase: 14.279 s; median paired increase: 11.988 s.
- Mean seconds per successful child: 7.303 s for two-output and 5.777 s for five-output.
- Mean output words: 449.6 versus 883.4 per source article.
- Mean output-volume increase: 433.7 words per source article.

The lower mean seconds per child in the five-output condition does not establish greater efficiency or quality. It is a derived average from a multi-call workload and may reflect model warm state, prompt/output variation, and aggregation. No claim that five outputs are better should be made.

Machine-readable evidence: `paired_atomization_comparison.csv` and `atomization_efficiency.json`.

## Statistical-Method Audit

The original analysis uses 5,000 bootstrap resamples with seed `20261108`, implemented through `random.Random(seed).choices`. For paired comparisons, it first computes one latency difference per article and resamples those 45 paired differences; this preserves the article as the observational unit. It does not treat the 315 child outputs as independent latency observations.

The operation-level latency intervals resample observations within each operation. The paired comparison intervals resample article-level differences. Missing observations would reduce the available paired set, but this run has no missing observations.

Formal Wilcoxon tests were not performed. SciPy was unavailable during the original analysis and remains unavailable in the audit environment. No p-values or significance claims are supported. Multiple-comparison correction is therefore not applicable to the reported bootstrap comparisons.

Required correction: record `bootstrap_iterations=5000`, `bootstrap_seed=20261108`, and the paired-difference resampling unit in the final manifest. The current manifest records the run seed but not the bootstrap-specific settings.

## Resource-Pressure Investigation

The resource monitor captures:

- System-wide CPU and RAM through `psutil`.
- GPU utilization and device memory through `nvidia-smi`.
- No process-specific CPU/RAM attribution.
- VRAM as device-reported `memory.used`, not allocator-reserved memory.

Observed full-run values were 20.5% mean CPU / 84.0% peak, 90.1% mean RAM / 99.9% peak, 89.7% mean GPU / 100% peak, and approximately 2.51 GiB mean VRAM / 2.55 GiB peak. All resource fields were populated for 8,292 samples.

The benchmark did not capture pagefile usage, swap activity, hard faults, commit charge, or historical memory-pressure counters. Therefore, RAM pressure may be a plausible explanation for some latency variation, but paging cannot be verified from the recorded evidence. It must not be claimed as having occurred.

The raw resource file contains out-of-order rows because the monitor thread and the benchmark thread append concurrently. Chronological sorting produces valid nonnegative intervals; the audit-only corrected figures use timestamp-sorted samples. The original figures should not be used for a paper timeline without this correction. Monitoring overhead was not separately measured; repeated `nvidia-smi` subprocess calls and `psutil` sampling may have introduced small overhead that cannot be quantified retrospectively.

Machine-readable evidence: `resource_limitations.json`. Corrected figures: `corrected_figures/`.

## Figure-by-Figure Audit

All 15 original figures have a PNG, SVG, PDF, and plotted-data CSV. The figures are generated from full-run or full-dataset data, not smoke data. The audit verified file presence and representative rendering.

| Figures | Audit result |
|---|---|
| 1-3 | Dataset figures use full cleaned data and mutually exclusive length/quality categories. Counts reconcile. |
| 4-5 | Latency comparisons and distributions use 45 observations per operation. Means and medians are correctly labeled; no confidence interval is visually claimed. |
| 6 | Atomization comparison uses actual full-run values. It compares total seconds and seconds per child; output volume and compliance remain in tables rather than this figure. |
| 7-9 | Original timeline plots are affected by raw row order. Use the audit-only timestamp-sorted replacements in `corrected_figures/`. |
| 10-11 | Scatter plots are descriptive and have units. They do not establish causal relationships. |
| 12 | Compression is limited to summarization and shortening, which is appropriate. |
| 13 | Output compliance uses the correct atomization denominator and is 100% for both configurations. |
| 14 | Throughput is observations/minute, not calls/minute or scheduler throughput; caption this explicitly. |
| 15 | Lexical overlap is an automated proxy, not factual consistency or human quality. |

No pie chart is used in the publication set, so no pie-slice denominator problem was found. All plotted-data CSVs are present. Figure 7-9 chronological corrections are separate and do not overwrite originals.

## Research-Claim Audit

Supported claims include the exact full-run accounting, direct local Gemma latency, output counts, compression/word-count measurements, resource observations, and paired atomization latency differences.

Claims that require correction or careful wording:

1. **Benchmark scope:** “InkKnits was evaluated” can imply application-level evaluation. Replace with “The InkKnits research harness measured direct local Ollama transformations using the configured Gemma model.”
2. **Resource pressure:** high RAM utilization is observed, but paging or memory-induced slowdown is not proven. State that pagefile evidence was not captured.
3. **Input-length effects:** scatter plots show association only. Do not claim that input length caused latency changes without a controlled analysis.
4. **Quality:** lexical overlap, non-emptiness, and compliance are proxies. No factual consistency, relevance, readability, or human evaluation was completed.
5. **Efficiency:** lower seconds per child for five-output atomization is descriptive and not evidence that the five-output workflow is better or more efficient in a production sense.
6. **Scheduler:** direct Ollama calls do not validate priority ordering, queue wait, concurrency, persistence, approval, lineage, or collaboration behavior.
7. **Statistical evidence:** no Wilcoxon p-values or significance claims are available.

## Identified Errors and Corrections

- **Corrected in audit outputs:** resource timeline figures are regenerated from timestamp-sorted samples under `corrected_figures/`.
- **Required paper correction:** identify CPU/RAM as system-wide and VRAM as device-reported used memory.
- **Required manifest correction:** record bootstrap repetitions, bootstrap seed, and resampling unit.
- **Required caption correction:** define throughput as completed experiment observations per minute.
- **No correction required:** accounting, latency values, atomization counts, success rates, and dataset/sample counts reconcile.

## Remaining Limitations

The experiment is one run, one model, one local machine, and a 45-article stratified sample. There are no verified reference summaries, no completed human ratings, no formal paired hypothesis tests, no application-scheduler benchmark, no image-generation benchmark, and no historical paging telemetry. These limitations are material to paper interpretation but do not invalidate the descriptive direct-inference benchmark.
