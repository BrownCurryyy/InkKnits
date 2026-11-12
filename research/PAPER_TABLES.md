# Paper-Ready Tables

**Scope note:** The tables below separate direct local component measurements from application-path observations. No complete matched local-versus-Cloudflare application benchmark exists; the application rows are preliminary and must not be used to calculate tunnel overhead.

## Dataset Statistics

| Metric | Value |
|---|---:|
| Source records | 11,992 |
| Valid unique records | 11,990 |
| Questionable duplicate records | 2 |
| Exact duplicate pairs | 1 |
| Benchmark articles | 45 |
| Random seed | 20261108 |

## Hardware and Software Environment

| Component | Recorded value |
|---|---|
| OS | Windows 11 |
| Python | 3.13.5 |
| Runtime | Local Ollama HTTP API |
| Model | gemma2:2b |
| Model size | 2.6B parameters |
| Quantization | Q4_0 |
| Context length | 8192 |
| Temperature | 0.2 |
| GPU monitoring | nvidia-smi, repeated samples |

## Benchmark Configuration

| Operation | Calls/article | Articles | Calls | Observations |
|---|---:|---:|---:|---:|
| Summarization | 1 | 45 | 45 | 45 |
| Shortening | 1 | 45 | 45 | 45 |
| Atomization, 2 outputs | 2 | 45 | 90 | 45 |
| Atomization, 5 outputs | 5 | 45 | 225 | 45 |
| **Total** | **9** | **45** | **405** | **180** |

## Performance Metrics

| Operation | Mean s | Median s | SD s | P95 s | Throughput/min |
|---|---:|---:|---:|---:|---:|
| Summarization | 5.03 | 4.22 | 2.57 | 10.13 | 11.92 |
| Shortening | 6.58 | 6.26 | 2.92 | 10.04 | 9.12 |
| Atomization, 2 | 14.61 | 13.10 | 6.20 | 24.63 | 4.11 |
| Atomization, 5 | 28.88 | 24.09 | 12.85 | 54.18 | 2.08 |

## Resource Utilization

| Metric | Mean | Peak |
|---|---:|---:|
| CPU utilization | 20.5% | 84.0% |
| RAM utilization | 90.1% | 99.9% |
| GPU utilization | 89.7% | 100.0% |
| VRAM usage | 2.51 GiB | 2.55 GiB |
| Resource samples | 8,292 | interval 0.25 s |

## Atomization Comparison

| Operation | Requested outputs | Successful outputs | Mean total s | Mean output words |
|---|---:|---:|---:|---:|
| Atomization, 2 | 90 | 90 | 14.61 | 449.6 |
| Atomization, 5 | 225 | 225 | 28.88 | 883.4 |

## Quality Proxy Metrics

Quality outputs use lexical overlap, non-emptiness, output-count compliance, and compression. They are automated proxies, not human judgments or reference-based scores. See `research/tables/quality_proxy_metrics.csv`.

## Statistical Comparisons

| Paired comparison | N | Mean difference s | Median difference s | Bootstrap 95% interval |
|---|---:|---:|---:|---:|
| Atomization 5 - Atomization 2 | 45 | 14.28 | 11.99 | [12.18, 16.54] |
| Shortening - Summarization | 45 | 1.55 | 1.25 | [0.92, 2.29] |

Wilcoxon tests were not run because SciPy was unavailable; no p-values are reported.

## Limitations

| Limitation | Consequence |
|---|---|
| Single model/configuration | Results are not model-general |
| 45-article sample | Descriptive evidence only |
| No verified references | No ROUGE/BERTScore |
| Direct Ollama path | Production scheduler not tested |
| One full run | Run-to-run variance unknown |
| Local hardware | Results are environment-dependent |

## Separate Direct Image-Pipeline Experiment

| Metric | Measured value |
|---|---:|
| Run | `image-full-20261108T131126Z-c4c3d9e4` |
| Sequential image requests | 45 |
| Successes / failures | 45 / 0 |
| Mean latency | 13.814 s |
| Median latency | 14.067 s |
| Standard deviation | 0.554 s |
| P95 latency | 14.137 s |
| Throughput | 4.343 images/min |
| Final dimensions | 768 x 768 px |
| Mean file size | 859,758 bytes |
| Queue wait | Unavailable from ComfyUI history API |
| Human quality rating | Not performed |

These are direct sequential ComfyUI pipeline measurements, not InkKnits scheduler performance or a Cloudflare comparison.

## Application-Level Evaluation (Incomplete)

| Condition | Planned | Recorded | Successful / failed | Runtime through last checkpoint | Interpretation |
|---|---:|---:|---:|---:|---|
| Local application smoke `app-20261112T125418Z-135fc2ee` | 5 | 5 | 5 / 0 | 62.03 s | One article, four text operations and one image; result assets verified |
| Cloudflare authenticated smoke | 2 | 2 | 2 / 0 | Not retained | One text and one image; result assets were fetched at request time |
| Local application partial `app-20261112T125600Z-870967b9` | 225 | 59 | 47 / 12 | 1,099.29 s | Interrupted before images; 12 requests rejected with HTTP 422 |
| Full matched local-vs-Cloudflare run | 225 per route | 0 matched full requests | N/A | Not run | No comparison or tunnel-overhead estimate is valid |

### Local Partial Operation Counts

| Operation | Recorded | Successful | Failed | Mean elapsed among successes |
|---|---:|---:|---:|---:|
| Summarization | 15 | 9 | 6 | 4.304 s |
| Shortening | 15 | 9 | 6 | 10.796 s |
| Atomization, 2 | 15 | 15 | 0 | 16.838 s |
| Atomization, 5 | 14 | 14 | 0 | 50.550 s |

The 12 request failures were API validation errors because the runner sent article text inside a `prompt` field limited to 12,000 characters. These successful-only means are incomplete and order-dependent; they are not paired with the direct component results. The partial run produced no image measurements.

## Automated Proxy Averages

| Direct text operation | Mean lexical overlap | Mean output/input word ratio | Output-count compliant |
|---|---:|---:|---:|
| Summarization | 0.1031 | 0.1574 | 45/45 |
| Shortening | 0.1587 | 0.2463 | 45/45 |
| Atomization, 2 | 0.2027 | 0.5364 | 45/45 |
| Atomization, 5 | 0.2589 | 1.0150 | 45/45 |

Lexical overlap and compression are descriptive automated proxies only; neither validates factual correctness, relevance, or editorial quality.
