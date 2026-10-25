# Capability status — what a user can actually do

Updated 2026-10-25 (main after NL-71 + first connected run). A ticket merging is **implementation** progress. A capability counts as **usable** only when a user can reach it through the intended action **and** its browser test passes on the connected stack (real routes, not only the Prism mock). Until the integration tickets run, no row below is "usable"; the columns say how far each is.

Columns: **Built** (code merged) · **Tested on mock** (Playwright + axe against Prism) · **Reachable** (a user action leads to it in the app) · **Connected** (passes on the real stack).

| Capability (who can do what) | Screens / tickets | Built | Tested on mock | Reachable | Connected |
|---|---|---|---|---|---|
| A staff member signs in | SCR-1 NL-24, CON-1 NL-90 | yes | yes | yes | **YES, verified 2026-10-25**: 22/22 real-stack specs (`playwright.real.config.ts`, real `next start`, Postgres 55440): listed staff sign in with an HttpOnly Strict cookie, one session and one audit event per role; unknown email refused `NOT_ON_ALLOW_LIST` with nothing written; wrong password waits ≥ 900 ms, `INVALID_CREDENTIALS`; foreign Origin refused; tampered cookie `UNAUTHENTICATED`; sign out / expiry / sign in lands on `next`; axe 0 serious/critical; log `evidence-con-1-real-stack-2026-10-25.log` |
| A reviewer sees their units and uploads an outline | SCR-2/3 NL-55/56, NL-93 cp1 | yes | yes | yes | **upload verified 2026-10-25**: 15/15 real-stack specs (`e2e/integration/con-2`): upload twice is idempotent (2 versions, same hash, no changed lessons), 4 bad-file refusals leave no rows, issued-sheet normalizer counts 41/6/7, author-only upload (reviewer/approver see no upload control, direct call `ROLE_FORBIDDEN`), audit and R-54/GR-13/GR-9/OBS-7 obligations. **Not yet verified:** link import (needs Sheets base-URL seam), the Running/Complete pill (needs the worker claim loop, S-8) |
| A reviewer reads the validation report and starts a run | SCR-4/5 NL-57/58 | yes | yes | yes | no (NL-94/95) |
| A reviewer watches a run and reads the unit plan | SCR-6/7 NL-59/60 | yes | yes | yes | no (NL-96) |
| A reviewer sees the lesson board | SCR-8 NL-61 | yes | yes | yes | no (NL-98) |
| A reviewer reads a lesson with its evidence rail | SCR-9 NL-62 | yes | yes | yes | no (NL-113) |
| A reviewer edits a lesson live with others | SCR-9 NL-63 + S-17 | yes | yes | yes | no (NL-105 collab commands, NL-113) |
| A reviewer submits, withdraws, regenerates, confirms or removes a standard | SCR-9 NL-64 | yes | yes | yes | no (NL-114/115/113) |
| A reviewer resolves an issue or clears a safety flag | SCR-11 NL-66 | yes (dialog) | yes | **no**: the dialog is not mounted (S-22; mount is NL-113) | no |
| A reviewer inserts a quote or excerpt into a slot | SCR-10 NL-65 | yes (dialog) | yes | **no**: not mounted (NL-113) | no |
| An approver approves a lesson | SCR-14 NL-68 | yes | yes | yes (board row, approver, submitted) | no (NL-115) |
| An approver sends a lesson back or reopens it | SCR-15 NL-69 via NL-68 card | yes | dialog harness yes; card-to-dialog browser test **missing** (planned in the CHG-3 slice, NL-115 AC-16) | yes | no |
| A reviewer compares a regenerated candidate and adopts it | SCR-12 NL-67 | yes | yes | yes (regenerate panel) | no (NL-114) |
| A staff member reads a lesson's version history | SCR-16 NL-70 | yes | yes | yes (action bar) | no (NL-100) |
| A staff member reads a run summary | SCR-17 NL-71 | yes | yes | yes (board links row, rail) | no (NL-97) |
| AI assist, coverage, unit quality, export, prompt guidance screens | SCR-13, 18–21 | not built (cuttable) | – | – | – |

Backend capabilities (generation pipeline, checks, spend ledger, collaboration server, review services) are merged with their own unit and DB tests; none has been shown end to end yet. See `docs/plans/merged.txt` and `docs/plans/seam-followups.md` (S-1…S-24) for the known gaps.
