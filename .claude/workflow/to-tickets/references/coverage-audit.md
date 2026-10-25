# Coverage audit

**What it catches.** A requirement such as "every run records its `run_id`" usually becomes one
ticket that builds a shared helper, with a test proving the helper works. Nobody writes the tickets
that make the quote endpoint, the nightly job and the experiment script *call* it. Every ticket
passes; the guarantee is broken. The audit makes that gap visible before publication by tracing
each mandatory requirement through **every** workflow it applies to:

```
requirement → workflow / entry point → component / contract → implementing ticket
            → integration owner → acceptance criterion → evidence
```

**Concrete example (invented).** Lantern has three workflows: `WF-1` (`POST /quote`), `WF-2` (a
nightly refresh) and `WF-4` (a weight-sweep experiment). Requirement R-1 says every run stamps its
`run_id` on each record, and applies to `all`.

| Draft | Matrix rows | Audit result |
|---|---|---|
| LAN-01 builds `TraceAdapter`, AC-1 "adapter stamps run_id" | `R-1 · — · TraceAdapter · LAN-01 · (none) · LAN-01 AC-1` | no consuming workflow; unowned integration; R-1 has no row for WF-1, WF-2, WF-4 |
| Add LAN-02/03/05, each wiring the adapter into one workflow, each blocked by LAN-01, each with a capture AC | three rows, one per workflow, ACs on LAN-02/03/05 | passes |

The fix did not serialise anything new: LAN-02, LAN-03 and LAN-05 all wait only on LAN-01, the one
dependency they really have, and run in parallel with each other.

## Files

The audit is a traceability record, not a ticket ledger: it holds no status. Keep it with the
project's plans (default `docs/plans/coverage-<slug>.md`), or wherever the project's router says.
Template: `templates/coverage-audit.md`.

Inputs to the checker:

- **The audit file**: the mandatory-requirements table and the coverage matrix.
- **The ticket drafts**: every drafted issue in one Markdown file, each starting
  `## [PREFIX-NN] <title>` followed by the issue body. This is a scratch file for the audit, not a
  mirror; GitLab stays the record once published. For a later re-audit, export the published
  issues in the same shape (title as the `##` heading, body below).
- **The workflow registry**: the observability contract (DO-6), whose *Covered workflows* table
  lists every `WF-n`.

```bash
python3 scripts/coverage_audit.py check docs/plans/coverage-<slug>.md \
  --tickets <drafts.md> --workflows <observability contract>
```

## Mandatory requirements table

| Column | Content |
|---|---|
| Req | The source's own ID where it has one (`OBS-1`, `M-22`), else `R-n`. |
| Requirement | The obligation, with the source's qualifiers kept (`every`, `never`, `each`). |
| Source | The exact section or ID. |
| Applies to | `all` (every registered workflow), or `WF-n` ids. Name excluded workflows after `excludes`, with the reason: `WF-1; excludes WF-2, WF-4 (they never receive customer data)`. For an operation-specific rule, `WF-1 only — <reason>` excludes every other workflow for that reason. |

**What counts as mandatory.** Every "must" in the governing sources: the PRD and requirements, the
component contracts (DO-4: every listed consumer), the evaluation plan's acceptance conditions
(DO-5), the observability contract's required records, redaction and capture checks (DO-6), and
the key-metrics registry's sources (DO-7: a metric's records must be emitted by the workflows it
counts). Evaluation, observability and metrics obligations are requirements like any other.

**Every/all/each/never/no requirements name their whole scope.** Write `WF-n only — <reason>` or
`excludes WF-n (reason)`; a plain `WF-1` on such a row is a narrowed guarantee. On AEA (2026-10-21)
about 137 "narrowed guarantee" findings came from rows written as plain `WF-1`.

| Req | Requirement | Source | Applies to |
|---|---|---|---|
| R-7 | No reply ever quotes a card number | PRD §4.2 | `WF-1, WF-3; excludes WF-2, WF-4 (they never receive customer text)` |
| R-8 | Every booking records its slot id | PRD §5.1 | `WF-3 only — the only workflow that books` |

**Run the requirements sweep at the design gate** (zero-to-hero §6), not only at ticket time: it is
what finds unregistered entry points (AEA: the demo login had no `WF-n`) and metrics no workflow
inherits, while the design can still absorb them.

## Coverage matrix

One row per requirement × workflow.

| Column | Content |
|---|---|
| Workflow | Exactly one `WF-n`. A shared component is never a workflow. |
| Component / contract | What delivers the guarantee (`TraceAdapter (C-2)`). |
| Implementing ticket | The ticket that builds the component. |
| Integration owner | The ticket that wires it into this workflow. May equal the implementing ticket. |
| Acceptance criterion | `<ticket> AC-n` on the **integration owner**, proving the guarantee at this workflow's real entry point. |
| Evidence | The evidence that criterion names. At implementation verification: `verified: <link or run>`. |

## What the checker flags

| Finding | Meaning |
|---|---|
| no coverage row for `WF-n` — missing consumer integration | The requirement applies to a workflow no ticket integrates. |
| needs exactly one consuming workflow | A row names a shared component instead of a consumer. |
| unowned integration | Nobody owns wiring the component into the workflow. |
| `<ticket> AC-n` proves the component, not its use | The criterion sits on the component ticket, not on the integration owner. |
| `<ticket> AC-n` does not name `WF-n` | The cited criterion never mentions the workflow it is meant to prove; it cannot be driving that entry point. |
| `<ticket> AC-n` is already the proof for `WF-m` | One criterion reused for several workflows of the same requirement; each workflow needs its own. |
| narrowed guarantee | The requirement says every/all/each/never but its scope neither covers nor excludes some workflows. |
| excludes … without a reason | An exclusion with no stated reason. |
| integrates …'s component but is not blocked by … | The one real dependency is missing; the integrator would start before the component exists. |
| entry point … has no registered WF-n / not in the registry | A new entry point or experiment would run outside the observability contract. |
| adds or changes `WF-n` but declares Observability N/A | An entry-point ticket opting out of capture. |
| Observability responsibilities do not name `WF-n` / capture evidence must cite this ticket's AC-n | An entry-point ticket whose observability section is generic, or points at no real criterion. |
| `WF-n` inherits evaluation but Evaluation is N/A | The workflow has evaluation suites in the contract; a ticket changing it keeps them in view. |
| `WF-n` inherits `M-n`; Metrics does not reference it | The ticket would change a workflow without keeping its metric computable. |
| Observability / Evaluation / Metrics missing, or N/A without a reason | Every ticket answers all three; documentation-only tickets answer `N/A — <reason>`. Non-answers (`none`, `NA`, `TBD`, a left-over `<placeholder>`) count as missing. |
| requirement has text but no Req id / duplicate Req id | A requirement whose coverage could not otherwise be checked. |
| acceptance criterion without an AC-n id, or without verify/evidence | The criterion cannot be traced or proved. |
| evidence not verified (`--stage verify`) | Implementation verification is not finished. |

Every ticket in the file is checked; the summary line prints the count so a partial file is
obvious. Tables and examples inside code fences are ignored. `check-plan` exits non-zero while a
plan still has a `needs-decision` or `blocked-on` obligation, so nothing gating on the exit code
starts building it.

## Parallelism

The audit adds only **real** dependencies: an integration owner waits for the component it wires
in. It never asks consumers to wait for each other. Prefer one integration ticket per workflow
(or per owning area) over one ticket that integrates every workflow; the former keeps the
consumers parallel and gives each workflow its own capture criterion. When the integration is a
one-line call in a ticket that already changes that workflow, make that ticket the integration
owner instead of adding a new one.

## What still needs a person

The checker proves the trace is **structurally** complete. A reviewer still confirms:

- the mandatory-requirements table holds every obligation in the sources (the checker cannot read
  a PRD);
- the workflow registry has every workflow (a forgotten cron job is invisible to it);
- each acceptance criterion actually proves its claim at the real entry point;
- each exclusion and N/A reason is true;
- no criterion quietly narrows the source's wording ("the quote path logs run_id" for "every run").
