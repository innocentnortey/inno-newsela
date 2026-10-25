# Workflow updates adopted into Newsela

Written by `adopt_updates.py`; rollback: `python3 ops/vps-run/adopt_updates.py rollback <id>`.

| Release | When (UTC) | Boundary | Pinned file | Basis |
|---|---|---|---|---|
| R-1 | 2026-10-25T11:33:40Z | pre-launch, before Phase A (2026-10-25) | `.claude/rules/fanout-plan-then-implement.md` | HX-R1 transcript evidence (artifacts/2026-10-25-claude-harness-tooling-review.md section 3 C3; SYNC-NOTES section 4, 11:28 UTC): the 2026-10-21 haiku sweeps did run on Haiku; check the served model from transcripts |
| R-2 | 2026-10-25T11:33:40Z | pre-launch, before Phase A (2026-10-25) | `.claude/rules/planning-context-packs.md` | same transcript evidence as R-1 (review section 3 C3), plus: Explore inherits the session model unless model: haiku is set. The evidence-table update still to come is NOT part of this release |
