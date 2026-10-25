# Delivery docs, draft 1 (2026-10-25, lane::direct)

**Changed.** Added `docs/delivery/2026-10-25-demo-decision-inventory.md` (31 rows, ranked, statuses copied from the PRD/spike/devlog record), `docs/delivery/operating-instructions.md`, and `docs/testing/error-analysis/README.md` (the §9 protocol, marked NOT YET RUN). Router row added in `.claude/README.md`.

**Why.** Phase B checkpoint expects these files; the inventory must precede the demo script. Not created: demo-script.md, capacity-report.md, `QA_REPORT.md` (need measurements or walkthroughs).

**Checked.** Commands matched to package.json, script-targets.json, compose files and scripts by reading; nothing was run. Status: proposed. Note: `checkpoint_b.py` looks for the undated `docs/delivery/demo-decision-inventory.md`, not the dated name the framing rule uses; one of them must change before the checker passes.

**Remaining.** Innocent has not read these; rows 2, 6, 7 rest on unread spike results. Re-walk the inventory after the full run, then write the demo script.
