> **Provenance:** copy of `Nortorious-Technologies/.claude/rules/fanout-plan-then-implement.md` (VPS version, the newer one), copied 2026-10-25 when Newsela's workflow was pinned. Change the original first, then re-copy.
> **Local adaptation (PD-34):** in Newsela's Phase B every planner, implementer, reviewer and explorer runs on **Sonnet**; where this rule names Opus or Haiku for a step, PD-34 wins.

# Fan-Out Coding Work → a Planner, Then an Implementer

Recorded 2026-10-19 at Innocent's instruction, during the Riverside UX-4 build: "i rather have an
agent that plans and then an implementer agent that goes and executes if its a coding task for
these fanout agents in this process." Applies to every project under Nortorious-Technologies.

**What it means in practice.** When an orchestrating session splits coding work into parallel
slices (five screen groups of a prototype, one spike option each, a batch of review fixes), each
slice goes to **two agents in sequence**, not one general-purpose agent:

1. **`fanout-planner`** reads the slice's specs and the current code and writes a plan file. It writes no code.
2. **`fanout-implementer`** builds from that plan, only inside the slice's owned files, runs the checks and reports evidence.

Example: UX-4 group G3 (consent and ID screens). The planner reads SCREEN_SPECS SCR-9…12, the CON
cards and the shared components, and writes `docs/plans/fanout/2026-10-19-ux4/g3.md`. That plan
lists every spec'd state, how each one is reached, the exact contract shapes, the owned files and
the checks. The implementer builds the four screens from it and reports each state as verified or
not.

**Why.** Planning is context-heavy reading; implementing is careful editing. Splitting them gives
the orchestrator a written plan to check for collisions and gaps **before** code exists, and gives
the implementer a fixed target it can be held to. The plan file also survives as the record of
what each slice was meant to do, which the reviewer and the next session can read. Cerbo and
Equinox already work this way (`cerbo-ticket-planner` → `cerbo-ticket-builder`); this rule makes it
the default for all fan-out coding.

## How to apply

- **Project-specific pairs win.** If the project has its own planner and builder agents (e.g.
  `cerbo-*`, `equinox-*`), use them. Otherwise use `fanout-planner` → `fanout-implementer`
  (`.claude/agents/`).
- **Give the planner the boundary up front:** the slice, the specs, the owned files, the read-only
  shared surfaces, the checks and the plan path (default
  `<project>/docs/plans/fanout/<YYYY-MM-DD>-<topic>/<slice>.md`).
- **Dispatch all planners in one message.** Read each plan as it returns. Check owned files don't
  overlap and shared-primitive requests don't conflict. A plan marked `NEEDS-DECISION` goes to
  Innocent (rule `decision-requests-story-driven`), never to the implementer. Then dispatch each
  slice's implementer with its plan path. Pipelining is fine: an implementer may start as soon as
  its own plan is checked.
- **Shared foundation first.** Work that every slice depends on (app shell, shared types,
  registry, harness) is one planned slice that finishes before the fan-out starts.
- **Reviews stay separate.** After integration, the project's reviewer (`code-review-agent` on
  Sonnet by default) inspects the result. Its findings are fixed through the same pair when they
  span several files or slices. A one-file fix under about 30 lines may go straight to a
  `fanout-implementer` with the plan written inline by the orchestrator.
- **Model.** The planner inherits the session's model (on the VPS, Innocent's model per
  `~/.claude/rules/match-model-on-vps.md`). **The implementer runs on Sonnet** (`model: sonnet` in its
  definition; Innocent, 2026-10-19: "in building the actual thing doing the implementing in our build loop
  should be sonnet and not opus"). That makes the plan the load-bearing artifact: the planner writes it
  implementer-ready (exact paths, copied signatures, named tests and commands, every decision made); for
  `risk::security` slices only, the `test-writer-agent` freezes failing tests first (other slices: the implementer
  writes the plan's named tests with the code; rule `build-loop-test-scope`), and the reviewers and auditors (`code-review-agent`,
  `security-privacy-agent`, `resource-pressure-agent`, `seam-audit-agent`; `qa-agent` already was) run
  on Sonnet too (Innocent, 2026-10-19: "for all our review and security agents in our build loop change
  them to sonnet"). A slice the implementer cannot finish from its plan goes back
  to the planner, not to a bigger model.
- **Which model does which step, across the whole pipeline** (Innocent, 2026-10-21, after AEA's first slicing ran
  on Sonnet: "we should have been using Opus to create the slices"; and "especially haiku can search through
  quickly"):

  | Step | Model |
  |---|---|
  | Slicing, ticket specs, resolving open items, planners, design judgement | Opus |
  | Fast search and evidence sweeps (grep the sources, quote passages, no decisions) | Haiku |
  | Implementers, code review, security and other audits | Sonnet |

  Set `model:` explicitly on every Agent call; never rely on inheritance. **Check the model actually ran**
  before relying on it. On 2026-10-21 the five `model: haiku` sweeps were reported as not Haiku, but their
  transcripts record `message.model = claude-haiku-5-5`. Check the served model from the transcript
  (`message.model` vs `requestedModel`) or the `PostToolUse(Agent)` `resolvedModel`, never the agent's
  self-report. Split long lists by topic so each shared item has one owner; never hand one agent a list that
  parallel agents could split.

## What this rule does not cover

- **Non-coding fan-out** uses the agent that fits: `Explore` for searches, `research-brainstorm-agent`
  for approach options, `code-review-agent` / `qa-agent` / `security-privacy-agent` for gates.
  `general-purpose` is the last resort; say why when using it.
- **Single, sequential coding work** done by the session itself needs no planner agent.
- It does not authorize worktrees, commits or pushes; those keep their own rules.

## Callers

`ux-pipeline` UX-4 (`skills/ux-pipeline/references/phases.md`) and `zero-to-hero` Stage 5 spikes
(`skills/zero-to-hero/references/spikes.md`) name this pair for their fan-out steps.
