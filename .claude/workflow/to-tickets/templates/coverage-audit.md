# Coverage audit — <project / ticket set>

<!-- Traceability record for one ticket set: every mandatory requirement, across every workflow it
applies to, traced to the ticket that builds the component, the ticket that integrates it into that
workflow, the acceptance criterion that proves the integration, and the evidence. It holds no
ticket status (GitLab owns status). Format and rules: to-tickets/references/coverage-audit.md.
Check before publishing:
  python3 <to-tickets>/scripts/coverage_audit.py check <this file> --tickets <drafts.md> --workflows <observability contract>
At implementation verification, re-run with --stage verify after filling Evidence with "verified: …". -->

- **Ticket set:** <slug, issue range or draft file>
- **Workflow registry:** <path of the observability contract (DO-6)>
- **Design outputs register:** <path> — ticket-ready gate passed <YYYY-MM-DD>
- **Requirement sources swept:** <PRD §…, requirements doc §…, component contracts, evaluation plan, observability contract, key-metrics registry>

## Mandatory requirements

<!-- Every "must" from the governing sources, including evaluation, observability and metric
obligations. Applies to: "all", or WF-n ids; name excluded workflows after "excludes" with the
reason, or write "WF-n only — <reason>" for an operation-specific rule. A requirement that says every/all/each/never/no must cover or exclude every workflow: write "WF-n only — <reason>" or "excludes WF-n (reason)", never a plain "WF-1" (on AEA ~137 "narrowed guarantee" findings came from plain rows). Example: R-7 "No reply ever quotes a card number" (PRD §4.2) applies to "WF-1, WF-3; excludes WF-2, WF-4 (they never receive customer text)". Run this sweep at the design gate (zero-to-hero §6) too: it finds unregistered entry points and metrics no workflow inherits. -->

| Req | Requirement | Source | Applies to |
|---|---|---|---|
| | | | |

## Coverage matrix

<!-- One row per requirement × workflow. Implementing ticket builds the component; Integration
owner is the ticket that wires it into THAT workflow and is blocked by the implementing ticket when
they differ. Acceptance criterion is "<ticket> AC-n" on the integration owner. -->

| Req | Workflow | Component / contract | Implementing ticket | Integration owner | Acceptance criterion | Evidence |
|---|---|---|---|---|---|---|
| | | | | | | |

## Findings and repairs

| Finding | Repair | Ticket(s) changed |
|---|---|---|
| | | |
