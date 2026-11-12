# Cloudflare Tunnel Application Benchmark

This directory contains the supplementary application-level local/API and Cloudflare Tunnel evaluation. It is an extension of the direct component studies, not a replacement.

## Current status

The benchmark project and account were configured, and authenticated smoke generation completed through both routes. A local-only full condition was interrupted after 59 of 225 requests. A complete matched local-versus-Cloudflare application benchmark was not completed; the Cloudflare output directory is empty.

## Required environment variables

The environment must provide, at minimum, one benchmark user with the ability to create an isolated project and one benchmark project ID.

Examples of expected names:

- `INKKNITS_BENCHMARK_EMAIL`
- `INKKNITS_BENCHMARK_PASSWORD`
- `INKKNITS_BENCHMARK_PROJECT_ID`

Do not hardcode credentials in scripts, reports, or CSV files.

## Verified routing constraints

- The frontend API base defaults to the current origin for non-localhost hosts.
- The Cloudflare-served frontend and local frontend both call the same relative AI job routes: `/ai/jobs`, `/ai/jobs/{id}`, `/assets/{id}`.
- Unauthenticated generation-route probes return `401`, which is expected before login.
- Ollama and ComfyUI remain local-only; they are not directly exposed to the internet.

## Important note

This is an access-path comparison on the same physical laptop, not a geographically remote-client benchmark. Cloudflare Tunnel is the remote access path to the same local application, AI services, and hardware.

## Verified status and limitations

- The benchmark project is `ffd0cf00-24f8-46e8-82a8-85efd13b2ffe`; do not store credentials in this repository.
- The completed local smoke runner recorded 5/5 requests in 62.03 seconds with persisted outputs.
- Two authenticated Cloudflare smoke jobs (one text, one image) completed and their assets were fetched at request time. Later re-query of historical Cloudflare tasks was not consistently available.
- The local partial condition recorded 59/225 requests: 47 successful with verified persistence and 12 HTTP 422 errors caused by the runner putting long source text in the size-limited prompt field. No image requests were reached.
- Fourteen stale rows in the benchmark project were snapshotted and terminalized as failed after the scheduler process restart. No jobs were retried; an older row in another project was not touched.
- Do not calculate local-versus-Cloudflare deltas from smoke or unpaired partial records.
- Cloudflare Tunnel was an access path to services on the same laptop, not cloud inference or a remote-geography test. No independent bandwidth measurement was made.

See `../RESEARCH_RESULTS_AND_METHODOLOGY.md` and `../FINAL_BENCHMARK_STATUS.md` for the detailed results and submission boundary.

## Reproducibility

The authoritative component datasets and outputs remain in `datasets/` and are not rewritten by the application runner. The application input sample is `datasets/benchmark_sample.csv`; the image prompt and deterministic seed list is `datasets/results/image_generation_prompts.csv`. The text sample SHA-256 is `95855c3aac77e7d86995cf5c04a05c4fd47375659607c354f5b988f9b4dd9cd0`.

Use the development environment only. Set `INKKNITS_BENCHMARK_EMAIL`, `INKKNITS_BENCHMARK_PASSWORD`, and `INKKNITS_BENCHMARK_PROJECT_ID` in the shell; do not put their values in files. Start the existing FastAPI app and Vite frontend with the repository's local development settings. A bounded local smoke invocation from the repository root is:

```powershell
& 'backend/.venv/Scripts/python.exe' research/cloudflare_benchmark/scripts/cloudflare_app_benchmark.py --smoke --local-only
```

For a Cloudflare smoke, first verify that the hostname is reachable and authenticated, then use `--smoke --cloudflare-only`. The default mode is intentionally not shown here because it submits 225 requests per access condition, including 45 image generations. Every request is checkpointed into a unique run directory; raw records that contain article text are excluded from Git, while sanitized summaries are tracked. The full application condition remains incomplete and is not required for reproducing the completed component studies.

To inspect stale persisted jobs, run `scripts/reconcile_stale_jobs.py` without `--apply` first. The tool refuses to act unless the live scheduler is idle, scopes to the benchmark project, writes a pre-change snapshot, and never retries jobs. Only use `--apply` for tasks known to be orphaned after a process restart.
