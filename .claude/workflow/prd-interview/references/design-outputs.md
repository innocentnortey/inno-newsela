# Design outputs: what the interview settles, what the design fills

Every design must produce seven outputs: system design, architecture, code design, component
contracts, an evaluation plan, an observability contract and a key-metrics registry. The contract
for them, their minimum contents and the four gates is
`system-design-readiness/DESIGN-OUTPUTS.md`. This file says what the **interview's** share is.

## The line

The interview settles **purposes, promises, policies and decisions**. It does not write the
outputs. For each one it records an owner, a location and the answers that feed it, in the
document's *Design outputs* register. The design stages then fill the details.

| Output | The interview settles (questions, with checklist items) | The design fills later |
|---|---|---|
| DO-1 System design | The hardest uncertainty and depth (SD-1.9); promises (S2); workload (S3) | The eight steps, sizing, decision sentences |
| DO-2 Architecture | Data authority (SD-4.1); model decision points (SD-4.3); legacy seam (SD-4.6) | Components and responsibilities |
| DO-3 Code design | Nothing beyond its owner and location | Modules, types, signatures |
| DO-4 Component contracts | External dependencies (SD-4.2); partial-failure policy (SD-4.5) | Exact shapes and every consumer |
| DO-5 Evaluation plan | Who decides a correct answer and where cases come from (SD-8.8); held-out policy (SD-8.9); ground truth (SD-8.1); quality metrics' purpose (SD-2.7) | Case files, scoring, failure categories, baselines, acceptance conditions, run commands |
| DO-6 Observability contract | Telemetry policy (SD-1.10); every workflow to cover, experiments and scripts included (SD-3.7); operational success (SD-2.8); run stages (SD-4.7); trace contents (SD-8.7) | Record fields, correlation mechanics, emitting components, capture tests, the registration step |
| DO-7 Key-metrics registry | Which decisions metrics inform, their populations, approved targets or measurement-only (SD-2.9) | Exact formulas, sources, baselines |

Two consequences:

- **A design-level answer is deferred, not settled.** "Use a `run_id` column on every table" is a
  `design` question: record it, mark it `deferred` to the owning output, move on.
- **A settled policy is not a finished output.** Answering SD-8.8 does not create an evaluation
  plan. The register row for DO-5 still needs an owner, a location and sources, and the plan
  itself is written in design.

## The register at setup

At setup, add the seven rows to *Design outputs* under the Artifact map. Fill what the sweep
establishes (an existing `KEY_METRICS.md`, an `ARCHITECTURE.md`). Mark the rest
`unknown — ask` and put one question in the first batch: "Where should each of these live, and
who approves it?", with a recommended layout (one design document with named sections for a
small project, separate files for a large one).

A row may be `n/a` only with a reason a reviewer could disagree with. Prefer a light output:
a deterministic app's evaluation plan can be three lines.

## At completion

`interview.py check <doc> --complete` fails while any row is missing, or lacks an owner, a known
location or sources. Answered questions never stand in for a missing row: an interview with
every question closed and no evaluation-plan row is not complete.
