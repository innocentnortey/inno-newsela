# Required Design Outputs

**What this is:** the list of things a design must produce before anyone cuts tickets, and the
least each one must contain. It exists because evaluation, observability and metrics kept
disappearing between handoffs: the interview settled a policy, the design mentioned it, and the
tickets quietly dropped it. A required output with an owner, a location and a status cannot drop
silently, because the checkers ask for it by ID.

**Who reads it:** `prd-interview` (records where each output will live), `system-design-readiness`
(checks the inputs each one needs), the design work itself (fills them), and `to-tickets` (refuses
to cut tickets until they are ready, then traces every mandatory requirement through them).

Added 2026-10-11. Checker: `scripts/design_outputs.py`. Templates: `templates/`.
2026-10-21: added *Before the ticket-ready gate* (signature completeness, a spec dry run and the
coverage requirements sweep), after the AEA call-center run (zero-to-hero 1.14.0).
2026-10-25: zero-to-hero 2.0.0 (approved; `zero-to-hero/proposals/2026-10-25-concurrent-frontend.md`).
DO-4 links to the canonical interface spec in `docs/contracts/` and never restates its promises;
the ticket-ready gate is now one input to **per-ticket** readiness (see *Four gates*).

---

## The seven outputs

Outputs are **logical**, not files. A small project may keep all seven as named sections of one
design document; a large one may give each its own file. What is required is that each has an
owner, a location, its source references and a status.

| ID | Output | What it answers | Minimum contents |
|---|---|---|---|
| DO-1 | System design | Why this shape meets the promises within the limits | The eight steps of `GUIDELINE.md` at the depth the readiness report set, with the decision sentence for each major choice |
| DO-2 | Architecture | Which components exist and what each is responsible for | Components, responsibilities, data authority, the semantic contract at each boundary, every place a model decides |
| DO-3 | Code design | Which modules, types and functions implement the components | Modules, exact types and signatures, error types, where each contract lives in code; per module its one-sentence responsibility, interface and dependency direction, each seam cut or deferred (workspace rule `code-design-solid-modularity.md`) |
| DO-4 | Component contracts | What crosses each boundary between components | Per contract: producer, every consumer, the exact shape, errors and refusals, versioning. External behaviour is **linked** to its `CON-N` in `docs/contracts/` (see *DO-4 and the interface spec*), never restated |
| DO-5 | Evaluation plan | How we know the output is right | See *Evaluation plan* below |
| DO-6 | Observability contract | How we know what ran, for every workflow | See *Observability contract* below |
| DO-7 | Key-metrics registry | Which numbers inform which decisions | See *Key-metrics registry* below |

DO-1 to DO-4 were already part of the design handoff (system-design reasoning → architecture →
code design). DO-4 is named separately so that a contract's **consumers** are listed in one place:
the coverage audit in `to-tickets` uses that list to find consumers no ticket integrates.

### DO-4 and the interface spec

From zero-to-hero 2.0.0 each project has **one canonical interface specification**, agreed jointly by
the UX and System tracks from UX-1 onward (UX-3a): `docs/contracts/INTERFACE.md` (the behavioural
cards `CON-N`, each `draft` → `proposed` → `agreed`, or `changing`), `docs/contracts/interface.openapi.yaml`
(the machine form; generated types, Prism mocks and contract checks all read this one file) and
`docs/contracts/CHANGES.md` (the `CHG-N` log). The UX side owns what a screen *needs*; the System
side owns how it is *supported* (feasibility, guarantees, timing, errors).

DO-4 sits under that spec, not beside it:

- every DO-4 contract that serves external behaviour names its `CON-N` and links to the card;
- DO-4 adds the **internal** signatures (producers, consumers, types, constructors, error types),
  never new external behaviour, and never repeats or contradicts a card's guarantees, timing,
  errors or permissions. If design work finds a card is wrong or unsupportable, the fix is a
  `CHG-N` through the change procedure (identify → review → update `INTERFACE.md`, the OpenAPI,
  DO-4 links and screen specs → mark affected work `reconcile: CHG-N`), not a different promise in DO-4;
- DO-4 is `ready` only when every `CON-N` it links is `agreed`, or the gap is a recorded open item.

Projects with the old layout (`docs/ux/03-structure/UI_CONTRACTS.md`) keep that file as a pointer to
`docs/contracts/`, or migrate it.

## The register

Each project keeps **one register** of the seven outputs. It lives in the `prd-interview` document
(section *Design outputs*) when one exists, otherwise in the readiness report. Never keep two.
Template: `templates/design-outputs.md`.

```markdown
| ID | Output | Owner | Location | Sources | Status | Notes |
|---|---|---|---|---|---|---|
| DO-5 | Evaluation plan | Innocent | docs/design/system-design.md#Evaluation plan | SD-8.1, SD-8.8, SD-2.7; D-14 | planned | — |
| DO-7 | Key-metrics registry | Innocent | KEY_METRICS.md | SD-2.9, SD-2.8; PRD §6 | draft | denominators open for M-4 |
```

| Column | Content |
|---|---|
| Owner | The person or role who approves the output. |
| Location | A path, optionally with `#Heading` for a named section. `unknown — ask` is allowed only while the interview is running. |
| Sources | The readiness items (`SD-x.y`), decisions, requirements or source sections the output draws on. |
| Status | `planned` (owner and location chosen, not written), `draft` (written, minimum contents incomplete or unreviewed), `ready` (minimum contents present and approved by the owner), `n/a` (does not apply; the reason goes in Notes). |

**N/A must be justified and owned.** An `n/a` row still names its Owner (the person who accepted
the N/A); Location and Sources may be `—`. The reason is one line a reviewer could disagree with: "No model, retrieval,
ranking or tuned heuristic; every expected answer is a deterministic acceptance test in the PRD" is
a reason. "Not needed" is not. Prefer a **light** output over N/A: a deterministic CRUD app still
has an evaluation plan, it is just three lines long (authority = the PRD's acceptance criteria,
cases = the acceptance tests, no held-out set because nothing is tuned).

## Four gates, kept separate

Each gate asks a different question. Passing one never implies the next.

| Gate | Question | Who runs it | What it requires of the register |
|---|---|---|---|
| **Interview complete** | Are the purposes, promises, policies and decisions settled? | `prd-interview` (`interview.py check --complete`) | Every output has a row with an owner, a known location and sources (an `n/a` row: owner and reason). Any status. |
| **Design ready** | Do we have the inputs to design? | `system-design-readiness` (`design_outputs.py check --gate readiness`) | As above, and every output that is not `n/a` cites at least one readiness item (`SD-x.y`) in Sources. |
| **Ticket ready** | Is the design complete enough to cut feature tickets from? | `to-tickets` step 0 (`design_outputs.py check --gate tickets`) | Every output is `ready` or `n/a`, and DO-5, DO-6 and DO-7 pass their minimum-content checks. |
| **Implementation verified** | Did the built system meet the contracts? | `to-tickets` coverage audit at `--stage verify` | Every coverage row carries `verified:` evidence (see `to-tickets/references/coverage-audit.md`). |

**The ticket-ready gate is per ticket kind** (zero-to-hero 2.0.0, spec §3), and this register's gate
is one of its inputs. Backend and frontend feature tickets need it passed (the §6 gate) plus their
own contract and screen conditions; integration tickets are planned any time and executed once
the tickets they join are merged; early foundation (FW) tickets need the UX-2 direction, the design
tokens and `docs/plans/foundation-wave.md`, **not** this gate. The per-ticket check is
`zero-to-hero/scripts/ticket_readiness.py`; the full table is in `to-tickets` §0. Nothing here
relaxes the gate for feature tickets.

The interview settles **why and what**: what each workflow must show, who decides a correct
answer, which decisions metrics inform, what data may be recorded. The design stages settle **how**:
record fields, case files, formulas, emitting components. Tickets settle **who builds which part**.
Implementation verification settles **whether it happened**.

---

## Evaluation plan (DO-5)

Answers "was it right?". Keep it apart from "did it run?" (DO-6) everywhere: a green trace is not a
correct answer.

Required sections (the checker matches these headings, in any order, at any heading level):

| Section | Must say |
|---|---|
| **Expected-answer authority** | For each evaluated behaviour, who or what decides the correct answer: an issued spec, a named domain reviewer, a deterministic rule, an external reference. A model is never its own authority. |
| **Case provenance** | Where each case comes from (issued, hand-written, synthetic from a known source, promoted from a reviewed trace), and how a case records that origin. |
| **Development and held-out separation** | Which cases may be read and tuned against while building, which are held out, and who may read the held-out set. `N/A — <reason>` when nothing is tuned against cases. |
| **Scoring** | How each case is scored (assertion, invariant, trajectory, judge, human) and how case scores roll up. A judge enters scoring only after calibration against human labels. |
| **Failure categories** | The named categories a failing case is filed under, so results say *where* to fix, not just *how many* failed. |
| **Baselines** | The current or comparison result for each suite, or `none yet — Plan: <first run that sets it>`. |
| **Acceptance conditions** | What result accepts the system, tied to metric IDs in DO-7 where one exists. Safety and refusal checks stated as invariants, not averages. |
| **Verification and evidence** | The command or procedure that runs each suite and the evidence a reviewer sees (report path, run ID). |

Template: `templates/evaluation-plan.md`. AI and retrieval systems also use the component layers in
`gauntlet-prd-workflow/templates/eval-plan.md`.

## Observability contract (DO-6)

Answers "what ran, and can we prove it?" for **every** workflow, not only the user-facing request.

Required sections:

| Section | Must say |
|---|---|
| **Covered workflows** | The workflow registry: one row per workflow or entry point (`WF-n`), and the workflow-classes table below. |
| **Correlation across boundaries** | The ID that links one run end to end, where it is created, and how it crosses each process, queue, job and service boundary. |
| **Storage and access** | Where each kind of record is stored, for how long, and who can read it. The constraint that chose it. No tool is assumed. |
| **Content and redaction** | What each record may hold raw, redacted or never, and where redaction happens (before storage, before export). |
| **Missing instrumentation** | How a run that emitted nothing, or emitted an incomplete record, becomes visible (a completeness check, a count that should match, a failing test), rather than silently looking like no traffic. |
| **Capture verification** | How each workflow's capture is proved: a test that drives the real entry point and asserts the records exist and forbidden values are absent. "The adapter works" is not capture verification for its consumers. |
| **Registering a new workflow** | The step every new entry point or experiment takes before it runs: add its `WF-n` row, name the evaluation and metrics it inherits, add its capture check. |

**Workflow registry** (inside *Covered workflows*):

```markdown
| Workflow | Entry point | Class | Emitting components | Correlation | Required records | Capture verification | Eval and metrics |
|---|---|---|---|---|---|---|---|
| WF-1 | `POST /quote` | user-operation | api, router, ledger | run_id from api | quote.received, route.decided, quote.returned | test_quote_capture | EV: routing suite; M-1, M-3 |
| WF-4 | `scripts/sweep_prompt.py` | development-experiment | sweep runner, extractor | experiment_id + run_id | experiment.config, extraction.call | test_sweep_capture | EV: extraction dev set; M-6 |
```

**Workflow classes** (inside *Covered workflows*). Every class gets a row. A class that is absent
says why, so a missing class is a decision rather than an oversight:

```markdown
| Class | Present | Workflows or reason |
|---|---|---|
| user-operation | yes | WF-1, WF-2 |
| background-job | yes | WF-3 |
| validation | yes | WF-5 |
| development-experiment | yes | WF-4 |
| runtime-operation | no | No deploy, migration or backfill tooling; the app runs one local process |
```

The five classes are: `user-operation` (a person or client calls it), `background-job` (scheduled,
polled or queued work), `validation` (eval runs, acceptance runs, data checks), `development-experiment`
(prompt, model or parameter trials and spikes whose results inform decisions), and
`runtime-operation` (deploys, migrations, backfills, health checks, operator scripts).

Template: `templates/observability-contract.md`.

## Key-metrics registry (DO-7)

Answers "which numbers inform which decisions, and how exactly are they computed?". One row per
metric:

```markdown
| Metric | Name | Kind | Purpose | Formula | Population / denominator | Unit | Source | Owner | Decision informed | Baseline | Target |
|---|---|---|---|---|---|---|---|---|---|---|---|
| M-1 | Quote completion | operational | Did quotes finish? | completed ÷ received | quote requests received in the window, excluding health checks | % | WF-1 records | Innocent | Whether to add a retry | none yet — Plan: first demo session | measurement-only |
| M-3 | Routing correctness | correctness | Was the route right? | cases passed ÷ cases run | routing suite, held-out split | % | eval report | Innocent | Ship / no-ship | 0.82 (run E-3) | ≥ 0.95 — approved D-14 |
```

Rules the checker enforces:

- Every cell is filled. **A metric without a population or denominator is incomplete**, even a
  count: say what is counted and over what window.
- **Kind** is exactly one of `operational`, `correctness`, `coverage`, `validation`,
  `safe-refusal`, `cost`, `outcome`. Operational success, semantic correctness, coverage, validation
  and safe refusal are never merged into one metric, because each fails differently.
- **Target** is either `measurement-only` or a value with its approval (`approved D-14`). Never a
  number nobody approved.
- **Baseline** is a value with its source, or `none yet — Plan: <the run that sets it>`.

Template: `templates/key-metrics-registry.md`.

---

## Before the ticket-ready gate: signatures, a spec dry run, the coverage sweep

**What went wrong.** On the AEA call center (2026-10-21) the design passed `--gate tickets`, was
signed, and the spec writers who then turned the slice plan into tickets raised about 170
needs-decision items. Most were not judgement calls: a function with no signature, a result typed
as "the answer", a service with no constructor, an error code the UI expected that no backend type
produced. The checker could not see them, because it checks that DO-3 and DO-4 *exist*, not that
they are complete enough to write a test against. Separately, the demo login had no `WF-n` (it
became WF-18) and metrics M-2 and M-29 belonged to no workflow, which surfaced only when tickets
were cut.

**1. Signature completeness.** Before the ticket-ready gate, check:

| Check | Passes when |
|---|---|
| Cross-area calls | Every cross-area call in DO-3's build-areas table has a DO-4 signature whose result type is spelled out field by field (no bare `dict`, `Any` or "returns the result") |
| Constructors | Every service and adapter says what it is built from and who builds it |
| Errors | Every error code the interface spec (`docs/contracts/interface.openapi.yaml`; older projects: the UI contracts' OpenAPI) names maps to a DO-4 error type |
| Storage | Every record DO-6 requires has a storage location (a table or a file) |
| Settings | Every typed settings field a consumer needs is named, with its type |

**2. Spec dry run.** One agent writes the acceptance criteria for three representative tickets
from the design alone: one service, one route and one graph node (or the project's nearest
equivalents). Whatever it cannot write testably is a design gap. Close it in DO-3 or DO-4 before
the gate; don't leave it for the spec writers.

**3. Coverage requirements sweep.** Draft the `to-tickets` mandatory-requirements table
(`to-tickets/references/coverage-audit.md`) now, against DO-6's workflow registry. It finds
design-registry gaps while they are cheap: an entry point with no `WF-n`, a requirement whose
*Applies to* names an unregistered workflow, a DO-7 metric no workflow inherits. Fix them in DO-6
and DO-7; the table carries forward to the ticket-time coverage audit.

Record the three results in the readiness report. `design_outputs.py` does not run them; they are
judgement items like those below.

---

## What the checkers prove, and what still needs a person

`design_outputs.py` checks **structure**: every output has a row, the right status for the gate,
the required sections exist and say something (non-answers such as `none`, `NA`, `TBD`, a bare
placeholder or a single word are rejected; examples inside code fences are ignored), workflow classes are all accounted for, and
every metric row is complete with an approved target or `measurement-only`.

It cannot check **meaning**. A reviewer still confirms:

- the N/A reasons are true;
- the expected-answer authority is actually authoritative for that behaviour;
- the workflow registry is complete (nobody forgot a cron job or a script);
- the formula computes what the purpose says, and the denominator is the right population;
- the redaction policy matches the issued data rules;
- the capture checks would fail if the records were missing;
- the signature-completeness check, the spec dry run and the coverage requirements sweep
  (*Before the ticket-ready gate*) left no open gap.
