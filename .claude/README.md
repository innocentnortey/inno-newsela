# Newsela Lesson Studio — context router

Start here after [`CLAUDE.md`](../CLAUDE.md). Each row sends a recognisable request to the files it
needs and says how you know it is done. Load only the row you need; history lives in the dev log.

**Common context for every task:** [maintenance rule](rules/context-maintenance.md) ·
[ICM progress checklist](state/icm-progress.md) · [project checklist](../PROJECT-CHECKLIST.md) ·
[resume checkpoint](state/resume.md) · [dev log](../docs/devlog/README.md).

Status words: **exists** (file present) · **in progress** (another agent is writing it; path planned) ·
**planned** (a later stage creates it; not a claim that it exists).

## Stage 1 — frame (sources, audit, framing, PRD)

| Request | Read / write | Rules | Done when | State |
|---|---|---|---|---|
| What did Newsela actually ask for? | [`docs/source/`](../docs/source/): brief [`01-project-brief.md`](../docs/source/01-project-brief.md), [source register](../docs/source/source-register.md) (S-N / C-N / D-N ids) | [problem-framing](rules/problem-framing.md) | Sources ranked ISSUED → PROPOSED → DERIVED → CONTEXT in the register | exists |
| What does the outline sheet contain, and what is wrong with it? | [`02-sample-unit-outline.md`](../docs/source/02-sample-unit-outline.md); rows as JSON in [`docs/data/samples/g6-u4-lesson-outline.json`](../docs/data/samples/g6-u4-lesson-outline.json) | [synthetic-test-data](rules/synthetic-test-data.md) | Column meanings, oddities and sheet ↔ published mapping written | exists |
| What shape is a Newsela lesson? | [`04-lesson-structure-analysis.md`](../docs/source/04-lesson-structure-analysis.md) (ProseMirror schema, teacher/student editions, draft output contract) | [problem-framing](rules/problem-framing.md) | Draft output contract written; PRD adopts it | exists |
| Which standards does the sheet cite? | [`05-standards-referenced.md`](../docs/source/05-standards-referenced.md) (official CDE text per code) | [problem-framing](rules/problem-framing.md) | Every sheet code checked against CDE text | exists |
| How were the sources captured; repeat a capture | [`capture-notes.md`](../docs/source/capture-notes.md) | [synthetic-test-data](rules/synthetic-test-data.md) | Steps reproducible | exists |
| Full Newsela captures, held-out eval set (S-5) | `docs/source/restricted/` — **git-ignored; never quote into tracked docs or prompts**, never a few-shot or retrieval source; handling rule in the [source register](../docs/source/source-register.md) | [synthetic-test-data](rules/synthetic-test-data.md) | `git check-ignore` matches it | exists (local only) |
| Audit the brief: traps, real problem | [`docs/analysis/2026-10-24-brief-audit.md`](../docs/analysis/2026-10-24-brief-audit.md), from [`audit-parts/`](../docs/analysis/audit-parts/) (legal, ethical, engineering) | [problem-framing](rules/problem-framing.md), [business-metrics](rules/business-metrics.md) | Opens with *The problem behind this brief*; why-chain; hop chain to money | exists |
| Who is Newsela, what market | [`docs/analysis/2026-10-24-newsela-company-profile.md`](../docs/analysis/2026-10-24-newsela-company-profile.md), from [`company-research/`](../docs/analysis/company-research/) (business and customers, CA core market, reviews and sentiment, website features) | [hiring-partner-framing](rules/hiring-partner-framing.md) | Sources cited and dated | exists |
| Which product direction | [`docs/analysis/2026-10-24-product-direction.md`](../docs/analysis/2026-10-24-product-direction.md) | [problem-framing](rules/problem-framing.md) | Options with consequences; Innocent's pick recorded | exists |
| Two layers of success, demo angle | [`docs/delivery/2026-10-24-angle-and-demo-framing.md`](../docs/delivery/2026-10-24-angle-and-demo-framing.md) | [hiring-partner-framing](rules/hiring-partner-framing.md), [business-metrics](rules/business-metrics.md) | Metrics tree with baseline / aspiration / hard gate | exists |
| Write or change the PRD | [`docs/prd/newsela-prd.md`](../docs/prd/newsela-prd.md) (v1.0; §5.4 Stage 3 amendments; §10 decisions) | [system-design-conversation](rules/system-design-conversation.md), [system-design-questioning](rules/system-design-questioning.md) | A change reopens its interview question (`docs/prd/interview.md`) | exists (v1.0 approved 2026-10-25) |
| Stage 1 review page | `docs/artifacts/2026-10-24-newsela-prd.html`, built after the Markdown above | [html-files-not-artifacts](rules/html-files-not-artifacts.md) | `check_review_page.py` passes; laptop + phone width; §1 gate signed by Innocent | exists (check passes 2026-10-24; §1 gate ticked under pre-approval) |
| Source → Stage 1 page | PRD, audit, framing, direction and profile → `docs/artifacts/2026-10-24-newsela-prd.html` | [html-files-not-artifacts](rules/html-files-not-artifacts.md) | A change to any of them is carried onto the page before the §1 gate | historical: shows PRD v0.1 (v1.0's changes: Stage 3 page, `interview.md`); its check reports the PRD as stale |

## Later stages (planned paths, per zero-to-hero `ARTIFACT-MAP.md`)

| Request | Read / write | Rules | State |
|---|---|---|---|
| Sample data, worked pairs (§2) | [`docs/data/README.md`](../docs/data/README.md) (sample set + selection matrix), [`docs/data/worked-pairs.md`](../docs/data/worked-pairs.md) (WP-1…WP-5, U1–U10), [`docs/data/samples/`](../docs/data/samples/) (rebuild: `python3 docs/data/scripts/build_samples.py`) | [synthetic-test-data](rules/synthetic-test-data.md) | exists |
| Stage 2 review page | [`docs/artifacts/2026-10-24-data-reality.html`](../docs/artifacts/2026-10-24-data-reality.html), built from the two §2 files and the PRD; a change to any of them is carried onto the page | [html-files-not-artifacts](rules/html-files-not-artifacts.md) | exists (check passes 2026-10-24; §2 gate ticked under pre-approval) |
| UX planning (UX-1): stories, flows with draft contracts, sitemap | [`docs/ux/01-planning/`](../docs/ux/01-planning/) (US-1…37, FLOW-1…19, SCR-1…21, CON-1…24); page [`docs/artifacts/2026-10-25-ux-1-planning.html`](../docs/artifacts/2026-10-25-ux-1-planning.html) | [synthetic-test-data](rules/synthetic-test-data.md) | exists (UX-1 closed 2026-10-25) |
| UX-2: feel brief, references, directions, look sheets | [`docs/ux/02-concepts/`](../docs/ux/02-concepts/), [`DESIGN-DIRECTIONS.md`](../docs/design/DESIGN-DIRECTIONS.md), `docs/artifacts/2026-10-25-d*-look-sheet.html`, [shortlist page](../docs/artifacts/2026-10-25-ux-2-directions.html) | [html-files-not-artifacts](rules/html-files-not-artifacts.md) | exists (D1 Clear Ledger picked) |
| Shared contracts (UX-3a) and screens (UX-3b) | [`docs/contracts/INTERFACE.md`](../docs/contracts/INTERFACE.md) (CON-1…24 agreed), [`interface.openapi.yaml`](../docs/contracts/interface.openapi.yaml) (Prism mock; types in `docs/contracts/generated/`), [`CHANGES.md`](../docs/contracts/CHANGES.md); [`docs/ux/03-structure/`](../docs/ux/03-structure/) (IA, SCR-1…21 signed), [`design.md`](../docs/design/design.md) (tokens) | [ticket-lanes](rules/ticket-lanes.md) | exists |
| Hard problems (§3): which option each problem took, spikes SP-1…SP-3 | [`docs/design/hard-problems.md`](../docs/design/hard-problems.md) (HP-1…HP-10, *Handled by default*, system-design walk) | [agent-architecture](rules/agent-architecture.md), [retrieval-and-context](rules/retrieval-and-context.md) | exists (all chosen 2026-10-25) |
| Stage 3 review page | [`docs/artifacts/2026-10-25-hard-problems.html`](../docs/artifacts/2026-10-25-hard-problems.html), built from the register and the worked pairs; a change to either is carried onto the page | [html-files-not-artifacts](rules/html-files-not-artifacts.md) | exists (check passes 2026-10-25; §3 gate ticked under Innocent's instruction) |
| Interview record (§4): what was asked, answered, carried; checklist coverage; design-outputs register DO-1…DO-7 | [`docs/prd/interview.md`](../docs/prd/interview.md) (check: `python3 "../Gauntlet AI/.claude/skills/prd-interview/scripts/interview.py" check docs/prd/interview.md --complete`) | [system-design-questioning](rules/system-design-questioning.md) | exists (complete 2026-10-25) |
| System and code design (§6) | DO-1…DO-7 in [`docs/design/`](../docs/design/) (register in [`interview.md`](../docs/prd/interview.md)); code map: [area map](reference/area-map.md); [readiness report](../docs/design/system-design-readiness.md); [spec dry run](../docs/design/spec-dry-run.md); [reviews](../docs/design/reviews/); page [`2026-10-25-system-design.html`](../docs/artifacts/2026-10-25-system-design.html) | [code-design-solid-modularity](rules/code-design-solid-modularity.md), [design-doc-defense](rules/design-doc-defense.md) | exists |
| Tickets and build (§7–§8) | [slice plan](../docs/plans/slice-plan.md); tickets [`docs/plans/tickets/`](../docs/plans/tickets/) (published to GitLab 2346, which owns status); board [`tickets.md`](../docs/plans/tickets.md) (generated by `docs/plans/scripts/build_board.py`); [coverage audit](../docs/plans/coverage-audit.md); [Phase B handoff](../docs/plans/HANDOFF-PHASE-B.md) | [ticket-lanes](rules/ticket-lanes.md), [build-loop-test-scope](rules/build-loop-test-scope.md) | exists |
| Delivery docs (§9–§10), draft 1 | [decision inventory](../docs/delivery/demo-decision-inventory.md) (draft 2, 40 ranked rows, 300 s budget, NL-131), [operating instructions](../docs/delivery/operating-instructions.md), [error-analysis plan](../docs/testing/error-analysis/README.md) (not yet run); demo script and capacity report planned, need measurements; [`QA_REPORT.md`](../docs/ux/05-verify/QA_REPORT.md) exists (NL-126, stub stack only; findings F-1…F-18, issues #148–#165) | [hiring-partner-framing](rules/hiring-partner-framing.md), [synthetic-test-data](rules/synthetic-test-data.md) | proposed (drafts from the written record; none verified by running) |
| Plan or build in one area: how it works, what to check first | [area routes](reference/routes/README.md) (one file per area); open seam defects [`seam-followups.md`](../docs/plans/seam-followups.md) | [maintenance](rules/context-maintenance.md) | exists (5 routes, as of `9951739`) |
| VPS run: launcher, prompts, logs, checkpoints, workflow lock | [`ops/vps-run/README.md`](../ops/vps-run/README.md); capacity [`docs/design/capacity-and-workload.md`](../docs/design/capacity-and-workload.md) | [ticket-lanes](rules/ticket-lanes.md) | exists |
| Architecture write-up (§10 Technical Documentation) | [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md), a draft map linking DO-1…DO-7 (live numbers `pending: NL-n`; NL-139 finalizes) | [design-doc-defense](rules/design-doc-defense.md), [hiring-partner-framing](rules/hiring-partner-framing.md) | exists (draft, NL-04) |
| UX traceability: SCR → US → CON → FE/INT ticket → test and evidence | [`docs/ux/05-verify/TRACEABILITY.md`](../docs/ux/05-verify/TRACEABILITY.md) (chain generated by `trace_check.py`; per-ticket rows edited by their own ticket) | [ticket-lanes](rules/ticket-lanes.md) | exists (skeleton, NL-05; every evidence cell `planned`) |
| Run and Compose instructions (§10 Technical Documentation) | [`README.md`](../README.md): prerequisites, local run through `with-provider-env`, services and ports, command list, deploy note, docs map (NL-139 finalizes) | [gauntlet-hosting-default](rules/gauntlet-hosting-default.md) | exists (NL-52) |
| Submission (§10) | [`SUBMISSION.md`](../SUBMISSION.md) | [hiring-partner-framing](rules/hiring-partner-framing.md) | exists |
| Reasoning behind a rule (GP-N) | [`docs/principles/`](../docs/principles/README.md) | — | exists |

**Fallback — a task no row covers:** read the issued brief in `docs/source/` and the project checklist,
ask Innocent only if the meaning is genuinely open, then add the route here in the same task.

## Setup profile

| Item | Value |
|---|---|
| Work home | **VPS (authoritative since 2026-10-25):** `claude-vultr:/home/linuxuser/workspaces/inno-newsela`; the Mac copy is a snapshot |
| Remote / host | GitLab `innocentnortey/inno-newsela` (private, id 2346; created by Innocent 2026-10-25) · demo locally under Docker Compose (PD-15 option D) |
| Collaboration | Innocent decides; Claude drafts. Factory mode on the VPS (PD-34): the run commits on `main` and pushes to `origin` only |
| Adopted methods | `zero-to-hero` v2.0.0 (light; pinned in `.claude/`) · `icm-project` v1.5.0 · principles pack copied 2026-10-24 (provenance line in each rule) |
| Dev log | [`docs/devlog/`](../docs/devlog/README.md), one file per run |
