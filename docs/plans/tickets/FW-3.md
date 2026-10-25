## [FW-3] FW: layout primitives

_Conventions for every Newsela Lesson Studio issue:_ repo `innocentnortey/inno-newsela` (VPS working copy
`/home/linuxuser/workspaces/inno-newsela`); read `CLAUDE.md`, `.claude/README.md`, `.claude/reference/area-map.md`
and `docs/plans/HANDOFF-PHASE-B.md` first; vocabulary from `docs/design/component-contracts.md` (DO-4) and
`docs/contracts/INTERFACE.md`. Build-loop tickets go plan → implement → test → review (`.claude/rules/build-loop-test-scope.md`;
frozen tests first only for `risk::security`); only affected tests run. Never: quote or read `docs/source/restricted/`
into code, prompts, fixtures or issues (GR-9); copy a provider key (use `/home/linuxuser/workspaces/bin/with-provider-env`);
restate or contradict an agreed `CON-N` (changes go through `docs/contracts/CHANGES.md` as `CHG-N`); use real student or
staff data (synthetic, seeded, traceable). Evidence is a command and its output, attached to the issue.

### Story
Persona P-1 (reviewer) — I need the lesson to sit on a page sheet with the evidence beside it, so that I read and check in one place (Clear Ledger construction; `design.md` §4). Platform work: every screen ticket lays out on these.

### What to build
- In `apps/web/src/components/layout/`: AppShell (skip link to `main`, left nav with sections and counts passed as props, `nav`/`main` landmarks, collapses below the `design.md` breakpoint), PageHeader with Breadcrumb (`aria-current="page"` on the last crumb) and an actions slot, TwoPane with SideRail (`rail` 360 px and `rail-narrow` 288 px; stacks under the content on narrow widths), PageSheet (reading measure 68ch).
- Props only; no data, no session, no routing logic. Tests in `apps/web/tests/unit/layout/*.test.tsx`. Read FW-1's files only.

### Sources
- `docs/plans/foundation-wave.md` (FW record: *Stack*, *Owned files*, *Bounded scope*, *Ticket specs*, *Review requirements*, PE table) — authoritative for stack, owned files and review
- `docs/design/design.md` → *Design tokens* (incl. *Machine-readable tokens*), §2 status vocabulary, §3 components, §4 layout, §5 motion; D1 look sheet `docs/artifacts/2026-10-25-d1-clear-ledger-look-sheet.html`
- DO-3 §1 (`apps/web/` adopted as FW created it) and §2.3 last row (FW components and gallery, owned by FW-1…FW-4); slice plan *Collision map* W0–W2 and *Open items* 1 (FW record refinement)
- Workspace UI rules: `modern-ui-principles` skill index (UI-4 owned components on tokens; WCAG 2.2)
- PE-9 (FW record)
- **Brief check:** serves "Thoughtful design and easy to understand/use/navigate workflow"; touches nothing out of scope; weakens nothing → proceed.

### Acceptance criteria
- [ ] AC-1 [invariant] AppShell renders a working skip link whose target is `main`, plus `nav` and `main` landmarks — verify: `cd apps/web && npm test -- tests/unit/layout/app-shell.test.tsx` — evidence: pass — covers: PE-9
- [ ] AC-2 [invariant] Breadcrumb marks the last crumb `aria-current="page"`; PageHeader renders its actions slot — verify: `npm test -- tests/unit/layout/page-header.test.tsx` — evidence: pass — covers: PE-9
- [ ] AC-3 [invariant] TwoPane places SideRail beside the content at ≥ the breakpoint and stacks it below the content under it (DOM order content → rail) — verify: `npm test -- tests/unit/layout/two-pane.test.tsx` — evidence: pass (FW-4's 390 px gallery run checks no sideways scroll) — covers: PE-9
- [ ] AC-4 [invariant] fast gates pass — verify: `cd apps/web && npm run lint && npm run typecheck && npm test -- tests/unit/layout` — evidence: exit 0 — covers: PE-9
- [ ] AC-5 [regression/context] area map row(s) for this ticket's paths planned → actual; ICM row if a route's evidence changed; dev-log entry (Changed · Why · Checked · Remaining) — verify: `git diff --stat` and `python3 ~/.claude/skills/icm-project/scripts/check_context.py .` — evidence: diff touches only those rows; no FAIL

Acceptance anchor: PE-9 (`docs/plans/foundation-wave.md`) is this ticket's test.

### Observability
N/A — presentation-only foundation work: no route, job or script entry point exists or changes, so there is no record to emit

### Evaluation
N/A — no DO-5 suite covers presentation components; acceptance is by presentation examples (PE-N) in `docs/plans/foundation-wave.md`

### Metrics
N/A — no metric's source records are written or read by tokens, components or layout primitives

### Blocked by (depends on)
FW-1

### Lane
lane::build-loop — adds layout components and tests that the app imports (`ticket-lanes`: code-read files).

### Agent handoff
- Area / owner: FW (FW record; DO-3 §2.3 last row)
- Contracts and shared surfaces: owns `apps/web/src/components/layout/**`, `apps/web/tests/unit/layout/**`; reads FW-1's files only; never edits `apps/web/package.json`/`tsconfig.json` (NL-06's from W1); consumed by FW-4 and NL-24's app frame (`app/(app)/layout.tsx`)
- Scope boundary / refusal: presentation only: no session, nav data or routing behaviour (NL-24 wires the frame)
- Wave and gates: wave 1 (parallel with FW-2); none
- Kind: foundation — no CON, no SCR (presentation only)
- Risk: None — presentation only (FW record: none of FW-1…FW-4 is `risk::security`)
- Entry points added or changed: None
