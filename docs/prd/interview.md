# PRD interview — Newsela Lesson Studio

> Skill: `prd-interview` v2.1.0 (followed by hand; the skill is user-invoked) · Coverage checklist:
> `system-design-readiness/CHECKLIST.md` (inspected 2026-10-25) · Question pack: none (the project's own questions)
> This document records the interview. Each answer names the document that owns it; when they
> disagree, the owner wins and this record is corrected. Format:
> `prd-interview/references/interview-document.md`.

**How this interview ran.** zero-to-hero §4 feeds the interview the Stage 3 register, records the choices made there
as decisions and asks only the quick facts. On 2026-10-25 Innocent wrote: "finish stage 3 and 4 dont ask for my input
ill follow your recommendations, use sub agents as needed". So batch 1 put every remaining question to that
instruction: each answer below is the recommended option, recorded as Innocent's, with that quote as its basis.
A subagent swept the sources and gave every checklist item its disposition. Anything Innocent raises later reopens the
affected question (status `revisit`) and the owner rows it touched.

## Resume here

- **Interview state:** complete
- **Current stage:** S9 — Close
- **Next batch:** none
- **Blocked on:** nothing (the GitLab `origin` is Innocent's action, not a question; it blocks §7d publishing only)
- **PRD approval:** approved 2026-10-25 by Innocent (under his 2026-10-25 instruction to follow the recommendations), revision v1.0 — `docs/prd/newsela-prd.md`
- **Readiness verdict:** not run — `system-design-readiness` runs in the System track (§6), after SP-1…SP-3 at §5
- **Last updated:** 2026-10-25, batch 1

## Sources read

| Source | Location | Authority | Revision or date read |
|---|---|---|---|
| Newsela project brief (word for word) | docs/source/01-project-brief.md | ISSUED (wins every disagreement) | Silver v1, last updated 2026-10-19; read 2026-10-25 |
| PRD | docs/prd/newsela-prd.md | DERIVED; owns R-n, GR-n, PD-n, AQ-17…22 | Draft v0.1 (2026-10-24 ~16:40 CT); read 2026-10-25 |
| Brief audit | docs/analysis/2026-10-24-brief-audit.md | DERIVED; owns T-n, AR-n, AD-n, AQ-1…16 | 2026-10-24; §5–§10 read 2026-10-25 |
| Angle and demo framing | docs/delivery/2026-10-24-angle-and-demo-framing.md | DERIVED; owns NS, G-n, V-n, O-n, H-n | 0.1 draft 2026-10-24; §Summary, §3, §4 read 2026-10-25 |
| Worked pairs | docs/data/worked-pairs.md | DERIVED; owns WP-1…WP-5, U1–U10 | Draft 2026-10-24; summary and findings read 2026-10-25 |
| Data reality README | docs/data/README.md | DERIVED; owns DS-n, SYN-n | Draft 2026-10-24; read 2026-10-25 |
| Hosting rule (copy) | .claude/rules/gauntlet-hosting-default.md | Project rule (Innocent, 2026-10-22); Render facts read 2026-10-22 | Copied 2026-10-24; read 2026-10-25 |
| Capture notes | docs/source/capture-notes.md | Record of how sources were fetched | 2026-10-24; export rows read 2026-10-25 |
| Submission tracker | SUBMISSION.md | Tracker | 2026-10-24; read 2026-10-25 |
| Project checklist | PROJECT-CHECKLIST.md | Stage and gate owner | 2026-10-24 (Skips table empty); read 2026-10-25 |
| Engineering audit part | docs/analysis/audit-parts/2026-10-24-engineering-audit.md | Input to the audit (N-n) | 2026-10-24; grep for scale, queue, Hocuspocus lines 222–407, read 2026-10-25 |
| Product direction | docs/analysis/2026-10-24-product-direction.md | DERIVED; owns DIR-n, FE-n, F-n | 2026-10-24; grep only, 2026-10-25 |
| Claude API reference (claude-api skill, bundled 2.1.295) | Models table "cached 2026-10-06"; shared/error-codes.md | External reference (Anthropic) | Read 2026-10-25 |
| Readiness checklist + design outputs contract | Gauntlet AI/.claude/skills/system-design-readiness/CHECKLIST.md, DESIGN-OUTPUTS.md | Framework | Read 2026-10-25 |
| Interview format | Gauntlet AI/.claude/skills/prd-interview/references/interview-document.md, observability.md, design-outputs.md, stage-map.md | Framework | Read 2026-10-25 |
| zero-to-hero artifact map §3, §4, §6 | Nortorious-Technologies/.claude/skills/zero-to-hero/ARTIFACT-MAP.md | Framework | Read 2026-10-25 |
| Hard-problem register | docs/design/hard-problems.md | DERIVED; owns HP-n, SP-n; choices recorded 2026-10-25 | Merged 2026-10-25; read 2026-10-25 |

## Artifact map

| Work | Owner document | Location | State |
|---|---|---|---|
| Product requirements | PRD | docs/prd/newsela-prd.md | exists (v1.0) |
| Decisions | Decision record | docs/prd/newsela-prd.md §10 (PD-n); docs/design/hard-problems.md (HP-n) | exists |
| Open questions | Open-questions list | docs/prd/newsela-prd.md §11; docs/analysis/2026-10-24-brief-audit.md §9 | exists |
| Design inputs | Requirements doc / readiness report | docs/prd/newsela-prd.md §5.3 K and this document; readiness report planned: docs/design/readiness-report.md | exists / planned |
| Implementation planning | Tickets | GitLab issues on `innocentnortey/inno-newsela` (once `origin` exists); slice plan planned: docs/plans/slice-plan.md | planned |
| Coverage audit | `to-tickets` coverage audit | planned: docs/plans/coverage-audit.md | planned |

### Design outputs

| ID | Output | Owner | Location | Sources | Status | Notes |
|---|---|---|---|---|---|---|
| DO-1 | System design | Claude drafts, Innocent reviews | docs/design/system-design.md | SD-1.9, SD-1.6, SD-2.1–SD-2.6, SD-3.1–SD-3.7, SD-5.1–SD-5.6, SD-6.1–SD-6.5, SD-7.1–SD-7.5; PD-4, PD-13, PD-15 | planned | Light depth per PD-23; foundation answers from PRD §13 |
| DO-2 | Architecture | Claude drafts, Innocent reviews | docs/design/architecture.md | SD-4.1, SD-4.3, SD-4.4, SD-4.7, SD-7.6; PD-3, PD-7, PD-9, PD-19; AD-15 | planned | Writes the WF-n registry rows for DO-6; feeds the planned docs/ARCHITECTURE.md (SUBMISSION.md) |
| DO-3 | Code design | Claude drafts, Innocent reviews | docs/design/code-design.md, mirrored to .claude/reference/area-map.md | SD-4.1, SD-4.3; PD-11; rule code-design-solid-modularity | planned | Reviewed by metz-code-design-agent per ARTIFACT-MAP §6 |
| DO-4 | Component contracts | Claude drafts, Innocent reviews | docs/design/component-contracts.md (internal signatures; links every external promise to `docs/contracts/INTERFACE.md` CON-N and never restates it; Zod-derived JSON Schemas for outline, UnitPlan, LessonDraft, Lesson, export under docs/contracts/schemas/) | SD-4.2, SD-4.5; R-11, R-42; UI contracts docs/ux/03-structure/UI_CONTRACTS.md as the seed | planned | Starts from the UX-track CON set (ARTIFACT-MAP §6) |
| DO-5 | Evaluation plan | Claude drafts, Innocent reviews | docs/design/eval-plan.md | SD-8.1, SD-8.8, SD-8.9, SD-2.7, SD-8.2; R-51, R-52, R-53, R-23; WP-1…WP-5 | planned | Worked pairs are the first dev set; each HP "how we'll know it worked" becomes a criterion |
| DO-6 | Observability contract | Claude drafts, Innocent reviews | docs/design/observability.md | SD-1.10, SD-3.7, SD-2.8, SD-4.7, SD-8.7, SD-6.6, SD-7.6; R-48, R-49; PD-19 | planned | Every workflow in SD-3.7 gets a WF-n row or an exclusion |
| DO-7 | Key-metrics registry | Claude drafts, Innocent reviews | docs/design/metrics-registry.md | SD-2.9, SD-2.8, SD-2.7; PRD §4; framing §3 | planned | Formulas and denominators already drafted in framing §3; targets [T] adopted under PD-1 / blanket 2026-10-25 |

## Stage map

| Stage | Topics | Checklist items | Depends on | Depth | State |
|---|---|---|---|---|---|
| S1 Frame | Deadline, spend, hardest uncertainty, partner questions, gate skips, telemetry policy | SD-1.1 – SD-1.10 | — | light | complete |
| S2 Requirements and promises | HP-2, HP-3, HP-5, HP-6, HP-8, HP-9 choices; U1–U10 | SD-2.1 – SD-2.9 | S1 | light | complete |
| S3 Workload and data | Load target, peak concurrency | SD-3.1 – SD-3.7 | S1, S2 | light | complete |
| S4 Flow and dependencies | HP-1 orchestration, HP-4 canonical copy | SD-4.1 – SD-4.7 | S2 | light | complete |
| S5 Resources and cost | Cost per lesson, spend caps (assumed until SP-1) | SD-5.1 – SD-5.6, SD-7.4 | S3, S4 | light | complete |
| S6 Failure, overload and security | Failure to survive, HP-7 long jobs | SD-6.1 – SD-6.6 | S4 | light | complete |
| S7 Deployment and operations | Local Docker Compose for the demo; Render config committed | SD-7.1 – SD-7.3, SD-7.5, SD-7.6 | S1, S5 | light | complete |
| S8 Validation and evidence | Eval ground truth, held-out set, HP-10 quality signal | SD-8.1 – SD-8.9 | S2, S6 | light | complete |
| S9 Close | PRD approval, design-outputs register check, readiness check, handoff | — | S1–S8 | — | complete (readiness runs at §6) |

## Next batch

None. The interview is complete. Next: the UX-1 user stories (§4b) and, in a second session, the System track
(§5 spikes SP-1…SP-3, then §6 design and `system-design-readiness`).

## Questions

### Q-001 — Reading of the deadline
- Stage: S1
- Layer: product
- Purpose: Fixes the build calendar and the internal cutoff every plan counts back from.
- Sources: project
- Depends on: —
- Status: carried
- Evidence: Innocent 2026-10-24, "Monday night at 3 am" (PROJECT-CHECKLIST.md header; PRD §6.1)
- Answer: Due Tue 2026-10-27 03:00 CT; internal cutoff Mon 2026-10-26 18:00 CT.
- Decision: carried as recorded
- Affects: PRD §6.1, §6.3 calendar
- History:
  - 2026-10-25 setup — carried from the checklist header

### Q-002 — Spend ceiling: hosting and model spend for the build
- Stage: S1
- Layer: design-input
- Purpose: Sets SD-1.6's single number: what the build may spend on hosting and on model calls.
- Sources: SD-1.6; project
- Depends on: —
- Status: answered
- Evidence: batch 1, 2026-10-25 (Innocent: "dont ask for my input ill follow your recommendations"); PRD §9 option D; sweep L-2
- Answer: Hosting: **$0 new spend** — record the demo locally under Docker Compose; `Dockerfile` and `render.yaml` committed; a Render deploy is one approval away (PD-15 option D). Model spend: **$75 total for the build** [T], a hard ceiling: SP-1 ≤ $5, the per-run cap from PD-14 (measured cost per lesson × 47 × 1.5) set after SP-1, reserve-then-settle enforcement (HP-7).
- Decision: PD-15 spend → option D; new PD-29 (build model-spend ceiling $75)
- Affects: PRD §9, §10 (PD-15, PD-29)
- History:
  - 2026-10-25 batch 1 — answered (recommendation accepted under Innocent's 2026-10-25 instruction)

### Q-003 — The hardest uncertainty
- Stage: S1
- Layer: design-input
- Purpose: Names the one unknown that most decides the design, so a spike settles it first.
- Sources: SD-1.9
- Depends on: —
- Status: answered
- Evidence: batch 1, 2026-10-25; PRD §13; hard-problems.md HP-1, SP-1
- Answer: Whether one structured call can produce a valid ~3,300-word teacher edition in Newsela's schema within a few minutes and under $1 per lesson. SP-1 answers it on rows 8, 9 and 25; if it fails, generation is one call per section (HP-1 option B).
- Decision: SP-1 defined in hard-problems.md
- Affects: hard-problems.md SP-1; PRD PD-4
- History:
  - 2026-10-25 batch 1 — answered (recommendation accepted)

### Q-004 — Send the questions to Newsela?
- Stage: S1
- Layer: product
- Purpose: Decides whether AQ-1…AQ-22 go to the partner, which would turn assumptions into facts.
- Sources: project
- Depends on: —
- Status: answered
- Evidence: batch 1, 2026-10-25; PD-24; AD-20
- Answer: **Not sent.** Answers could not arrive before the Monday cutoff, and sending is outward-facing. Every working assumption stays labelled as an assumption in the docs and the video.
- Decision: PD-24 → decided: drafted, not sent
- Affects: PRD §10 PD-24, §11
- History:
  - 2026-10-25 batch 1 — answered (recommendation accepted)

### Q-005 — Gate skips and light runs
- Stage: S1
- Layer: product
- Purpose: Decides how the remaining zero-to-hero gates run in the time left.
- Sources: project
- Depends on: —
- Status: answered
- Evidence: batch 1, 2026-10-25; PD-23; memory follow-checklist-one-skip-one-yes
- Answer: Light mode throughout (as set at Stage 0). **No gate is skipped now.** Any later skip is recorded in PROJECT-CHECKLIST.md's *Skips* table, one gate at a time, with its reason.
- Decision: PD-23 → decided: light mode, no skip taken
- Affects: PRD §10 PD-23; PROJECT-CHECKLIST.md *Skips*
- History:
  - 2026-10-25 batch 1 — answered (recommendation accepted)

### Q-006 — Load target and scale path
- Stage: S3
- Layer: design-input
- Purpose: Sets the load the design is sized for, and what changes as it grows.
- Sources: SD-3.1
- Depends on: —
- Status: answered
- Evidence: batch 1, 2026-10-25; PRD §13; brief "staff of 20+ reviewers"
- Answer: 500 users per day with a spike of 200 concurrent users; no 200-day requirement (Innocent, 2026-10-25). Scale path and workload: `docs/design/capacity-and-workload.md`.
- Decision: PD-33 (supersedes the batch 1 answer)
- Affects: PRD R-55–R-57; docs/design/system-design.md (planned)
- History:
  - 2026-10-25 batch 2 — changed (Innocent): "500 users per day, with a spike of 200 concurrent users … no 200-day requirement" (was: "25 concurrent editor sessions, one unit (47 lessons) generating at a time. Scale path: raise worker concurrency to the p…")
  - 2026-10-25 batch 1 — answered (recommendation accepted)

### Q-007 — Peak concurrency
- Stage: S3
- Layer: design-input
- Purpose: Sets the worst moment the system must handle.
- Sources: SD-3.4
- Depends on: Q-006
- Status: answered
- Evidence: batch 1, 2026-10-25; PRD §13; PD-13
- Answer: Spike of 200 concurrent users (Innocent, 2026-10-25), kept apart from generation: ≤ 6 lesson jobs in flight across ≤ 3 runs [A], queued beyond that (`docs/design/capacity-and-workload.md`).
- Decision: PD-33 (supersedes the batch 1 answer)
- Affects: PRD PD-13, R-56, R-57
- History:
  - 2026-10-25 batch 2 — changed (Innocent): "500 users per day, with a spike of 200 concurrent users … no 200-day requirement" (was: "Up to 6 generation jobs at once (cap starts at 4, set from SP-1's rate-limit headers) while 25 editor sessions are activ…")
  - 2026-10-25 batch 1 — answered (recommendation accepted)

### Q-008 — The failure the system must survive
- Stage: S6
- Layer: design-input
- Purpose: Names the failure the design proves it survives.
- Sources: SD-7.2
- Depends on: —
- Status: answered
- Evidence: batch 1, 2026-10-25; PRD §13; hard-problems.md HP-7
- Answer: A worker restart mid-run: the run resumes at the next unfinished lesson, no lesson is stored twice, no completed call is paid for again, calls lost in flight are at most the concurrency cap and are counted (R-16 reworded). No replica or zone failure is designed for.
- Decision: HP-7 option B; R-16 reworded
- Affects: PRD R-16, R-48
- History:
  - 2026-10-25 batch 1 — answered (recommendation accepted)

### Q-009 — Where it runs for the demo
- Stage: S7
- Layer: design-input
- Purpose: Decides the runtime the demo is recorded on.
- Sources: SD-7.1
- Depends on: Q-002
- Status: answered
- Evidence: batch 1, 2026-10-25; PRD §9; hosting rule
- Answer: Local Docker Compose on the Mac (web; worker + Hocuspocus; Postgres), labelled "recorded locally; deploy config included". The brief asks for source, docs and a video, not a URL (AQ-17 assumption).
- Decision: PD-15 → option D
- Affects: PRD §9, PD-15; SUBMISSION.md
- History:
  - 2026-10-25 batch 1 — answered (recommendation accepted)

### Q-010 — HP-1 orchestration
- Stage: S4
- Layer: design-input
- Purpose: Sets the generation pipeline shape.
- Sources: SD-4.3, SD-4.4; project
- Depends on: Q-003
- Status: carried
- Evidence: docs/design/hard-problems.md HP-1 (chosen 2026-10-25)
- Answer: Option A: fixed skeleton, one structured `LessonDraft` call per lesson compiled by code; `lesson_link` rows for cross-lesson state; SP-1 confirms, else option B.
- Decision: PD-4 → decided
- Affects: PRD PD-4, R-8, R-19
- History:
  - 2026-10-25 setup — carried from the Stage 3 register

### Q-011 — HP-2 grounding
- Stage: S2
- Layer: design-input
- Purpose: Sets how invented quotes and facts are prevented and caught.
- Sources: SD-2.7; project
- Depends on: —
- Status: carried
- Evidence: docs/design/hard-problems.md HP-2 (chosen 2026-10-25)
- Answer: Option B: no `quote` block in the draft schema; only a person inserts quotes with a source and rights status; three code scans; SP-3 sets the name scan's scope.
- Decision: PD-5 → decided
- Affects: PRD PD-5, R-12, R-19
- History:
  - 2026-10-25 setup — carried from the Stage 3 register

### Q-012 — HP-3 alignment
- Stage: S2
- Layer: design-input
- Purpose: Sets who may assert that a lesson teaches a standard.
- Sources: SD-2.7; project
- Depends on: —
- Status: carried
- Evidence: docs/design/hard-problems.md HP-3 (chosen 2026-10-25)
- Answer: Option B: every code carries `origin`; `narrowed` and `added` codes block Approve until a named reviewer confirms.
- Decision: PD-6 → decided
- Affects: PRD PD-6, R-19, R-20
- History:
  - 2026-10-25 setup — carried from the Stage 3 register

### Q-013 — HP-4 canonical copy
- Stage: S4
- Layer: design-input
- Purpose: Sets which stored copy checks, approval and export read.
- Sources: SD-4.1
- Depends on: —
- Status: carried
- Evidence: docs/design/hard-problems.md HP-4 (chosen 2026-10-25)
- Answer: Option A: Y.Doc is master; each store writes Y.Doc, derived JSON, hash and state vector in one transaction; schema fixed before the batch run.
- Decision: PD-7 (first half) → decided
- Affects: PRD PD-7, R-11, R-26, R-28, R-29, R-35, R-42
- History:
  - 2026-10-25 setup — carried from the Stage 3 register

### Q-014 — HP-5 approval integrity
- Stage: S2
- Layer: design-input
- Purpose: Sets what approval pins and how it holds under live edits.
- Sources: SD-2.2, SD-4.5
- Depends on: Q-013
- Status: carried
- Evidence: docs/design/hard-problems.md HP-5 (chosen 2026-10-25)
- Answer: Option B: Submit freezes the lesson; approval pins the snapshot's hash and state vector; 409 on stale; dependent lessons approved in order; export holds a lesson whose linked lesson is reopened.
- Decision: PD-7 (second half) → decided
- Affects: PRD PD-7, R-19, R-29, R-31, R-33, R-34, R-42
- History:
  - 2026-10-25 setup — carried from the Stage 3 register

### Q-015 — HP-6 outline normalization
- Stage: S2
- Layer: design-input
- Purpose: Sets what intake decides, what it proposes and what a person confirms.
- Sources: SD-2.1
- Depends on: —
- Status: carried
- Evidence: docs/design/hard-problems.md HP-6 (chosen 2026-10-25)
- Answer: Option A: intake is plain code, no model call; only errors block Generate; every warning has a stored default.
- Decision: new PD-27
- Affects: PRD R-3–R-6, R-11, R-19
- History:
  - 2026-10-25 setup — carried from the Stage 3 register

### Q-016 — HP-7 long jobs
- Stage: S6
- Layer: design-input
- Purpose: Sets how a 47-lesson run survives restarts, 429s, truncation and the spend cap.
- Sources: SD-6.1, SD-6.2
- Depends on: Q-008
- Status: carried
- Evidence: docs/design/hard-problems.md HP-7 (chosen 2026-10-25)
- Answer: Option B: one `lesson_job` table as queue and progress, `SKIP LOCKED` with a lease, raw-output checkpoint, reserve-then-settle spend.
- Decision: PD-13 → decided; PD-14 enforced by reservation
- Affects: PRD PD-13, PD-14, R-16, R-48
- History:
  - 2026-10-25 setup — carried from the Stage 3 register

### Q-017 — HP-8 north-star measurement
- Stage: S2
- Layer: design-input
- Purpose: Sets how reviewer minutes are measured honestly.
- Sources: SD-2.9, SD-2.8
- Depends on: —
- Status: carried
- Evidence: docs/design/hard-problems.md HP-8 (chosen 2026-10-25)
- Answer: Option B: heartbeats with honesty rules; human sessions only; minutes to first approval; "approved k of N" on the tile; one G-2 threshold.
- Decision: PD-1 and PD-25 amended
- Affects: PRD PD-1, PD-25, R-36, R-49, R-52, GR-15, §12
- History:
  - 2026-10-25 setup — carried from the Stage 3 register

### Q-018 — HP-9 content-safety notes
- Stage: S2
- Layer: design-input
- Purpose: Sets how a warning to the teacher is found, routed and cleared.
- Sources: SD-1.8
- Depends on: —
- Status: carried
- Evidence: docs/design/hard-problems.md HP-9 (chosen 2026-10-25)
- Answer: Option A: pattern rules propose, the author confirms, code places a teacher-only tip; only a named person, with a note, clears the flag.
- Decision: new PD-26
- Affects: PRD R-6, R-19, R-22, §12
- History:
  - 2026-10-25 setup — carried from the Stage 3 register

### Q-019 — HP-10 teaching quality
- Stage: S8
- Layer: design-input
- Purpose: Sets the signal for whether generated teaching is any good.
- Sources: SD-8.1, SD-8.8
- Depends on: —
- Status: carried
- Evidence: docs/design/hard-problems.md HP-10 (chosen 2026-10-25)
- Answer: The approver's one-click draft-quality rating at Approve (R-60); judge stays at cut #2; arc checks at cut #3.
- Decision: new PD-28; new R-60
- Affects: PRD §5.3, §10
- History:
  - 2026-10-25 setup — carried from the Stage 3 register

### Q-020 — Stage 2 uncertain items U1–U10
- Stage: S2
- Layer: product
- Purpose: Closes the ten readings of the outline that Stage 2 had to guess.
- Sources: project
- Depends on: Q-012, Q-014, Q-015, Q-011, Q-018
- Status: carried
- Evidence: docs/data/worked-pairs.md (U1–U10); hard-problems.md index ("Every uncertain item is closed")
- Answer: All ten take the recommended option: U1 `L.6.4.b` per the editor note; U2 6 + 4 vocabulary split; U3 lessons approved in order; U4 writing model fills the Literacy Lab; U5 listed leaves only, others "add?"; U6 a reviewer supplies excerpts; U7 propose codes only for empty lists, each a blocking confirmation; U8 "Flex Day: <title>"; U9 any named reviewer clears a safety flag with a note; U10 a reviewer slot for "teacher-chosen" excerpts.
- Decision: recorded on HP-2, HP-3, HP-5, HP-6, HP-9
- Affects: docs/data/worked-pairs.md; PRD R-3–R-6, R-19, R-33, R-34
- History:
  - 2026-10-25 setup — carried from the Stage 3 register

### Q-021 — Who decides a correct answer; what is held out
- Stage: S8
- Layer: design-input
- Purpose: Fixes the eval ground truth and the held-out set.
- Sources: SD-8.8, SD-8.9
- Depends on: —
- Status: carried
- Evidence: PRD R-51, R-53, GR-11, PD-20; docs/data/worked-pairs.md
- Answer: Correct outputs: the worked pairs (WP-1…WP-5, hand-built by Claude, choices accepted by Innocent) and one golden case per check and outline defect. Held out: Grade 6 Unit 4's published lessons, never used as examples, compared by structure only.
- Decision: carried
- Affects: docs/design/eval-plan.md (planned)
- History:
  - 2026-10-25 setup — carried from the PRD

### Q-022 — What telemetry is kept, for how long, and who reads it
- Stage: S1
- Layer: design-input
- Thread: observability
- Purpose: Sets retention, readers and backup for traces and heartbeats.
- Sources: SD-1.10, SD-2.6
- Depends on: —
- Status: answered
- Evidence: batch 1, 2026-10-25; sweep L-1; PD-19
- Answer: Traces and heartbeats stay in our own Postgres for the life of the project database, with no automatic deletion; read by Innocent as operator (SQL, run summary, tiles); heartbeats shown only in aggregate (GR-15). One `pg_dump` is taken after the full 47-lesson run and before recording.
- Decision: new PD-30
- Affects: PRD §10 PD-30; docs/design/observability.md (planned)
- History:
  - 2026-10-25 batch 1 — answered (recommendation accepted)

### Q-023 — PRD approval
- Stage: S9
- Layer: product
- Purpose: Closes Stage 4: the PRD becomes the approved basis for the UX and System tracks.
- Sources: project
- Depends on: Q-001, Q-002, Q-003, Q-004, Q-005, Q-006, Q-007, Q-008, Q-009, Q-022
- Status: answered
- Evidence: batch 1, 2026-10-25 (Innocent: "finish stage 3 and 4 dont ask for my input ill follow your recommendations")
- Answer: PRD v1.0 approved 2026-10-25 by Innocent under that instruction, with every Stage 3 choice and every answer above reconciled into it. Anything he raises later reopens the affected row.
- Decision: PRD status → v1.0 approved
- Affects: docs/prd/newsela-prd.md header and §10
- History:
  - 2026-10-25 batch 1 — answered (approval recorded under Innocent's 2026-10-25 instruction)

## Observability map

| Stage | What must be known | Items | Questions | Disposition | Evidence, reason or plan |
|---|---|---|---|---|---|
| S1 | What logs and traces may record raw, redacted or never; readers; retention; export | SD-1.8, SD-1.10 | Q-022 | answered | PD-19 / AD-17: traces in our own Postgres, no hosted tracer (AQ-16 assumption). R-48 records the rendered prompt and raw output; allowed prompt content is bounded by GR-10 / AR-29 (schema, 1–2 examples, official standards text, outline rows, supplied public-domain text), so traces hold no restricted or student data (GR-9, GR-13). Review time aggregate only, never per person (GR-15, R-49). Retention and readers proposed in this sweep (see Leftovers L-1). Recommendation accepted by Innocent 2026-10-25 (blanket) |
| S2 | Operational success per key operation, separate from correctness; quality metrics with baseline and target | SD-2.8, SD-2.7, SD-2.3 | — | answered | Did it run: H-1…H-6 (framing §3.4), job states queued → … → ready / failed / capped (R-16, R-17), run summary (R-48). Was it right: V-1…V-3, G-3 and the judge calibration record (PRD §4, R-23, R-52), all baseline none, targets [T]. Kept in separate groups by design (framing §3.4, GP-132). PD-1, blanket 2026-10-25 |
| S3 | Workload classes and volumes, every workflow and entry point | SD-3.1–SD-3.7 | — | answered | Workflow list in SD-3.7 below (user operations, the generation worker, eval and seeded runs, the load probe, SP-1/SP-2 spikes, migrations, seeds, deploy). Volumes: 47 lesson jobs + 1 UnitPlan per run (R-3, R-8); 25 concurrent editor sessions [T] (PRD §5.3 K). Request mix and per-user actions assumed until measured (SD-3.2, SD-3.3) |
| S4 | Run stages, waits, timed boundaries, correlation ID; each model decision point | SD-4.7, SD-4.3, SD-4.4 | — | answered | Stages queued → planning → drafting → checking → repairing → ready / failed (R-17); waits at the Postgres queue under the 4–6 cap (R-16, PD-13); one correlation ID across run, lesson and model call (R-48); boundaries timed from job timestamps (R-55). Model decision points: UnitPlan, LessonDraft, repair, judge, AI assist, AI-proposed leaf codes (R-8, R-11, R-19, R-23, R-31, R-20). PD-4 / HP-1, blanket 2026-10-25 |
| S5 | Time and resource use per stage; tokens, calls and cost per approved lesson | SD-5.1–SD-5.3, SD-5.5 | — | assumed | Model spend ≤ $1 per lesson [T], ~$0.50 and ~3 min per lesson [A] (PRD §12). Cost per lesson from provider usage fields (R-16, R-48). Plan: SP-1 3-row trial (rows 8, 9, 25), then the full 47-lesson run report (R-51, R-55) |
| S6 | Signal that each failure or overload policy fired, and that recovery happened; who notices | SD-6.6, SD-6.3, SD-6.5 | — | answered | Failures by reason, retries and placeholders in the run summary (R-48); `capped` and `generation_failed` statuses with reasons (R-16, R-19); tile states on the progress board (R-17); H-1/H-3 decision lines (framing §3.4). Who notices: the author watching the board, and Innocent reading the run summary; no paging (single-operator demo, SD-7.5). Recovery: resume after worker restart with no double billing (R-16 AC) |
| S7 | Where telemetry lives and is read; who operates it; whether S1 allows it | SD-7.6, SD-7.5 | — | answered | Our own Postgres (PD-19), read by SQL and the run summary / north-star tile; process stdout (Render keeps 7 days if deployed, hosting rule). Constraint: pre-adoption content must not reach a tracing vendor (AD-17). Local Docker Compose is the recommended recording host (PRD §9 option D), so nothing leaves the Mac. Consistent with S1 |
| S8 | What is captured while it runs; redesign triggers; what one model run's trace holds | SD-8.4, SD-8.6, SD-8.7, SD-8.1 | — | answered | Trace per call: rendered prompt, raw output, tokens, cost, check results, verdicts, one correlation ID (R-48); provenance per lesson version: outline-row hash, prompt version, model and parameters, schema version, example set, run ID, cost (R-35). Triggers: PRD §6.4 tripwires and framing decision lines (SD-8.6). Reviewed traces never become held-out cases (GR-11) |

## Checklist coverage

HP-n citations refer to [`docs/design/hard-problems.md`](../design/hard-problems.md) (merged 2026-10-25). After the
merge the rows citing HP-4, HP-5, HP-7 and HP-8 were re-checked: the cards refine the PD rows these cells cite and
contradict none, so no row moved to `revisit`.

| ID | Kind | Tier | Stage | Disposition | Evidence, reason or plan | Questions |
|---|---|---|---|---|---|---|
| SD-1.1 | Issued | Core | S1 | answered | Brief PRD para: "an interface for our review staff to review, edit/update … and then mark the content as approve/finalized"; personas P-1 reviewer (primary), P-2 author, P-3 approver; done = every blocking issue cleared and defensible to a state reviewer (PRD §3; PD-1) | — |
| SD-1.2 | Issued | Core | S1 | answered | Brief Required Deliverables: Source Code, Technical Documentation, Demo Video (AI usage doc optional); functional requirements mapped in PRD §5.2 and SUBMISSION.md; two-layer framing per rule hiring-partner-framing (framing §1–§2) | — |
| SD-1.3 | Issued | Core | S1 | answered | Brief Off-Limits field holds no technology, treated as empty (brief file note; AD-2). Non-goals PRD §7 (no autonomous agent, no bulk approve, no fine-tuning, no retrieval over the novel, no live publish); guardrails GR-1…GR-18 | — |
| SD-1.4 | Issued | Core | S1 | answered | Brief Technology: "Javascript (Next/Node), React, and Python (if desired)", "OpenAI or Anthropic APIs", "ProseMirror and Yjs"; PRD §9 all TypeScript, Postgres for everything (PD-11, PD-13, AD-12). No existing system to integrate; export only (PD-22) | — |
| SD-1.5 | Issued | Core | S1 | answered | Brief Time Constraints "1-2 days"; due Tue 2026-10-27 03:00 CT (Innocent 2026-10-24, SUBMISSION.md); internal cutoff Mon 2026-10-26 18:00 CT and tripwires (PRD §6.1, §6.4); built by Innocent with Claude agents | — |
| SD-1.6 | Issued → Decision if silent | Core | S1 | answered | Brief silent on spend (checked brief Cloud Platforms, Technology). Hosting: PRD §9 option D, local Docker Compose, $0 new spend, so no request over the $40/month Render cap (hosting rule); a Render deploy (~$20/month, AD-15) stays one approval away. Model spend: ≤ $1 per lesson [T] (R-55, O-1); per-run cap = measured cost per lesson × 47 × 1.5 (PD-14), about $71 at the $1 target [C]; per-day cap (R-54) value set after SP-1. PRD §13 proposal, recommendation accepted by Innocent 2026-10-25 (blanket). No total build budget figure exists: see Leftovers L-2 Build model-spend ceiling $75 total (PD-29, Q-002). | Q-002 |
| SD-1.7 | Issued / External | Full | S1 | answered | Brief Impact Metrics "ARR … 10's of millions"; review ~$20 per lesson against < $1 model spend [A] (framing §3.2, PRD §4); hand authoring $600–1,350 per lesson [A, C] (audit §7, CA §4); labelled illustration only (PRD §12) | — |
| SD-1.8 | Issued | Core | S1 | answered | Staff-side only, no student or teacher data (GR-13, AR-37); crawled Newsela content git-ignored in docs/source/restricted/, never committed, deployed or recorded (GR-9, AD-4); test data synthetic or the cleared issued sheet (data README; rule synthetic-test-data); repo private (PD-20) | — |
| SD-1.10 | Issued → Decision if silent | Core | S1 | answered | Brief silent on telemetry. Traces in our own Postgres, never a hosted vendor (PD-19, AD-17, AQ-16); raw prompt and raw output recorded (R-48), safe because prompt content is bounded by GR-10 / AR-29; never: restricted content, student data, per-person review time (GR-9, GR-13, GR-15). Retention and readers: proposed in this sweep (Leftovers L-1). Recommendation accepted by Innocent 2026-10-25 (blanket) | Q-022 |
| SD-1.9 | Decision | Core | S1 | answered | Can one structured call produce a valid ~3,300-word teacher edition in Newsela's schema within a few minutes and under $1 per lesson (PRD §13; PD-4 / HP-1; tested by SP-1). Sets depth: S5 and S8 full on model work, others light (PD-23). Recommendation accepted by Innocent 2026-10-25 (blanket) | Q-003 |
| SD-2.1 | Decision (from the PRD's use cases) | Core | S2 | answered | Five operations from PRD §5.1: (1) upload and validate an outline, (2) run unit generation, (3) review and co-edit a lesson, (4) approve or request changes, (5) export (cut #5). PD-2, blanket 2026-10-25 | — |
| SD-2.2 | Issued + Decision | Core | S2 | answered | Never: an unsourced quote or invented page at approval (GR-1, R-19); Generate while an error is unconfirmed (R-5); a job billed twice or a run past its cap (R-16); regenerate overwriting reviewed work (R-29); approval of a version other than the one seen, bulk approve, or approve with a blocking issue (R-33, R-34, GR-6); AI text entering silently (GR-7); a bare "aligned" badge (GR-4) | — |
| SD-2.3 | Issued → Decision if silent | Core | S2 | answered | Brief: "a few minutes per lesson is ok"; "performant … 20+ reviewers". Targets [T]: generation p95 ≤ 5 min per lesson, unit ≤ 2 h (R-55); p95 lesson open < 1.5 s, unit board < 1 s (R-57); remote edit < 300 ms, durable < 3 s (R-56); checks after save < 5 s (R-28); progress tile < 3 s (R-17). Timing start and stop points in each AC. Blanket 2026-10-25 | — |
| SD-2.4 | Decision | Core if data changes after ingestion | S2 | answered | Outline is an immutable hashed snapshot; changes arrive only as a new version (R-1, R-7). Lesson content: Yjs persisted ≤ 2 s (R-26); checks re-run on every durable save (R-28); progress polled every 2 s (PD-18); standards table static seed (R-4). Blanket 2026-10-25 | — |
| SD-2.5 | Decision | Core | S2 | answered | Model API down: generation jobs retry with backoff, then fail as a normal partial state with "retry failed" (R-16); review, edit, checks and approval keep working because checks are deterministic code (R-19) and only AI assist needs a model (R-31) [I]. Hocuspocus down: editor unavailable, board and approval reads continue [I]. Blanket 2026-10-25 | — |
| SD-2.6 | Decision | Full | S2 | answered | RPO: ≤ 2 s of editor changes (R-26 debounce [T]); 0 for generation, since jobs are idempotent and resume (R-16); audit log append-only (R-35). RTO: restart and resume, the failure SD-7.2 names; no backup or replica target in a 1–2 day demo (light depth, PD-23). See Leftovers L-1 for the pre-recording backup proposal | — |
| SD-2.7 | Decision | AI | S2 | answered | V-1 first-pass clean ≥ 60% [T]; V-2 standards verified 100% [T]; V-3 quotes sourced or placeholder 100%, ≤ 2 placeholders per lesson [T]; G-3 seeded-error catch ≥ 90% [T]; judge agreement with ~30 labelled pairs, advisory only (R-23). Baseline none for all (PRD §4; framing §3.3). PD-1, blanket 2026-10-25 | — |
| SD-2.8 | Decision | Core | S2 | answered | Per lesson job: ready / generation_failed (with reasons) / capped / cancelled (R-16, R-19); H-1 generation success ≥ 98% [T] and retries per lesson; run summary wall time, cost, retries, failures by reason (R-48). Kept apart from correctness metrics (framing §3.4) | — |
| SD-2.9 | Decision | Core | S2 | answered | PRD §4 table and framing §3.2–§3.4: NS, G-1…G-3, V-1…V-6, O-1…O-4, H-1…H-6, each with purpose, decision line, unit and denominator; operational (H), correctness (V), coverage (O-4), safe refusal (placeholders, V-3) kept separate. Targets [T] adopted under PD-1 and blanket 2026-10-25; exact formulas go to DO-7 | — |
| SD-3.1 | Issued | Full; Core if the brief gives any number | S3 | answered | Brief "staff of 20+ reviewers" names no kind. Decided reading: 25 concurrent editor sessions, one unit at a time, usually 1–3 editors on one lesson (PRD §5.3 K, §13; T-13; AQ-3 assumption). PRD §13 proposal, recommendation accepted by Innocent 2026-10-25 (blanket). AQ-3 would reopen it (not sent, PD-24) | Q-006 |
| SD-3.2 | Measure | Full | S3 | assumed | Assumed about 12 lesson reviews per reviewer per day [C: 6 review hours ÷ the 30-min NS aspiration, both A/T] and about 120 heartbeat requests per 30-min review [C: one per 15 s, R-49], plus Yjs updates. Plan: count from the R-49 scripted 3-lesson review and the R-57 probe logs | — |
| SD-3.3 | Measure | Full | S3 | assumed | Assumed mix: review traffic dominated by heartbeat writes and Yjs websocket updates; reads are lesson open and board load; model calls only in generation, about 1 UnitPlan per run plus 1 draft and ≤ 1 repair per lesson (R-8, R-19), plus 1 judge call per pair if R-23 lands. Plan: count call rows in the full 47-lesson run (R-48) and request logs in the R-57 probe | — |
| SD-3.4 | Issued → Decision if silent | Full | S3 | answered | Brief silent on peaks. Peak: 6 generation jobs at once (cap 4–6, PD-13) while 25 editor sessions are active, 1–3 per lesson; burst = one unit run, ~25 min expected [C on A] up to the 2 h gate (R-55). PRD §13 proposal, recommendation accepted by Innocent 2026-10-25 (blanket) | Q-007 |
| SD-3.5 | External | Core if any exists | S3 | answered | Background work: the generation worker only (R-16): per run 1 UnitPlan + one job per teaching day, 47 on the issued sheet (41 lessons + 6 flex, data README; R-3); checks on save (R-28). No polling of external sources, no scheduled jobs, no re-indexing (no retrieval, PRD §7). Volumes come from the issued sheet, not a vendor | — |
| SD-3.6 | External / Measure | Full | S3 | assumed | Known: outline ≤ 200 rows [T] (R-3); published teacher edition median 3,306 words [M] (framing §3.2); 47 lessons per unit. Assumed: one Lesson record a few tens of KB of ProseMirror JSON [A]; records kept for the project's life [A]. Plan: measure draft size and tokens in the SP-1 3-row trial and record sizes after the full run | — |
| SD-3.7 | Decision | Core | S3 | answered | Workflows to cover: upload / link import and validation (R-1–R-6); run start, cancel, retry failed (R-16); worker jobs: UnitPlan, draft, checks, repair, judge (R-8, R-11, R-19, R-23); progress polling (R-17); editor websocket and persistence (R-26); checks on save (R-28); regenerate as candidate (R-29); AI assist (R-31); approve, request changes, reopen (R-33, R-34); prompt guidance save and "try on one lesson" (R-39); export (R-42); heartbeats and frozen metrics (R-49); golden suite and full-run report (R-51); seeded-error run (R-52); local held-out comparison (R-53); HTTP probe and Yjs load script (R-57, R-56); spikes SP-1, SP-2 (PRD §6.3); migrations, standards and demo-account seeds (R-4, R-54); sample builder docs/data/scripts/build_samples.py; deploy (Compose or Render). Each becomes a WF-n row in DO-6; cut items keep a row marked cut | — |
| SD-4.1 | Issued for legacy, otherwise Decision | Core | S4 | answered | Our Postgres is the system of record for drafting and approval (T-20); outline versions immutable (R-1); during editing the Y.Doc is authoritative and every durable store writes the derived ProseMirror JSON that checks, approval and export read (PD-7, HP-4 in PRD §13); standards text owned by the CDE seed (GR-5); audit log append-only (R-35). Blanket 2026-10-25 | Q-013 |
| SD-4.2 | External | Core | S4 | answered | Anthropic Messages API (API-key auth; structured output via `output_config.format`; usage fields give cost), per the claude-api reference read 2026-10-25. Google Sheets public export `…/export?format=csv` and `format=xlsx` works with no sign-in, CSV first tab only, XLSX keeps hidden tabs (capture-notes.md, 2026-10-24). Hocuspocus and y-prosemirror are self-hosted libraries, not services (PD-9). OpenAI judge only if R-23 lands (cut #2): its docs are checked then, at build time (PD-12) | — |
| SD-4.3 | Decision | AI | S4 | answered | Model decides: UnitPlan (R-8), LessonDraft blocks (R-11), the one repair (R-19), advisory judge (R-23), AI-assist rewrite as a suggestion (R-31), proposed leaf codes marked "AI-proposed, confirm" (R-20). Code instead: normalizer, validation, compile to ProseMirror, every blocking check, alignment coverage, coverage matrix (R-3–R-5, R-19, R-41), because each has a deterministic right answer. Fixed pipeline, not an agent (PD-3, PD-4 / HP-1). Blanket 2026-10-25 | — |
| SD-4.4 | Decision | Core | S4 | answered | Before: standards seed, outline normalize, validate and confirm, UnitPlan (journey steps 1–4). Async, not in any user request: lesson generation (R-16; brief "can happen asynchronously"). In the request: open, edit, save, approve. After: checks re-run on save (R-28); metrics row frozen at approval (R-49); export on demand (R-42). Blanket 2026-10-25 | — |
| SD-4.5 | Decision | Core | S4 | answered | Partial run is a normal state with "retry failed" (R-16); failed repair → `generation_failed` with reasons (R-19); cap reached → `capped` (R-16); resume after restart skips finished lessons (R-16); stale-hash approve returns a conflict and changes nothing (R-33); regenerate makes a candidate (R-29). HP-7 / HP-5 in PRD §13. Blanket 2026-10-25 | — |
| SD-4.6 | External + Decision | Legacy | S4 | n/a | Legacy tier does not apply: no existing system is extended; "published to our application" is a JSON export (PD-22) | — |
| SD-4.7 | Decision | Core | S4 | answered | Generation stages queued → planning → drafting → checking → repairing → ready / failed, with the wait at the queue under the cap (R-17, R-16); timed from job timestamps (R-55); review stages draft → in_review → changes_requested → approved → exported (R-33) with heartbeat sessions (R-49); one correlation ID per run, lesson and call (R-48). Blanket 2026-10-25 | — |
| SD-5.1 | Measure | Full | S5 | assumed | Assumed CPU per request small next to model latency; the shared DB pool and the LLM rate limit break first (engineering audit, N-20 breakers list). Plan: process CPU sampled during the R-57 probe run alongside generation | — |
| SD-5.2 | Measure | Full | S5 | assumed | Assumed one Postgres shared by web, worker and Hocuspocus; the connection pool is a likely first breaker (engineering audit N-20). Plan: R-57 probe during a generation run, with connection counts recorded | — |
| SD-5.3 | Measure | AI | S5 | assumed | Assumed ~$0.50 and ~3 min per lesson [A] (PRD §12), 1 draft + ≤ 1 repair call per lesson, target ≤ $1 [T]. Plan: SP-1 3-row trial (rows 8, 9, 25), then the full 47-lesson run report from provider usage fields (R-51, R-55) | — |
| SD-5.4 | External | AI | S5 | answered | claude-api reference, models table cached 2026-10-06, read 2026-10-25: Sonnet 5.5 $2 / $10 per MTok, Haiku 5.5 $0.10 / $0.50, Opus 5.5 $4 / $20; 1M context, 128K max output (streaming needed for large max_tokens). PD-12: generation on a strong mid-tier model, repair on a cheaper one; final IDs and prices re-confirmed at build. Account rate limits are tier-specific: read from the rate-limits page and response headers during SP-1, then set the cap (PD-13) | — |
| SD-5.5 | External | Core if any | S5 | answered | Google Sheets: one export fetch per upload, public link, no sign-in (capture-notes.md 2026-10-24); no quota is material at that volume. No other paid third-party API on the core path; OpenAI only if R-23 lands | — |
| SD-5.6 | External | Full | S5 | answered | Node: one event loop per process, so the worker runs as its own process apart from web and Hocuspocus entry points (R-16, AD-15); one Hocuspocus process carries the tens-of-users load (PD-9; engineering audit N-20; T-13); concurrency of model calls is the queue cap, not threads (PD-13) | — |
| SD-6.1 | Decision | Core | S6 | answered | Generation: queue (a second unit waits behind the first, engineering audit "Overload behaviour", GP-114), cap 4–6 concurrent jobs (PD-13), stop at the spend cap (R-16), per-user and per-day limits refuse new runs (R-54). Editing and reads: serve; no shedding at 25 sessions [I]. Blanket 2026-10-25 | Q-016 |
| SD-6.2 | Decision | Core | S6 | answered | Model calls: retries with backoff (R-16; SDK default 2 retries on 408/409/429/5xx and a 10-min timeout, claude-api reference); jobs idempotent by (run, lesson, prompt version, schema version) (R-16); export idempotent (R-42); approve guarded by the content hash (R-33). Per-call timeout value is a design detail set from the SP-1 p95, deferred to DO-1 | — |
| SD-6.3 | External | Core | S6 | answered | Anthropic: 429 rate_limit_error with `retry-after`, 529 overloaded_error, both retryable; truncation at max_tokens gives invalid JSON (claude-api error-codes.md read 2026-10-25; engineering audit line 222). Google Sheets: a private sheet does not export; shown as "share it publicly or upload the file" (R-2). Hocuspocus: refuses unauthenticated connections (R-26); clients reconnect and Yjs merges [I, verified by SP-2] | — |
| SD-6.4 | Decision | Core if there's external data | S6 | answered | The only external input is the outline: always the stored snapshot, labelled with its version and hash, never re-fetched (R-1); a changed sheet is a new upload (R-7). Missing source texts are never fetched: placeholders (R-12, PD-5 / HP-2). Blanket 2026-10-25 | — |
| SD-6.5 | Decision | Full | S6 | answered | Queue bounded by run scope (≤ 200 rows, R-3) and one active unit run with later runs queued (engineering audit, GP-114); no age limit: a queued lesson stays useful until the run is cancelled (light depth, PD-23). Blanket 2026-10-25 | — |
| SD-6.6 | Decision | Core | S6 | answered | Fired: failures by reason, retries, `capped`, `generation_failed` (R-48, R-16, R-19); H-1 and H-3 against their gates (framing §3.4); tile state on the board (R-17). Recovered: resumed job count after restart, run summary totals equal stored call rows (R-48 AC). A health endpoint for Compose / Render is a design detail, deferred to DO-6 | — |
| SD-7.1 | Issued | Core | S7 | answered | Brief Cloud Platforms "Any"; deliverables need no deployed URL (brief; AQ-17 assumption). Host Render per hosting rule (PD-15); recording on local Docker Compose with Dockerfile and render.yaml committed (PRD §9 option D, recommended). Recommendation accepted by Innocent 2026-10-25 (blanket) | Q-009 |
| SD-7.2 | Decision | Full | S7 | answered | Survive a worker restart mid-run: resume at the next unfinished lesson, nothing billed twice (PRD §13; R-16 AC). No replica or zone failure. Recommendation accepted by Innocent 2026-10-25 (blanket) | Q-008 |
| SD-7.3 | Measure | Full | S7 | assumed | Assumed one web, one worker + Hocuspocus process and one Postgres carry 25 sessions during a run (T-13, N-20). Plan: R-57 probe (25 concurrent clients during a generation run); R-56 Yjs load script if cut #1 does not fire | — |
| SD-7.4 | External | Core | S5 | answered | Render Starter $7/month, Postgres Basic-256mb $6/month + $0.30/GB-month, disk $0.25/GB-month (hosting rule, render.com/docs read 2026-10-22; re-check before quoting); AD-15 shape ~$20/month [C], not provisioned under option D. Model prices per SD-5.4 (claude-api reference, cached 2026-10-06, read 2026-10-25). No monitoring vendor (PD-19) | — |
| SD-7.5 | Decision | Core | S7 | answered | Innocent alone can run Docker Compose (web, worker + Hocuspocus, Postgres), read traces and the run summary in Postgres, and re-run the unit; no Redis, no tracing vendor, one language (PD-11, PD-13, PD-19; PRD §9 option D). Blanket 2026-10-25 | — |
| SD-7.6 | Decision | Core | S7 | answered | Telemetry in our own Postgres (traces, run summary, heartbeats, metrics rows) plus process stdout; read by SQL and the in-app tiles. Constraint: pre-adoption content may not go to a hosted vendor (AD-17, PD-19, AQ-16). No tool assumed | — |
| SD-8.1 | External / Decision | Core | S8 | answered | One golden test per outline defect from the Sheet §5 list (R-3, R-51); golden failing fixture per blocking rule (R-19); WP-1…WP-5 as the dev set (worked-pairs.md); ~30 judge pairs labelled by Innocent, provisional (R-23); seeded errors (R-52); structural counts against held-out Unit 4, local only (R-53). Blanket 2026-10-25 | — |
| SD-8.2 | Issued / External | Core | S8 | answered | The issued sheet (cleared for rendering, data README "Where things live"), DS-1…DS-14 cut from it, SYN-1 injection, SYN-2 layout drift, SYN-3 clean control, each with its assumption (data README); rule synthetic-test-data; nothing from restricted/ (GR-9) | — |
| SD-8.3 | Decision | Full | S8 | answered | R-57 HTTP probe, 25 concurrent clients, during a generation run (core); R-56 25 simulated HocuspocusProvider editors across 10 lessons (cut #1); k6 for HTTP per engineering audit line 379; local Compose environment. Blanket 2026-10-25 | — |
| SD-8.4 | Decision | Core | S8 | answered | Per call and run: R-48 traces and run summary; per lesson version: R-35 provenance; per review: R-49 heartbeats and frozen metrics row; per transition: append-only audit log (R-35); probe results stored (R-57) | — |
| SD-8.5 | Issued | Core | S8 | answered | Brief Required Deliverables. Mapping: code and tests → Source Code; full-run report, probe results, limits → Technical Documentation (README, docs/ARCHITECTURE.md); random lesson, caught error, run summary, north-star tile → Demo Video (SUBMISSION.md; PRD §6.2; GR-14) | — |
| SD-8.6 | Decision | Core | S8 | answered | 3-lesson trial not valid by Sun 14:00 → per-section calls (DIR-3 fallback) and drop cuts #1–#5; one lesson not draft → approved by Mon 02:00 → drop cuts #1–#7 (PRD §6.4); H-2 above gate → raise the cap if the rate limit allows; V-1 < 30% → no new run on that prompt version; NS above hard gate → read V-4 / V-2 / V-3 (framing §3.2–§3.4); a spike result contradicting an assumption reopens its PD (PRD §10). First bottleneck to watch: the LLM rate limit, then the shared DB pool (N-20) | — |
| SD-8.7 | Decision | AI | S8 | answered | One run's trace: run → lessons → calls under one correlation ID; rendered prompt (assembled input), raw output, tokens, cost, check results and verdicts per call (R-48); prompt version, model and parameters, schema version, example set per lesson version (R-35); failures by reason and retries (R-48); latency from job timestamps (R-55). Parsed `LessonDraft` stored as the version content (R-11). S1 policy holds because prompt content is bounded (GR-10). PD-19, blanket 2026-10-25 | — |
| SD-8.8 | Issued → Decision if silent | Core | S8 | answered | Brief silent on who judges. Authority: the issued sheet and official CDE text for intake (deterministic rules, R-3–R-5); the PRD's acceptance criteria for checks (R-19); worked pairs hand-worked by Claude and checked by Innocent (U1–U10); Innocent's ~30 labels for the judge, labelled non-expert (R-23, PRD §12); the model under test is never its own authority (PD-6, GR-4). Each case records its source: DS / SYN ids, WP ids, sheet row (data README). Blanket 2026-10-25 | Q-021 |
| SD-8.9 | Decision | AI | S8 | answered | Dev: WP-1…WP-5, DS / SYN samples, golden fixtures, few-shot from Units 1–3 and other grades (AD-3). Held out: Grade 6 Unit 4 published lessons, never examples, read only locally for structural counts, reports outside tracked files (GR-11, R-53, PD-20). Seeded errors stay unseen by the generator prompts (R-52) [I]. Blanket 2026-10-25 | Q-021 |

## Batch log

| Batch | Date | Stage | Questions | Consequential inference | Reconciled into |
|---|---|---|---|---|---|
| 0 | 2026-10-25 | setup | Q-010 – Q-021 carried | The Stage 3 register settles every design-input choice; the sweep closes all 60 checklist items (52 answered, 7 assumed with plans, 1 n/a) | — |
| 1 | 2026-10-25 | S1–S9 | Q-001 – Q-009, Q-022, Q-023 | Innocent's instruction makes every recommendation the answer: no new hosting spend (local recording), a $75 model ceiling, questions not sent, no gate skipped, and the PRD approved as v1.0 | PRD header, §6.4 note, §9, §10 (PD-4–PD-7, PD-13–PD-15, PD-23–PD-30), §5.3 (R-60 and the reworded rows), §12 |
| 2 | 2026-10-25 | S3 | Q-006, Q-007 changed | Capacity becomes 500 users/day and a 200-concurrent-user spike; generation jobs stay capped separately | PRD PD-32–PD-34, §5.4 R-56/R-57; `docs/design/capacity-and-workload.md` |
