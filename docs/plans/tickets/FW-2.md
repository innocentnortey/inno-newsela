## [FW-2] FW: basic accessible components

_Conventions for every Newsela Lesson Studio issue:_ repo `innocentnortey/inno-newsela` (VPS working copy
`/home/linuxuser/workspaces/inno-newsela`); read `CLAUDE.md`, `.claude/README.md`, `.claude/reference/area-map.md`
and `docs/plans/HANDOFF-PHASE-B.md` first; vocabulary from `docs/design/component-contracts.md` (DO-4) and
`docs/contracts/INTERFACE.md`. Build-loop tickets go plan → implement → test → review (`.claude/rules/build-loop-test-scope.md`;
frozen tests first only for `risk::security`); only affected tests run. Never: quote or read `docs/source/restricted/`
into code, prompts, fixtures or issues (GR-9); copy a provider key (use `/home/linuxuser/workspaces/bin/with-provider-env`);
restate or contradict an agreed `CON-N` (changes go through `docs/contracts/CHANGES.md` as `CHG-N`); use real student or
staff data (synthetic, seeded, traceable). Evidence is a command and its output, attached to the issue.

### Story
Persona P-1 (reviewer) — I need statuses, issues and actions to read the same everywhere, in text and shape, so that nothing depends on colour alone (GR-4 spirit; `design.md` §2). Platform work: every screen ticket composes these.

### What to build
- In `apps/web/src/components/ui/`, one owned component per file on FW-1's tokens (anatomy and states exactly as `design.md` §3): Button (primary, secondary, ghost, danger; sizes 36/44; loading keeps width with a spinner after `delay-indicator` 250 ms; disabled is `aria-disabled` with an optional visible reason), Link, TextInput and Textarea (label, help, error wired by `aria-describedby`), Select, Checkbox, Radio and RadioCard, StatusPill and Badge (every row of `design.md` §2: glyph + label + colour pair), Banner (blocking, advisory, info, success; icon tile + level word), Card and MetricTile, Table (header cells with `scope`, numeric columns tabular), Tabs (Radix), Stepper (Draft → In review → Submitted → Approved → Exported, `aria-current="step"`), DialogShell (Radix; title, description, footer actions slot), Toast (with an Undo action slot for UXQ-8).
- Props only: a StatusPill *shows* the state name it is given; it never decides a state. No data, no network, no editor.
- One `*.test.tsx` per component in `apps/web/tests/unit/ui/` (roles, names, states, keyboard). Read FW-1's files only; never edit `package.json` (Radix was installed by FW-1).

### Sources
- `docs/plans/foundation-wave.md` (FW record: *Stack*, *Owned files*, *Bounded scope*, *Ticket specs*, *Review requirements*, PE table) — authoritative for stack, owned files and review
- `docs/design/design.md` → *Design tokens* (incl. *Machine-readable tokens*), §2 status vocabulary, §3 components, §4 layout, §5 motion; D1 look sheet `docs/artifacts/2026-10-25-d1-clear-ledger-look-sheet.html`
- DO-3 §1 (`apps/web/` adopted as FW created it) and §2.3 last row (FW components and gallery, owned by FW-1…FW-4); slice plan *Collision map* W0–W2 and *Open items* 1 (FW record refinement)
- Workspace UI rules: `modern-ui-principles` skill index (UI-4 owned components on tokens; WCAG 2.2)
- PE-4…PE-8 (FW record)
- **Brief check:** serves "Thoughtful design and easy to understand/use/navigate workflow"; touches nothing out of scope; weakens nothing → proceed.

### Acceptance criteria
- [ ] AC-1 [invariant] primary button text ≥ 4.5:1 on `primary` in both themes; focus ring ≥ 3:1 against `panel`; a disabled button is `aria-disabled` and renders its reason as text when given — verify: `cd apps/web && npm test -- tests/unit/ui/button.test.tsx` — evidence: pass — covers: PE-4
- [ ] AC-2 [invariant] a StatusPill for each state in `design.md` §2 renders its glyph shape and its text label (accessible name = label) — verify: `npm test -- tests/unit/ui/status-pill.test.tsx` (one case per state) — evidence: pass, case count = §2 row count — covers: PE-5
- [ ] AC-3 [negative] no status is colour-only: removing the glyph or label from any pill fails the test — verify: same file, negative cases — evidence: pass — covers: PE-5
- [ ] AC-4 [invariant] blocking Banner uses `role="alert"`, advisory/info/success use `role="status"`; each shows an icon and a level word — verify: `npm test -- tests/unit/ui/banner.test.tsx` — evidence: pass — covers: PE-6
- [ ] AC-5 [invariant] Tabs move with arrow keys; Stepper marks the current step `aria-current="step"` and reads "Step 2 of 5, In review" — verify: `npm test -- tests/unit/ui/tabs.test.tsx tests/unit/ui/stepper.test.tsx` — evidence: pass — covers: PE-7
- [ ] AC-6 [invariant] DialogShell traps focus, closes on Escape, returns focus to its trigger and is labelled by its title — verify: `npm test -- tests/unit/ui/dialog-shell.test.tsx` — evidence: pass — covers: PE-8
- [ ] AC-7 [invariant] fast gates pass — verify: `cd apps/web && npm run lint && npm run typecheck && npm test -- tests/unit/ui` — evidence: exit 0 — covers: PE-4
- [ ] AC-8 [regression/context] area map row(s) for this ticket's paths planned → actual; ICM row if a route's evidence changed; dev-log entry (Changed · Why · Checked · Remaining) — verify: `git diff --stat` and `python3 ~/.claude/skills/icm-project/scripts/check_context.py .` — evidence: diff touches only those rows; no FAIL

Acceptance anchor: PE-4…PE-8 (`docs/plans/foundation-wave.md`) are this ticket's tests.

### Observability
N/A — presentation-only foundation work: no route, job or script entry point exists or changes, so there is no record to emit

### Evaluation
N/A — no DO-5 suite covers presentation components; acceptance is by presentation examples (PE-N) in `docs/plans/foundation-wave.md`

### Metrics
N/A — no metric's source records are written or read by tokens, components or layout primitives

### Blocked by (depends on)
FW-1

### Lane
lane::build-loop — adds components and tests that the app imports (`ticket-lanes`: code-read files).

### Agent handoff
- Area / owner: FW (FW record; DO-3 §2.3 last row)
- Contracts and shared surfaces: owns `apps/web/src/components/ui/**`, `apps/web/tests/unit/ui/**`; reads FW-1's files only; NL-06 owns `apps/web/package.json`/`tsconfig.json` from W1 (never edit them); consumed by FW-4's gallery and every A14 screen ticket (NL-24, NL-55…NL-76)
- Scope boundary / refusal: presentation only: components take props; no data, no CON-reading code, no editor; a pill shows a state, deciding it is feature work
- Wave and gates: wave 1 (parallel with FW-3); none
- Kind: foundation — no CON, no SCR (presentation only)
- Risk: None — presentation only (FW record: none of FW-1…FW-4 is `risk::security`)
- Entry points added or changed: None
