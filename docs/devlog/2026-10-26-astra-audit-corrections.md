# 2026-10-26 Astra audit: doc corrections (lane::direct)

**Changed.** Dated "Audit note (2026-10-26)" blocks and corrected figures in README, ARCHITECTURE, SUBMISSION, real-model-results (measured / replayed / pending / not-proven table), capability-status, demo-script, interview-prep, demo-decision-inventory, AI-USAGE, error-analysis-real-run, the nl112-full-run-2 devlog (appended), a dated M-31 clarification line in the metrics registry, resume.md (state, ticket dispositions) and the error-analysis README (audit link). Run reports and old devlog text are untouched.

**Why.** Earlier docs said 40% clean first pass missed the 90% target and that attempt 2 was 0/47 or 47/47 schema-valid. Original outputs show 44/47 (attempt 3) and 11/47 (attempt 2) parse and compile; 19/47 is "no repair needed". The 17 blocks are checker false positives per an offline replay only.

**Checked.** Figures against the audit JSON, the handoff and commits d727537, 42f6989, 18a52cf; grep for the old claims in the edited files. No code, tests or GitLab issues touched.

**Remaining.** Fresh run on the fixed candidate; NL-123, NL-135 blind review, NL-109 re-measure, NL-120 taxonomy; area-map and slice D docs belong to slice D. Old devlogs nl112-full-run(.md, -3) not annotated.
