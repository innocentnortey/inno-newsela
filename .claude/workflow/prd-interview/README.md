# prd-interview

A Claude Code skill that runs a **staged, adaptive interview** and keeps it in one living Markdown
document inside the target project. The interview settles product requirements and the inputs a
system design needs, then stops at explicit PRD approval and a design handoff. `SKILL.md` is the
procedure. This file explains the layout and history.

## How it works

- **One living document per scope.** It holds the stage map, questions with stable IDs (`Q-001`…),
  answers with append-only history, evidence, checklist coverage and the next batch. A new session
  resumes from the file, not from chat history. Format: `references/interview-document.md`.
- **Read before asking.** Existing documents are swept first. Settled answers are carried in with
  citations for review, and are not asked again.
- **Staged and adaptive.** The full stage map exists from setup. The first one or two stages have
  concrete questions; later stages hold provisional ones that earlier answers refine
  (`references/stage-map.md`). Each turn takes one stage and at most four questions.
- **Complete coverage.** Every item of `../system-design-readiness/CHECKLIST.md` gets an explicit
  disposition: answered with evidence, needs a decision, needs research, assumed with a measurement
  plan, or N/A with a reason. Project-specific questions sit alongside them.
- **Observability as a thread.** Each of the guideline's eight steps settles part of what the
  running system must show, recorded in the document's *Observability map*
  (`references/observability.md`). Operational success and output correctness stay separate, and
  no tracing tool is assumed.
- **Design outputs have records.** The document's *Design outputs* register names the owner,
  location and sources of the seven outputs every design must produce
  (`../system-design-readiness/DESIGN-OUTPUTS.md`): system design, architecture, code design,
  component contracts, evaluation plan, observability contract and key-metrics registry. The
  interview settles their purposes and policies; the design fills them. The completion gate fails
  on a missing row however many questions are answered (`references/design-outputs.md`).
- **Owners own.** Answers are reconciled into the PRD draft, decision record, open questions and
  design-input documents. The interview document records and links; it is not a second PRD.
- **Pluggable question packs** (data, not code) under `checklists/`: `generic-prd`,
  `ai-agent-app`, and `agentforge` for AgentForge-family sprints. Format:
  `references/pack-format.md`.

## Where it sits in the workflow

```
assignment or idea
  → prd-interview (this skill; living interview document)
  → explicit PRD approval
  → system-design-readiness (re-audits using the interview's coverage)       gate: design ready
  → system-design reasoning
  → architecture: responsibilities and semantic contracts
  → code design and component contracts; evaluation plan, observability
    contract and key-metrics registry filled alongside                     gate: ticket ready
  → to-tickets: coverage audit, then GitLab issues, only when asked
  → implementation planning per issue (reconciles the governing contracts)
  → implementation and verification                                         gate: implementation verified
```

The interview document's *Artifact map* and *Design outputs* register record where each of those
lives in the project.

## Layout

```
SKILL.md                         the interview procedure
references/interview-document.md the living document's format and completion gate
references/stage-map.md          default stages, depth, batching
references/observability.md      observability questions per stage, run traces, handoff
references/design-outputs.md     the seven required design outputs: interview's share vs design's
references/pack-format.md        checklist-pack schema
templates/interview.md           starting document
checklists/                      question packs (data)
scripts/interview.py             read-only coverage skeleton + document/gate checker
                                 (imports ../system-design-readiness/scripts/design_outputs.py)
scripts/checklist.py             pack loader/validator + section assembler
scripts/bridge.py                LEGACY — see below
tests/                           unittest suite
```

```bash
python3 scripts/interview.py skeleton                      # full coverage table
python3 scripts/interview.py check <doc>                   # structure
python3 scripts/interview.py check <doc> --complete        # completion gate
python3 -m unittest discover -s tests                      # stdlib only, no install
```

## History and the retired build engine

This skill was installed on 2026-09-14 from Kwabena's `prd-interview` (`labs.gauntletai.com/kwabenaadu-bonnah`, MIT). It emitted
a PRD for **tdd-swarm**, a sub-agent build engine, and `scripts/bridge.py` registered the approved
PRD as a `spec:*` handoff in tdd-swarm's `HANDOFFS.md` ledger. On 2026-09-19 the Gauntlet workflow
retired the custom build loop, local ledgers and agent roster. Tickets are now published directly
to GitLab with `to-tickets` and implemented with ordinary Git and tests
(`gauntlet-prd-workflow`).

What still applies from the original: batched questioning, checklist packs, testable acceptance
criteria for every functional requirement, and the approval gate. What does not: the tdd-swarm
handoff, `HANDOFFS.md`, the spec canary, and the `prd-interview-review` companion as a required
step. That review may still be run by hand on a high-stakes PRD, but nothing routes to it.

`scripts/bridge.py` and `tests/test_bridge.py` are kept unchanged. The tests still pass against the
reference copy of tdd-swarm in `../tdd-swarm`, and copies of this skill in other repos may still
contain them. The workflow does not call the bridge. Removing it, together with `../tdd-swarm`, is
a separate decision for the skill's owner.

## License

MIT.
