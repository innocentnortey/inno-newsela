# Submission tracker — Newsela Lesson Studio

Newsela hiring-partner project via Gauntlet AI. Brief: *Lesson Content Generation and
Editing/Approval Workflow* (v1, last updated 2026-10-19; received 2026-10-24), issued copy in
[`docs/source/`](docs/source/). Submission is made from the Gauntlet portal page ("Submit directly
from this page. Your submission is tied to this project version").

Walked row by row by NL-141 on 2026-10-26 at `main` HEAD `5999d9bfd7419b83e1621b1c16ac6f7ed961701e`
(the release SHA is **not cut**; NL-137 cuts it, and this walk must be repeated at that SHA).
Only changes to this file were made; findings are filed below, not patched.

## Open questions for Innocent (NL-143)

1. **Can the reviewers open the private GitLab repo?** Visibility is Innocent's decision and was not changed. The repo is
   recorded private (set private 2026-10-25 before any push, `.claude/rules/gauntlet-gitlab-versioning.md`); the API
   visibility was **not re-read in this walk**. If the portal reviewers have no access, he decides whether to grant it or
   change visibility.
2. **Technical contact.** andrew.parker@newsela.com is named in the brief for questions and link-access problems. **Not emailed**;
   nothing is sent without Innocent's say-so.
3. **Due time.** "Monday night at 3 am" is read as Tue 2026-10-27 03:00 CT. If he meant Mon 2026-10-26 03:00 CT it has passed.
4. **The paid real-model runs have not happened** (NL-109, NL-112; then NL-120, NL-123, NL-124). Until they do, no number in
   the docs comes from a real model, and no real generated unit exists. Needs his yes to spend (and NL-02, the Anthropic limit).
5. **M-24 stored p95 missed** (6,008 ms against < 3 s, n = 22,533, stub provider; `docs/delivery/capacity-report.md`).
   His call: lower the store debounce and re-run (recommended in `.claude/state/resume.md`), relax the target, or accept
   and say so in the video.
6. **Video** (NL-138) is his recording; **submit** (NL-143) is his click. The Render deploy (PD-37 approved) is not provisioned.

## Header

| Field | Value |
|---|---|
| Due | Tue 2026-10-27 03:00 CT (see question 3) |
| Technical contact | andrew.parker@newsela.com (**do not email without Innocent's say-so**) |
| Source repo | GitLab `git@labs.gauntletai.com:innocentnortey/inno-newsela.git` (SSH remote; no web URL recorded). Exists: `git ls-remote origin HEAD` returned `3e5d55ac958b4944626d3528c658bafcd6918386` on 2026-10-26 (two commits behind local `5999d9b`; push is Innocent's/the orchestrator's, not this ticket). Visibility: private as recorded, not re-checked (question 1) |
| Deployed app | **None live.** The demo runs on local Docker Compose (PD-15 option D). `render.yaml` is committed; Render hosting was approved (PD-37) but is **not provisioned**: pending Innocent (`docs/delivery/render-deploy-prompt.md`). Known gap if deployed: no `NEXT_PUBLIC_COLLAB_URL` build arg, so co-editing would fail on Render (seam audit finding 1) |
| Demo video URL | **None yet**: pending NL-138 (Innocent records). Draft script exists: `docs/delivery/demo-script.md` |
| Release SHA | not cut: pending NL-137 |

Status vocabulary: **verified** = a check was run and is named in the row; **implemented** = built and merged, not checked in this
walk (the reports it cites are read, not re-run); **cut #n** = dropped, with the PRD §6.4 sentence; **pending <ticket>** = needs
Innocent or the paid runs.

## Deliverables

| Deliverable | What the brief says | Evidence (opened in this walk) | Status |
|---|---|---|---|
| Source Code | Required. "Clean, well structured architecture." Stack: JavaScript (Next/Node), React, Python if desired; OpenAI or Anthropic APIs; ProseMirror and Yjs for the collaborative editor | GitLab `innocentnortey/inno-newsela` `main` (remote reachable, above); workspaces `apps/`, `packages/`, `evals/`; code map `.claude/reference/area-map.md`. Check run: `npm run typecheck` at HEAD `5999d9b`, clean (no errors, 41 s). Tests, lint and e2e were **not** re-run here | **verified** for type-check only (`npm run typecheck`); everything else **implemented**. Release gate and SHA: pending NL-137 |
| Technical Documentation | Required. No format given | `README.md` (run, Compose, seed, commands, deploy; exists, 116 lines) and `docs/ARCHITECTURE.md` (10 sections, exists). ARCHITECTURE still carries 8 `pending:` markers (NL-112, NL-127, NL-134) and a "draft until NL-139" Limits section; capacity numbers exist in `docs/delivery/capacity-report.md` but are not copied in. README says "Licence: pending NL-139", no `LICENSE` file | **implemented** (draft). Final numbers, limits and licence: pending NL-139 |
| Demo Video | Required. No length given | No video file exists (`docs/artifacts/` holds look sheets and PRD pages only). Draft script `docs/delivery/demo-script.md` (product part under 5 min, then decisions and candour) and `docs/delivery/demo-decision-inventory.md` exist | script **implemented** (draft); video **pending NL-138** |
| AI Usage Documentation | Optional; we include it | docs/AI-USAGE.md (planned file) **does not exist**. Raw material exists: `docs/devlog/` (dated entries) and the decision records in the PRD | **pending NL-139** (finding 1) |

## What each functional requirement must show (from the brief, for the demo and docs)

"Shown by" names a demo chapter in `docs/delivery/demo-script.md` (section 3 "The flow", 0:50 to 4:05, unless noted) or a doc
section in `docs/ARCHITECTURE.md`; all of those headings exist. The video does not exist yet, so every demo reference is a plan.

| Brief requirement | Shown by | Evidence read | Status |
|---|---|---|---|
| Generate a whole unit (~40 lessons) from an uploaded unit-outline Google Sheet | demo section 3; ARCHITECTURE sections 2, 3 | Pipeline, worker and checks merged (`docs/plans/merged.txt`); `docs/delivery/capability-status.md`: run start and run watching are not yet connected-verified; `docs/ux/05-verify/QA_REPORT.md`: stub stack could not generate (F-4, since fixed on a branch and merged per `.claude/state/resume.md`, **not re-walked**). **No real-model unit exists** | **implemented**; real unit pending NL-109, NL-112 |
| Each lesson ~50 min, aligned to the CA Core ELA/ELD standards in the sheet, in Newsela's lesson structure (Launch, Learning In Action, Look Back, …) | demo section 3; ARCHITECTURE sections 2, 6 | Standards resolution, lesson schema and checks merged; integrity suite `evals/reports/integrity-988d2cd73a6a.md` passes 120/120 but on the stub (no model call); draft quality and alignment on real output not measured | **implemented**; quality evidence pending NL-112, NL-120, NL-123 |
| Upload UI to start generation (bonus: editable prompt, live view of generation) | demo section 3; ARCHITECTURE section 3 | Upload: `capability-status.md` records 15/15 real-stack specs (2026-10-25 run, report read, **not re-run here**); validation report, run start and run progress screens built, not connected-verified; link import not yet verified; QA F-1 (blocking: Generate could never enable) fixed after the walk, not re-walked. Prompt editing (SCR-21) built, cut #7 not triggered | **implemented** |
| Persist and track generated lessons for edit → approve → publish | demo section 3; ARCHITECTURE sections 3, 5 | Lessons, versions, states and audit stored in Postgres; export screen (SCR-20) built, so cut #5 did not fire, and publish means a labelled JSON export with no live Newsela integration. Seam audit `docs/plans/seam-audit-2026-10-26.md`: export path clean with a note (CHG-6 open, S-39 drift risk) | **implemented** |
| WYSIWYG review and edit, with AI-assisted tools | demo section 3; ARCHITECTURE section 6 | ProseMirror/Yjs editor and collab server merged; QA walked edit, quote fill, resolve and history through a websocket bridge (Compose editor connection was F-3, since fixed, not re-walked). AI assist SCR-13 built, **not walked** (needs a model). If AI assist is cut at the end, say: "AI help is regenerate-as-candidate only" (PRD §6.4, cut #8) | **implemented**; real-model assist pending NL-112 |
| Approval workflow per lesson within a unit (flag complete) | demo section 3, section 4 (one caught error); ARCHITECTURE section 5 | Approve, send back, reopen built; 120/120 stale-approve cases pass on the stub (`evals/reports/integrity-988d2cd73a6a.md`); QA could not walk approve success or reopen (no lesson without blocking issues), approve-refused crash F-5 fixed since | **implemented**; approve success not walked |
| Async generation (minutes per lesson is fine); rest of workflow performant for 20+ reviewers | ARCHITECTURE section 8; demo section 5b (candour) | `docs/delivery/capacity-report.md` (200 virtual users plus 140 Yjs editors, 19 min, **stub provider**): lesson open p95 23 ms (n = 4,902), board p95 20 ms (n = 20,402), remote edit p95 6.7 ms (n = 44,612), 0 lost acknowledged updates (n = 22,533), **stored p95 6,008 ms against < 3 s: MISSED** (n = 22,533). No generation load (stub run's job failed), synthetic unit, shared machine, not measured on Render. The report was read, not re-run | **implemented**, measured with a **miss**; async generation under load pending NL-112 and the M-24 decision |

### Cut order (PRD §6.4): what the docs and video say for each item

State of each cuttable item from the evidence; the final built-or-cut call is NL-139's, and none of these has run on a real model.

| Cut | Item | State found | What we say |
|---|---|---|---|
| #1 | R-56 Yjs load script | **Not cut**: built and run (`evals/reports/load-2026-10-26.md`, `capacity-report.md`) | report the numbers above, including the M-24 miss |
| #2 | R-23 judge, R-53 held-out comparison | Code and scripts present (`eval:judge-calibrate`, `eval:heldout`); real-model runs pending NL-123, NL-124 | if they do not run: "Alignment is checked by code and confirmed by a named reviewer; no model judge in this build" |
| #3 | R-9 arc checks | not traced in this walk | if cut: "Arc coherence comes from the unit plan; cross-lesson checks are next" |
| #4 | R-41 coverage matrix | **Not cut**: SCR-18 built (QA report; axe clean, page overflows sideways, F-9, fixed on a branch) | no cut sentence needed |
| #5 | R-42 JSON export | **Not cut**: SCR-20 built | no cut sentence needed |
| #6 | R-50 Unit quality, R-52 seeded errors | SCR-19 built; seeded-error run pending NL-120 | if the run does not happen: "G-3 not measured in this build" |
| #7 | R-39 prompt-guidance editing | **Not cut**: SCR-21 built | no cut sentence needed |
| #8 | R-31 AI assist | SCR-13 built, not walked | see AI assist row |

## Findings from the walk (owner in brackets; none fixed here)

1. docs/AI-USAGE.md (planned file) is missing, and `docs/ARCHITECTURE.md` still has 8 `pending:` markers and a draft Limits section, and
   there is no `LICENSE` [NL-139].
2. `docs/delivery/capability-status.md` is stale: dated 2026-10-25, says SCR-18 to SCR-21 are "not built" while the QA report
   and merged list show them built, and shows most capabilities "Connected: no" [NL-140 / orchestrator].
3. `docs/ux/05-verify/QA_REPORT.md` was written before the fixes: it lists the issue numbers as `#None`, and F-1 to F-4 (blocking)
   and F-5 to F-18 read as open there although `.claude/state/resume.md` says they were fixed and closed. A re-walk is
   needed before any "QA clean" claim [NL-133 sign-off, Innocent].
4. M-24 stored p95 missed; a re-run after the store path is diagnosed is unscheduled [Innocent decision, then NL-127 follow-up].
5. Seam audit (`docs/plans/seam-audit-2026-10-26.md`): no blocking seam for the Compose demo; Render co-editing gap, a hard-coded
   "Unit board" nav link (`apps/web/src/features/frame/nav.ts`, line 18), a made-up heartbeat `version_id` (S-18) and a collab
   role captured at connect (S-29) remain [seam-followups]. Unit tests, Playwright and the real stack were not run by that audit.
6. No real-model run exists anywhere in the evidence (all reports say `provider_mode: stub`) [NL-109, NL-112, Innocent's spend yes].
7. Local `main` (`5999d9b`) is ahead of `origin/main` (`3e5d55a`) by two commits [orchestrator pushes; not done here].

## Checks this walk ran

- `git ls-remote origin HEAD`: remote reachable.
- `npm run typecheck`: clean at `5999d9b`.
- Evidence paths cited above exist (opened or listed): `docs/delivery/capability-status.md`, `docs/delivery/capacity-report.md`, `docs/delivery/demo-script.md`, `docs/delivery/demo-decision-inventory.md`, `docs/delivery/render-deploy-prompt.md`,
  `docs/ux/05-verify/QA_REPORT.md`, `docs/plans/seam-audit-2026-10-26.md`, `evals/reports/integrity-988d2cd73a6a.md`, `evals/reports/faults-05b70004372e.md`, `evals/reports/load-2026-10-26.md`,
  `README.md`, `docs/ARCHITECTURE.md`, `docs/devlog/`. Absent: docs/AI-USAGE.md (planned file), `LICENSE`, any demo video.
- Not run: unit tests, lint, Playwright, the Compose stack, any eval, any live URL.

Update a row as its evidence lands; walk the whole table again at the release SHA and before submitting.
