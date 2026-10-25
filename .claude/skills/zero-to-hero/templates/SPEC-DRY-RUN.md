# Spec Dry Run — <project>

Template: `zero-to-hero` v1.14.1 `templates/SPEC-DRY-RUN.md`. Filed at `docs/design/spec-dry-run.md`.
Stage: §6 Design, before the gate (`ARTIFACT-MAP.md` §6).

**What this is.** Before §6 closes, one agent tries to write the acceptance criteria for three
representative tickets **from the design alone**, the way a §7 spec writer will. Every criterion it
cannot write testably is a design gap: a missing signature, an untyped result, a service nobody says
how to build, an error the UI expects that no backend type produces. Each gap is closed in DO-3 or
DO-4 now, while it is cheap, and marked closed here. Why: on AEA (2026-10-21) the §6 gate passed and
the 7b spec writers then raised ~170 needs-decision items, mostly exactly these gaps.

Run it after `signature_check.py` exits 0; the script finds the mechanical gaps, this finds the rest
(constructors, settings fields, behaviour nobody wrote down).

---

## Part 1 — The brief to give the agent

Copy this block into the agent's prompt, with the bracketed parts filled in. Use one agent, on the
session's model (Opus on §6 work), with read-only access to the design.

> You are writing the acceptance criteria for three tickets, as a §7 spec writer would, using only
> the project's design documents. You may not invent a type, a field, an error, a constructor or a
> setting the design does not state. When you cannot write a criterion testably, do not guess: put it
> on the *Could not write* list with the exact missing fact.
>
> **The three tickets** (one of each kind; if the project has no graph, use its nearest equivalent,
> e.g. a pipeline step or job, and say so):
> 1. **Service:** <one internal service or adapter, e.g. `BookingService.book_slot`> — its DO-3 module: <path/anchor>
> 2. **Route:** <one HTTP route from the OpenAPI, e.g. `POST /api/chat/turn`> — its CON card: <CON-N>
> 3. **Graph node:** <one orchestration node, e.g. `classify_intent`> — its HP card: <HP-N>
>
> **Read these sources, and nothing else:**
> - DO-3 code design — <`docs/design/code-design.md`>
> - DO-4 component contracts — <`docs/design/component-contracts.md`>
> - DO-6 observability contract — <`docs/design/observability-contract.md`>
> - Shared interface spec — `docs/contracts/INTERFACE.md` and `docs/contracts/interface.openapi.yaml` (older projects: <`docs/ux/03-structure/UI_CONTRACTS.md`> and <`docs/ux/03-structure/ui-contracts.openapi.yaml`>)
> - Worked pairs — `docs/data/worked-pairs.md` (use a real WP-N as each ticket's example input and expected output)
> - User stories — `docs/ux/01-planning/USER_STORIES.md`
> - Hard-problem register — `docs/design/hard-problems.md`
> - Settings, if the design names a settings module — <path>
>
> **Output, for each ticket, in this exact shape:**
>
> ```
> ### T<n> — <kind>: <name>
> Sources used: <file#anchor, …>
> Story: US-<n>    Example pair: WP-<n>
>
> Acceptance criteria (each testable: given / when / then, with the exact type, field and value):
> - AC-1 Given …, when <call with its DO-4 signature>, then <result type>.<field> == <value>
> - AC-2 …
>
> Could not write:
> - <the criterion it wanted to write> — missing fact: <exactly what the design does not say,
>   e.g. "DO-4 gives `BookingService.book_slot` no result type", "no constructor for `KbRetriever`:
>   built from what, by whom?", "OpenAPI 409 `slot_taken` maps to no DO-4 error type",
>   "settings field for the retrieval top-k not named"> — where it should live: <DO-3 | DO-4 | DO-6 | settings>
> ```
>
> An empty *Could not write* list must say `none` explicitly. Return the three tickets and nothing else.

---

## Part 2 — The filed result

Paste the agent's three tickets here unchanged, then close each gap. Do not edit the agent's
criteria to make a gap disappear; fix the design and record where.

| Field | Value |
|---|---|
| Run date | YYYY-MM-DD |
| Agent / model | <agent, model> |
| `signature_check.py` result before the run | <result line, date> |
| Design versions read | <commit or date of DO-3, DO-4, DO-6, OpenAPI> |

### T1 — Service: <name>
<the agent's output>

### T2 — Route: <name>
<the agent's output>

### T3 — Graph node: <name>
<the agent's output>

---

## Part 3 — Gaps and how each was closed

Every *Could not write* item from Part 2 gets a row. The §6 gate needs every row `closed`.

| # | Ticket | Missing fact (as the agent named it) | Closed in (file#anchor) | Status | Date |
|---|---|---|---|---|---|
| G-1 | T1 | | | open / closed | |

**Result:** <n> gaps found, <n> closed, <n> open. `signature_check.py` re-run after the fixes: <result line, date>.
