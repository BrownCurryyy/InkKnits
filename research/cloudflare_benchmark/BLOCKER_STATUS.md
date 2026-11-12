# Cloudflare Benchmark Blocker Status

The benchmark account and isolated project were configured, and authenticated smoke testing was performed. The full supplementary application benchmark remains incomplete.

## Verified conditions

- Local API health was verified on port 8000; the existing backend process was already listening, so a second bind attempt can fail with WinError 10013.
- The only observed Windows excluded TCP range was 50000-50059; port 8000 was not excluded.
- Local Vite-to-API proxy health returned 200.
- The Cloudflare hostname returned varying edge responses during the session (200, 502/530, and a 1010 block); no stable full-condition path was available.
- Benchmark credentials were provided via environment variables, and the isolated benchmark project was verified.
- Fourteen stale benchmark-project tasks were recorded and marked failed after restart; no retries were performed.

## Required precondition

A dedicated benchmark account must be created or provided through environment variables before any application-level benchmark writes are allowed. That account must be an ADMIN-level user for creating a protected benchmark project, and the project must be isolated from normal user data.

## Safety rule

No additional large generation workload should be started for this submission. Existing successful smoke outputs and raw partial records are preserved; the completed direct component experiments are untouched.

## Status

Smoke tests completed through both access paths, but no complete matched Cloudflare application benchmark is available. The sole partial full condition is local-only (59/225, 47 successful, 12 422 failures) and is not a local-versus-Cloudflare comparison.
