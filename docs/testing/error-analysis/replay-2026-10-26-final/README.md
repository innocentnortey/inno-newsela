# Final offline replay, 2026-10-26 (reanalysis of stored drafts, no model call)

Read [`replay-final-report.md`](replay-final-report.md) first. It re-checks the 47 stored attempt-3 drafts (written under the OLD prompt) with the code at each commit from base `e7e72a3` to `3bbe94f`. It is a reanalysis, not a forecast and not the run's metric.

- `summary-by-boundary.json`, `provenance-by-run.json`: the numbers and the code/input identities behind the report.
- `boundaries/*.json.gz`: one full result per boundary (gunzip to read). The `msgs-*` runs (rule message text) and the `*.out` logs and helper scripts were left out on purpose.
- Checked before commit: no credentials, no lesson text.
