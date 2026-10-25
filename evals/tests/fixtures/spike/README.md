# Spike fixtures (NL-87)

Provenance: trimmed copies of the committed records `docs/analysis/spikes/SP-{1,2,3}-*.md` at main `9951739`:
only the *Results* tables and the pass-line text. Numbers are verbatim; no other prose.

`SP-1-one-call-draft.calls.json` lists the 13 provider calls of the two scored runs (`A-noformat-20261025T121519`,
`B-noformat-20261025T122147`), exported from branch `spike/SP-1`. Export: `git show
spike/SP-1:spikes/sp1/out/<run>/<row>/usage.json` for `unit-plan`, `row08`, `row09`, `row25` (A) and `row08` (B);
each `attempts[]` entry is one call (`request_id`->`call_id`, `wall_ms`->`latency_ms`,
`usage.cache_creation_input_tokens`->`cache_write_tokens`, `usage.cache_read_input_tokens`->`cache_read_tokens`,
`cost_usd_generator`->`cost_usd`).

Contents: numbers and ids only. No model output text, no prompt text, no student data.
