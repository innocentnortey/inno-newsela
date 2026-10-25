# Newsela Lesson Studio — project entry

## What this project is
A **hiring-partner project for Newsela, via Gauntlet AI** (brief title: *Lesson Content Generation and
Editing/Approval Workflow*). Newsela is entering California "Core" ELA/ELD instruction: 40-week
programs of 4 units × ~40 lessons. The tool takes an uploaded unit-outline Google Sheet, bulk-generates
standards-aligned ~50-minute lessons with an LLM, persists them, and gives staff reviewers a WYSIWYG
editor with AI assists plus an approval workflow. The issued brief lives in [`docs/source/`](docs/source/).
**Stack per the brief:** Next/Node + React (Python optional), OpenAI or Anthropic APIs, ProseMirror +
Yjs for the collaborative editor. The project follows `zero-to-hero` **2.0.0** (light mode); the
[project checklist](PROJECT-CHECKLIST.md) owns where it is now. **Since 2026-10-25 the authoritative working copy is on
the VPS** (`claude-vultr:/home/linuxuser/workspaces/inno-newsela`, PD-34), run by a two-phase launcher
([`ops/vps-run/`](ops/vps-run/README.md)): Opus through complete ticketing, then Sonnet through delivery. Any Mac copy is a
snapshot. Innocent's standing authorization (PD-32) lets Claude adopt its recommendations through the remaining stages.

## Non-negotiable boundaries
- **Pinned workflow.** Newsela runs on its own copies: `.claude/skills/{zero-to-hero,ux-pipeline}`, `.claude/workflow/{to-tickets,system-design-readiness,prd-interview}`, `.claude/agents/`, `.claude/rules/`, recorded in `ops/vps-run/workflow-lock.json`. The user-level `~/.claude/skills/to-tickets` on the VPS is an older copy frozen for an unrelated experiment: never use it here. Workflow changes only at a stage or wave boundary (`launcher.py lock --note`).
- **No design docs, tickets or feature code ahead of their gate.** Stages run in order; a skip needs Innocent's own yes. Checklist: [PROJECT-CHECKLIST.md](PROJECT-CHECKLIST.md).
- **Open with the business value, prove the brief's problem, close on the metric.** Rule: [hiring-partner-framing](.claude/rules/hiring-partner-framing.md).
- **Audit the brief before building it; frame the problem behind it.** Rules: [problem-framing](.claude/rules/problem-framing.md), [business-metrics](.claude/rules/business-metrics.md).
- **HTML means a local file, never a Claude Artifact.** Rule: [html-files-not-artifacts](.claude/rules/html-files-not-artifacts.md).
- **Version on Gauntlet GitLab** (private project `innocentnortey/inno-newsela`, id 2346). The VPS run commits on `main` and pushes to `origin` only (factory mode; PD-34); never another remote. Rule: [gauntlet-gitlab-versioning](.claude/rules/gauntlet-gitlab-versioning.md).
- **Demo runs locally under Docker Compose with the deploy config committed** (PD-15 option D: no new hosting spend); Render stays the default host if Innocent approves the spend. Rule: [gauntlet-hosting-default](.claude/rules/gauntlet-hosting-default.md).
- **Only `lane::build-loop` tickets enter the build loop; only affected tests run.** Rules: [ticket-lanes](.claude/rules/ticket-lanes.md), [build-loop-test-scope](.claude/rules/build-loop-test-scope.md).
- **Test, eval and demo data is synthetic, seeded and traceable to its script; never real student or staff data.** Rule: [synthetic-test-data](.claude/rules/synthetic-test-data.md).

## Read only what the task needs
**Start at the router: [`.claude/README.md`](.claude/README.md).** These are ordinary links, not imports.

| Task | Read |
|---|---|
| Which document wins a disagreement | The *Authority* list below |
| Understand the brief or the partner | [`docs/source/`](docs/source/), then the router's *Stage 1* rows |
| Frame the problem, metrics, PRD | [problem-framing](.claude/rules/problem-framing.md), [business-metrics](.claude/rules/business-metrics.md), [`docs/principles/`](docs/principles/README.md) |
| Design the system or an agent | [system-design-questioning](.claude/rules/system-design-questioning.md), [agent-architecture](.claude/rules/agent-architecture.md), [`docs/principles/system-design.md`](docs/principles/system-design.md) |
| Build a review page | [html-files-not-artifacts](.claude/rules/html-files-not-artifacts.md) and the zero-to-hero `references/visual-review-pages.md` |
| Anything that moves a file, route or owner | [maintenance rule](.claude/rules/context-maintenance.md) |
| Start or resume work | [`.claude/state/resume.md`](.claude/state/resume.md), then [PROJECT-CHECKLIST.md](PROJECT-CHECKLIST.md) |
| Build or plan a ticket (§8) | [Phase B handoff](docs/plans/HANDOFF-PHASE-B.md), the ticket in [`docs/plans/tickets/`](docs/plans/tickets/), the [area map](.claude/reference/area-map.md) |
| Change a shared contract | [`docs/contracts/CHANGES.md`](docs/contracts/CHANGES.md) (every change to an agreed card is a `CHG-N`) |

## How this project is governed
Entry points **route**, rules **prohibit**, references **explain**, canonical documents **prove**.

| Concern | Owner |
|---|---|
| Where anything is, what to load | [router](.claude/README.md) |
| How to keep context true while working | [maintenance rule](.claude/rules/context-maintenance.md): read on any task that moves code or an owner |
| Context-system maturity | [ICM progress checklist](.claude/state/icm-progress.md) |
| Requirements | The issued brief in [`docs/source/`](docs/source/); our PRD [`docs/prd/newsela-prd.md`](docs/prd/newsela-prd.md) (v1.0, approved at §4) |
| Product stage and gates | [PROJECT-CHECKLIST.md](PROJECT-CHECKLIST.md) |
| Submission deliverables | [SUBMISSION.md](SUBMISSION.md) |
| Where we left off | [`.claude/state/resume.md`](.claude/state/resume.md) |
| Run history | [dev log](docs/devlog/) |

**Authority (which document wins a disagreement), highest first:**
1. The ISSUED Newsela brief in `docs/source/` (word for word).
2. Innocent's recorded decisions (PRD decision table, with date and his words).
3. The PRD, then the brief audit and framing docs in `docs/analysis/` and `docs/delivery/`.
4. Company research and context notes. Live code and tests prove behaviour, never intent.
