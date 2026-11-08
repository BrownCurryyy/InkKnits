# InkKnits Research Benchmark Report

## Run scope
This report contains only run `full-20261108T110310Z-f766ae7b`. Smoke and full benchmark rows are never aggregated together.

## Dataset and methodology
The source dataset is a single-column collection of article bodies. Cleaning preserved the raw file, assigned stable row IDs, repaired only conservatively reversible mojibake, and retained questionable records with flags. The benchmark uses a fixed stratified sample and fixed random seed recorded in each run metadata file.

## Model and execution
The benchmark calls the configured local Ollama endpoint directly. It does not claim to test the production FastAPI scheduler. Queue waiting is recorded as zero because direct HTTP calls have no InkKnits scheduler queue. Warm-up calls are excluded from measured latency. For direct calls, model execution time is the measured HTTP request elapsed time and total end-to-end time is identical.

## Results
Measured operation rows: 180.

| Operation | N | Success rate | Mean latency (s) | Median latency (s) |
|---|---:|---:|---:|---:|
| summarization | 45 | 1.000 | 5.032 | 4.219 |
| shortening | 45 | 1.000 | 6.582 | 6.262 |
| atomization_2 | 45 | 1.000 | 14.606 | 13.096 |
| atomization_5 | 45 | 1.000 | 28.884 | 24.087 |

## Resources
This run recorded 8292 real resource samples. GPU utilization mean/max were 89.65533043897733%/100.0%, and GPU memory mean/max were 2698198241.744332/2733637632.0 bytes. Continuous background interval sampling was used for this full run. Unavailable metrics are left blank/null, never replaced with zero.

## Quality and limitations
No ROUGE or BERTScore is reported because verified human reference summaries are unavailable. Non-emptiness, output counts, compression, lexical overlap, and distinctness checks are automated proxies only. The optional human evaluation CSV is a template, not completed ground truth. Results must not be interpreted as superiority over competing products.

## Reproducibility
Use the commands in research/README.md. Preserve the run metadata JSON, sample IDs, dataset hash, model metadata, prompts, generation parameters, and environment details with each reported result.
