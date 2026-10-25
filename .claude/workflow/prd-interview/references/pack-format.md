# Checklist-pack format

A checklist pack is DATA (a markdown file under `checklists/<name>.md`) that drives the
PRD interview. The engine (`scripts/checklist.py`) is pack-agnostic; swapping the pack
swaps the domain rigor without code changes. This keeps a lean `generic-prd` track and a
detailed `ai-agent-app` track (and any future track) as pure data.

## File shape

```markdown
# Checklist: ai-agent-app
- Version: 1.0.0
- Track: ai-agent-app
- Description: PRD interview for AI-agent applications.

## Phase 1: Constraints
### domain
- Prompt: Which domain? (healthcare / insurance / finance / legal / custom)
- Required: true
- Section: problem-objective
- Escalate: verification, reliability, security   # if answered high-stakes, mark these required

### use-cases
- Prompt: What specific use cases will you support?
- Required: true
- Section: functional-requirements

## Phase 2: Architecture
### agent-framework
- Prompt: LangChain / LangGraph / CrewAI / custom? Single vs multi-agent?
- Required: false
- Default: custom, single-agent (revisit if tool-count grows)
- Section: system-architecture
```

## Grammar

- `# Checklist: <title>` — one per file, followed by `- Version:`, `- Track:`, `- Description:` fields.
- `## Phase N: <name>` — a phase groups related questions (used for batching: one batch ≈ one phase).
- `### <question-id>` — a stable kebab-case id, then these `- Key: value` fields:
  - `Prompt:` (required) — the question text shown to the user.
  - `Required:` (`true`/`false`, default `false`) — must-answer vs skippable.
  - `Section:` (required) — which PRD section this answer feeds (see section ids below).
  - `Default:` (optional) — a sensible default the user can accept in one word when not required.
  - `Escalate:` (optional) — comma-separated question ids to flip to Required when this answer signals high stakes.

## PRD section ids (assembler target)

Questions map into these sections, in order:
`problem-objective`, `users-scope`, `audience-tone-constraints`, `motion-profile`,
`functional-requirements`, `non-functional-requirements`, `system-architecture`,
`tool-integration`, `verification-correctness`, `observability-ops`, `failure-modes-security`,
`testing-strategy`, `release-iteration`, `acceptance-criteria`, `open-questions`.

`motion-profile` holds one value out of `product` / `marketing` / `game` / `editorial`. It is a
build-wide context declaration for UI motion, like `audience-tone-constraints`: declare it once
and carry it intact into design and tickets. Skip it when there is no UI.

`acceptance-criteria` is special: the assembler must ensure every question mapped to
`functional-requirements` has at least one corresponding testable criterion, so each criterion can
become a verification contract when `to-tickets` slices the approved PRD.

## Packs in the living interview

A pack supplies questions; it does not set the stages. In the living interview document each pack
question becomes a `Q-NNN` with `Sources: pack:<track>/<id>`, placed in a stage by its section
(`stage-map.md` → *Default stages*). Coverage of the readiness checklist is required whichever
pack is used, or with no pack at all.

## What the loader must do (`load_pack(path)`)

Return a dict `{version, track, description, phases: [{name, questions: [{id, prompt, required, section, default, escalate:[...]}]}]}`.

## What validation must catch (`validate_pack(pack)`)

- Every question has a non-empty `prompt` and a `section` that is one of the known section ids.
- `required` parses to a bool.
- Every `escalate` target references a question id that exists in the pack.
- At least one question maps to `functional-requirements` and one to `acceptance-criteria`.
Return a list of error strings (empty = valid).
