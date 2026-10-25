## [FW-1] FW: frontend scaffold, design tokens and typography

_Conventions for every Newsela Lesson Studio issue:_ repo `innocentnortey/inno-newsela` (VPS working copy
`/home/linuxuser/workspaces/inno-newsela`); read `CLAUDE.md`, `.claude/README.md`, `.claude/reference/area-map.md`
and `docs/plans/HANDOFF-PHASE-B.md` first; vocabulary from `docs/design/component-contracts.md` (DO-4) and
`docs/contracts/INTERFACE.md`. Build-loop tickets go plan → implement → test → review (`.claude/rules/build-loop-test-scope.md`;
frozen tests first only for `risk::security`); only affected tests run. Never: quote or read `docs/source/restricted/`
into code, prompts, fixtures or issues (GR-9); copy a provider key (use `/home/linuxuser/workspaces/bin/with-provider-env`);
restate or contradict an agreed `CON-N` (changes go through `docs/contracts/CHANGES.md` as `CHG-N`); use real student or
staff data (synthetic, seeded, traceable). Evidence is a command and its output, attached to the issue.

### Story
Persona P-1 (reviewer) — I need every screen to share one calm, legible look so that long reading stays easy (feel brief; `design.md` §1). Platform work: every frontend ticket (NL-24, NL-55…NL-76) is assembled on these tokens.

### What to build
- Create the Next.js (App Router) + React + TypeScript app in `apps/web/` as a standalone npm package (Node 24, npm 11), Tailwind CSS v4, Vitest + Testing Library. Pin each package to its latest release at least 14 days old on 2026-10-25 (`npm view <pkg> time`), per the FW record *Stack → Versions*. Install the Radix primitives FW-2 needs now (dialog, tabs) and `@fontsource-variable/inter`, so FW-2/FW-3 never edit `package.json`.
- `apps/web/scripts/build-tokens.mjs` reads the fenced `tokens` JSON block in `docs/design/design.md` and writes `apps/web/src/styles/tokens.css`: light values on `:root`, dark under `[data-theme="dark"]` and under `@media (prefers-color-scheme: dark)` when no `data-theme` is set. Tailwind v4 `@theme` maps the variables.
- `apps/web/app/globals.css`: type scale, families (Inter self-hosted, system fallbacks per `design.md` → *Type*, system mono), tabular numerals, the focus ring, `prefers-reduced-motion` turning transitions off. `app/layout.tsx` (`<html lang="en">`), placeholder `app/page.tsx` saying "Lesson Studio — foundation" (no data). `src/lib/cn.ts` class helper.
- Scripts: `lint`, `typecheck`, `test`, `build`, `tokens` (regenerate). **Owned files:** exactly FW-1's row of the FW record's *Owned files* table. Must not: add pages, fetch anything, or define components (FW-2/FW-3). Later, NL-06 takes over `apps/web/package.json`/`tsconfig.json` and deletes this `apps/web/package-lock.json` in favour of the root lockfile.

### Sources
- `docs/plans/foundation-wave.md` (FW record: *Stack*, *Owned files*, *Bounded scope*, *Ticket specs*, *Review requirements*, PE table) — authoritative for stack, owned files and review
- `docs/design/design.md` → *Design tokens* (incl. *Machine-readable tokens*), §2 status vocabulary, §3 components, §4 layout, §5 motion; D1 look sheet `docs/ux/02-concepts/references/2026-10-25-d1-clear-ledger-look-sheet.html`
- DO-3 §1 (`apps/web/` adopted as FW created it) and §2.3 last row (FW components and gallery, owned by FW-1…FW-4); slice plan *Collision map* W0–W2 and *Open items* 1 (FW record refinement)
- Workspace UI rules: `modern-ui-principles` skill index (UI-4 owned components on tokens; WCAG 2.2)
- PE-1, PE-2, PE-3 (FW record *Presentation examples*)
- **Brief check:** serves "Thoughtful design and easy to understand/use/navigate workflow"; touches nothing out of scope; weakens nothing → proceed.

### Acceptance criteria
- [ ] AC-1 [invariant] `tokens.css` is generated from `design.md`'s tokens block; editing one value in the block without regenerating fails the test — verify: `cd apps/web && npm test -- tests/unit/tokens/tokens.test.ts` — evidence: pass; a deliberate mismatch run shows the named failure — covers: PE-1
- [ ] AC-2 [invariant] every pair in `design.md` → *Contrast pairs*, recomputed from the generated CSS, meets its threshold in light and dark (body `ink` on `ground`/`panel`/`well` ≥ 4.5:1; `ink2` ≥ 4.5:1 on each surface it sits on) — verify: same test file, contrast cases — evidence: one passing case per pair per theme — covers: PE-2
- [ ] AC-3 [invariant] with no `data-theme` the page follows the system theme; `data-theme="dark"` forces dark; reduced motion sets transition durations to 0 — verify: `npm test -- tests/unit/tokens/theme.test.ts` — evidence: pass (the FW-4 gallery screenshot re-checks it) — covers: PE-3
- [ ] AC-4 [negative] no colour literal outside the generated file: `grep -rnE '#[0-9a-fA-F]{3,8}\b' apps/web/app apps/web/src --include=*.css --include=*.tsx | grep -v src/styles/tokens.css` prints nothing — verify: that command — evidence: empty output — covers: PE-1
- [ ] AC-5 [invariant] the app builds and its fast gates pass — verify: `cd apps/web && npm run lint && npm run typecheck && npm test && npm run build` — evidence: all four exit 0 — covers: PE-1
- [ ] AC-6 [regression/context] area map row(s) for this ticket's paths planned → actual; FW record *Review requirements* first box ticked for FW-1 after `code-review-agent`; ICM row if a route's evidence changed; dev-log entry (Changed · Why · Checked · Remaining) — verify: `git diff --stat` and `python3 ~/.claude/skills/icm-project/scripts/check_context.py .` — evidence: diff touches only those rows; no FAIL

Acceptance anchor: PE-1, PE-2, PE-3 (`docs/plans/foundation-wave.md`) are this ticket's tests.

### Observability
N/A — presentation-only foundation work: no route, job or script entry point exists or changes, so there is no record to emit

### Evaluation
N/A — no DO-5 suite covers presentation components; acceptance is by presentation examples (PE-N) in `docs/plans/foundation-wave.md`

### Metrics
N/A — no metric's source records are written or read by tokens, components or layout primitives

### Blocked by (depends on)
None

### Lane
lane::build-loop — creates code and tests the app builds from (`ticket-lanes`: code-read files).

### Agent handoff
- Area / owner: FW (FW record; DO-3 §2.3 last row)
- Contracts and shared surfaces: produces the tokens, globals and scaffold that FW-2, FW-3, FW-4 and every A14 screen read; owns only FW-1's *Owned files* row (W0 collision map: `apps/web/**` listed files); NL-01 owns the root `package.json`/lockfile, so this ticket never touches the repo root
- Scope boundary / refusal: presentation only: no data, no routes beyond the placeholder page, no CON-reading code; anything behaviour-dependent waits for the normal feature path
- Wave and gates: wave 0; none (presentation only; does not need §6 — `ticket_readiness.py` foundation rule)
- Kind: foundation — no CON, no SCR (presentation only)
- Risk: None — presentation only (FW record: none of FW-1…FW-4 is `risk::security`)
- Entry points added or changed: None
