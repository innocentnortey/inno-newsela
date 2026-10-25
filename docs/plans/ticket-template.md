# Ticket spec template (§7b) — Newsela Lesson Studio

Every ticket is two files in `docs/plans/tickets/`: `<ID>.json` (machine record) and `<ID>.md` (the issue body,
published verbatim to GitLab). `docs/plans/tickets.md` (the board the coverage checker reads) is **generated** from the
`.md` files by `python3 docs/plans/scripts/build_board.py`; never edit it by hand. Pinned procedure:
`.claude/workflow/to-tickets/SKILL.md` §3–§4 (v2.2.0).

## `<ID>.json`

```json
{"id": "NL-14", "title": "prompts: locked layer and renderers", "kind": "backend", "lane": "build-loop",
 "wave": 2, "depends_on": ["NL-09"], "cons": ["CON-5"], "screens": [], "stories": ["US-6"],
 "anchor": ["WP-2"], "wfs": ["WF-21", "WF-22"], "metrics": ["M-7"], "risk_security": true,
 "area": "A7", "cuttable": null, "scope": ["prompt renderers"], "phase": "plan", "gitlab_iid": null}
```

- `kind`: `backend` | `frontend` | `integration` | `foundation` (the four `ticket_readiness.py` accepts).
  Non-implementation tickets (verification, experiments, capacity, delivery, `lane::direct`, `lane::human`) use
  `integration` with `depends_on` naming what they rest on (tickets, or for wave-0 items the artifacts/gates).
- `lane`: `build-loop` | `direct` | `human` | `spike`. `wave`: integer. `cuttable`: PD-17 cut number or `null`.
- Every ticket must pass `python3 .claude/skills/zero-to-hero/scripts/ticket_readiness.py check <ID>.json --root .`.

## `<ID>.md` (exact section headings; order as below)

```markdown
## [NL-14] prompts: locked layer and renderers

_Conventions for every Newsela Lesson Studio issue:_ repo `innocentnortey/inno-newsela` (VPS working copy
`/home/linuxuser/workspaces/inno-newsela`); read `CLAUDE.md`, `.claude/README.md`, `.claude/reference/area-map.md`
and `docs/plans/HANDOFF-PHASE-B.md` first; vocabulary from `docs/design/component-contracts.md` (DO-4) and
`docs/contracts/INTERFACE.md`. Build-loop tickets go plan → implement → test → review (`.claude/rules/build-loop-test-scope.md`;
frozen tests first only for `risk::security`); only affected tests run. Never: quote or read `docs/source/restricted/`
into code, prompts, fixtures or issues (GR-9); copy a provider key (use `/home/linuxuser/workspaces/bin/with-provider-env`);
restate or contradict an agreed `CON-N` (changes go through `docs/contracts/CHANGES.md` as `CHG-N`); use real student or
staff data (synthetic, seeded, traceable). Evidence is a command and its output, attached to the issue.

### Story
US-6 — As an author I need … so that … (for platform work: the stories it enables, and one sentence on why).

### What to build
<the behaviour, the module(s) it owns (DO-3 area and paths), the signatures it implements (DO-4 §n) and what it
must not do>

### Sources
- DO-4 §n `<ServiceName>`; DO-3 §n; CON-N (agreed); SCR-N (signed); HP-N; PRD R-n / GR-n; WP-N or PE-N.
- **Brief check:** serves "<quoted brief sentence>"; touches nothing out of scope; weakens nothing → proceed.

### Acceptance criteria
- [ ] AC-1 [invariant] <one observable claim> (WF-21) — verify: <named test or command> — evidence: <expected result> — covers: R-6, GR-3
- [ ] AC-2 [failure/refusal] … — verify: … — evidence: … — covers: CON-5
- [ ] AC-3 [negative] <distinctive rejected value absent from response, log and trace> — verify: … — evidence: … — covers: GR-…
- [ ] AC-4 [capture] <required records at WF-n's real entry point> (WF-21) — verify: … — evidence: … — covers: OBS-…, M-…
- [ ] AC-5 [regression/context] area map row planned → actual; router/ICM rows; dev-log line — verify: diff — evidence: diff

Acceptance anchor: WP-2 (`docs/data/worked-pairs.md`) is one of this ticket's tests (or PE-N for presentation work).

### Observability
- Responsibilities: <records emitted or preserved, naming each WF-n from "Entry points added or changed">
- Capture evidence: AC-4
<or: N/A — <reason a reviewer could disagree with>; never N/A when an entry point is added or changed>

### Evaluation
- Checks: <suites or cases added or kept passing, from DO-5>
- Expected-answer authority: <from DO-5>
<or: N/A — <reason>>

### Metrics
- References: <every M-n the WF-n rows inherit, plus others it affects>
- Acceptance conditions: <metric stays computable from the emitted records>
<or: N/A — <reason>>

### Blocked by (depends on)
NL-09 <or: None>

### Lane
lane::build-loop — <one line why, per `.claude/rules/ticket-lanes.md`>

### Agent handoff
- Area / owner: A7 (DO-3 §4)
- Contracts and shared surfaces: <consumes / produces for whom / must not edit (collision map owner)>
- Scope boundary / refusal: <material exclusion, or None>
- Wave and gates: wave 2; <gate::human / gate::paid / none>
- Kind: backend — serves CON-5 (agreed)
- Risk: security — <what a bug could leak or open> <or: None>
- Entry points added or changed: WF-21, WF-22 <or: None>
```

## Rules the checker enforces (write to them)

- Every AC line: an `AC-n` id, `verify:` and `evidence:`; one line. End every AC with `— covers: <ids>` listing the
  requirement ids it proves from `docs/plans/coverage-audit.md` (*Mandatory requirements*: `R-n`, `GR-n`, `CON-n`,
  `CON-Gn`, `SCR-n`, `EV-Rn`, `EV-Sn`, `OBS-n`, `M-n`). A criterion that proves a requirement **inside a workflow** must
  name that `WF-n` in its text (the coverage matrix cites `<ticket> AC-n`, and that AC must name the WF).
- The ticket that **integrates** a requirement into a workflow carries the AC for it and lists the component ticket in
  *Blocked by*.
- Every WF-n in *Entry points added or changed* appears in *Observability → Responsibilities*; *Capture evidence*
  cites this ticket's capture AC; *Metrics → References* names every M-n that WF row inherits (DO-6 *Eval* column);
  *Evaluation* is not N/A when the WF row inherits evaluation.
- Last AC is `[regression/context]`.
