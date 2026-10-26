# Capability status — what a user can actually do

Updated 2026-10-26 (main 3e5d55a and later). A ticket merging is **implementation** progress. A capability counts as
**usable** only when a user can reach it through the intended action **and** its browser test passes on the connected stack
(real routes, Postgres and, where needed, the collab server and worker; not only the Prism mock).

**Read this honestly:** "Connected" below means the ticket's real-stack Playwright specs (`playwright.real.config.ts`, folder
`apps/web/e2e/integration/con-N`) passed when the ticket merged, as reported in its dev log. They were **not all re-run at
HEAD**. Every connected run used the **stub model provider**: **no capability involving real generation has been shown with a
real model** (NL-109 and NL-112 wait on Innocent's yes to spend; the real-provider smoke is human-run). Human acceptance
(UX-5b, NL-133) has not happened; the walkthrough in `QA_REPORT.md` is an automated agent walkthrough.

Columns: **Built** · **Tested on mock** (Playwright + axe against Prism) · **Reachable** (a user action leads to it) ·
**Connected** (real-stack specs, stub provider, at merge).

| Capability (who can do what) | Screens / tickets | Built | Mock | Reachable | Connected (stub provider) |
|---|---|---|---|---|---|
| A staff member signs in | SCR-1, CON-1 NL-90 | yes | yes | yes | **yes**: 22/22 (`con-1`, evidence `evidence-con-1-real-stack-2026-10-25.log`) |
| A reviewer sees their units, uploads an outline, imports by link | SCR-2/3, CON-2, NL-93 | yes | yes | yes | **yes**: upload 15/15 (`con-2`); link import checkpoints added by NL-93 cp2/3 |
| A reviewer reads the validation report and confirms choices | SCR-4, CON-3 NL-94 | yes | yes | yes | **yes**: 29/29 (`con-3`) |
| A reviewer starts a run and sees the prompt list | SCR-5, CON-5/24 NL-95 | yes | yes | yes | **yes** at merge (`con-5`); two fixme specs remain (SCR-21 list un-fixme'd by GEN-3; reviewer direct-start ruling S-125 note) |
| A reviewer watches progress, pauses, cancels, resumes; reads the unit plan | SCR-6/7, CON-6/7/8 NL-96 | yes | yes | yes | **yes** at merge (`con-6`), after GEN-1 fixed resume and pause reasons; EV-S9 full-run report not run |
| A reviewer sees the lesson board and north-star tile | SCR-8, CON-9 NL-98 | yes | yes | yes | **yes**: 63/63 (`con-9`) |
| A reviewer reads a lesson with its evidence rail and history | SCR-9/16, CON-11 NL-100 | yes | yes | yes | **yes**: 41/41 (`con-11`) |
| Reviewers edit a lesson live together | SCR-9, CON-12 NL-101 | yes | yes | yes | **yes**: 27/27 (`con-12`), session recheck fail-closed |
| A reviewer resolves an issue, clears a safety flag, inserts a quote | SCR-10/11, CON-13/14/15 NL-113 | yes | yes | **yes** (mounted from the issue card, S-22 closed) | **yes** at merge (`con-13/14/15`); S-33 and S-34 fixed in GEN-3 |
| A reviewer regenerates a section or lesson and adopts the candidate | SCR-12, CON-16 NL-114 | yes | yes | yes | **yes**: 51 specs (`con-16`); failed v1 and run settling fixed in GEN-2 |
| A reviewer submits; an approver approves, sends back or reopens | SCR-14/15, CON-18 NL-115 | yes | yes | yes | **yes**: 12/12 transitions + send-back 3/3 (`con-18`), stale-pin and four-eyes refusals |
| A reviewer uses AI assist on a selection | SCR-13, CON-17 NL-116 | yes | yes | yes | **yes** at merge (`con-17`), stub assist only |
| Heartbeats and review minutes; run summary | CON-20 NL-99, SCR-17 NL-97 | yes | yes | yes | **yes** at merge (`con-20`, `con-21`); `reopen-new-row` body written in GEN-3; version id in heartbeat made real in GEN-5 (S-18) |
| An approver exports approved lessons | SCR-20, CON-23 NL-102 | yes | yes | yes (board link) | **yes** at merge (`con-23`); CHG-6 contract drift still open (S-39) |
| A staff member reads coverage, unit quality; edits prompt guidance and trials it | SCR-18/19/21 NL-73/74/76 → NL-117/104/103 | yes | yes | yes | **yes** at merge (`con-22`, `con-10`, `con-24`), screenshots need Innocent's eyes |
| Generation with a **real model** (plan, draft, repair, checks, judge) | worker, NL-79..NL-89, NL-110 | yes | – | – | **no** — never run with a real model; spend needs Innocent's yes (NL-109, NL-112) |
| Capacity at 200 users | NL-118/119/127 | yes | – | – | **partly**: reads met their targets; stored p95 **missed** (6.0 s vs 3 s) — `docs/delivery/capacity-report.md` |

Known open gaps (full list: `docs/plans/seam-followups.md`, `docs/plans/seam-audit-2026-10-26.md`): nav board link hard-coded
(GEN-5), S-29 collab role at connect, Render co-edit needs a collab URL build arg, `no_silent_loss` integrity assertion red
(a keystroke typed as the editor locks is lost, S-125 notes), QA_REPORT findings fixed but not re-walked.
