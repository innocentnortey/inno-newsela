## [FW-4] FW: component gallery with axe and visual checks

_Conventions for every Newsela Lesson Studio issue:_ repo `innocentnortey/inno-newsela` (VPS working copy
`/home/linuxuser/workspaces/inno-newsela`); read `CLAUDE.md`, `.claude/README.md`, `.claude/reference/area-map.md`
and `docs/plans/HANDOFF-PHASE-B.md` first; vocabulary from `docs/design/component-contracts.md` (DO-4) and
`docs/contracts/INTERFACE.md`. Build-loop tickets go plan → implement → test → review (`.claude/rules/build-loop-test-scope.md`;
frozen tests first only for `risk::security`); only affected tests run. Never: quote or read `docs/source/restricted/`
into code, prompts, fixtures or issues (GR-9); copy a provider key (use `/home/linuxuser/workspaces/bin/with-provider-env`);
restate or contradict an agreed `CON-N` (changes go through `docs/contracts/CHANGES.md` as `CHG-N`); use real student or
staff data (synthetic, seeded, traceable). Evidence is a command and its output, attached to the issue.

### Story
The reviewer of this wave — I need every component and state on one page in both themes, so that the look can be checked against the look sheet before features use it.

### What to build
- `apps/web/app/(dev)/gallery/page.tsx` (served only when `NODE_ENV !== "production"`; a production build returns 404 for `/gallery`) renders every FW-2 component in every state and every FW-3 primitive, light and dark (a theme switch writes `data-theme`), using copy from `docs/ux/02-concepts/LOOK_SHEET_COPY.md` where text is shown.
- `apps/web/playwright.config.ts` and `apps/web/e2e/gallery/gallery.spec.ts`: axe (`@axe-core/playwright`) at 1280 × 900 and 390 × 844 in both themes; screenshots saved to `apps/web/e2e/__screenshots__/gallery/`. Run every Playwright command under a hard cap (`perl -e 'alarm 500; exec @ARGV' npx playwright test`).
- **Refinement (slice plan *Open items* 1):** FW-4 owns `app/(dev)/**`, `playwright.config.ts` and `e2e/gallery/**` only; after FW-4 each screen ticket owns `e2e/<screen>/**`. The FW record's `e2e/**` row narrows accordingly; the orchestrator records it as a DO-3 addendum.

### Sources
- `docs/plans/foundation-wave.md` (FW record: *Stack*, *Owned files*, *Bounded scope*, *Ticket specs*, *Review requirements*, PE table) — authoritative for stack, owned files and review
- `docs/design/design.md` → *Design tokens* (incl. *Machine-readable tokens*), §2 status vocabulary, §3 components, §4 layout, §5 motion; D1 look sheet `docs/artifacts/2026-10-25-d1-clear-ledger-look-sheet.html`
- DO-3 §1 (`apps/web/` adopted as FW created it) and §2.3 last row (FW components and gallery, owned by FW-1…FW-4); slice plan *Collision map* W0–W2 and *Open items* 1 (FW record refinement)
- Workspace UI rules: `modern-ui-principles` skill index (UI-4 owned components on tokens; WCAG 2.2)
- PE-10, PE-11 (FW record); ux-pipeline `references/phases.md` UX-5a pitfalls (axe `aria-prohibited-attr`, `scrollable-region-focusable`)
- **Brief check:** serves "Thoughtful design and easy to understand/use/navigate workflow"; touches nothing out of scope; weakens nothing → proceed.

### Acceptance criteria
- [ ] AC-1 [invariant] the gallery has 0 serious and 0 critical axe violations at 1280 and 390, light and dark — verify: `cd apps/web && perl -e 'alarm 500; exec @ARGV' npx playwright test e2e/gallery` — evidence: four axe summaries, 0 serious / 0 critical — covers: PE-10
- [ ] AC-2 [invariant] at 390 px the gallery page has no horizontal scroll (`scrollWidth <= innerWidth`) and the side rail stacks under the content — verify: same spec, 390 cases — evidence: pass — covers: PE-9
- [ ] AC-3 [invariant] with no `data-theme`, emulated `prefers-color-scheme: dark` renders dark tokens; reduced motion shows no transition — verify: same spec, theme cases — evidence: pass + dark screenshot — covers: PE-3
- [ ] AC-4 [visual] screenshots at 1280 light and dark show the Clear Ledger palette, radius and type (cool grey desk, white sheet, ink-blue primary, 8 px radius) side by side with the D1 look sheet — verify: orchestrator review of `e2e/__screenshots__/gallery/*.png` against `docs/artifacts/2026-10-25-d1-clear-ledger-look-sheet.html` — evidence: PASS (or listed deltas) recorded in the dev log — covers: PE-11
- [ ] AC-5 [negative] the gallery is not served in production: `npm run build && npm start` then `curl -s -o /dev/null -w '%{http_code}' localhost:3000/gallery` — verify: that command — evidence: `404` — covers: PE-10
- [ ] AC-6 [regression/context] area map row(s) for this ticket's paths planned → actual; FW record *Review requirements* accessibility and visual boxes ticked with the evidence; ICM row if a route's evidence changed; dev-log entry (Changed · Why · Checked · Remaining) — verify: `git diff --stat` and `python3 ~/.claude/skills/icm-project/scripts/check_context.py .` — evidence: diff touches only those rows; no FAIL

Acceptance anchor: PE-10, PE-11 (`docs/plans/foundation-wave.md`) are this ticket's tests.

### Observability
N/A — presentation-only foundation work: no route, job or script entry point exists or changes, so there is no record to emit

### Evaluation
N/A — no DO-5 suite covers presentation components; acceptance is by presentation examples (PE-N) in `docs/plans/foundation-wave.md`

### Metrics
N/A — no metric's source records are written or read by tokens, components or layout primitives

### Blocked by (depends on)
FW-2, FW-3

### Lane
lane::build-loop — adds a dev page, Playwright config and tests (`ticket-lanes`: code-read files).

### Agent handoff
- Area / owner: FW (FW record; DO-3 §2.3 last row)
- Contracts and shared surfaces: owns `apps/web/app/(dev)/**`, `apps/web/playwright.config.ts`, `apps/web/e2e/gallery/**` (W2 collision map); reads FW-1…FW-3; NL-24 and every screen ticket reuse `playwright.config.ts` and add their own `e2e/<screen>/**` folder without editing the gallery
- Scope boundary / refusal: presentation only: the gallery renders static props; no data, no CON
- Wave and gates: wave 2; none (the visual check is the orchestrator's review, not a human gate)
- Kind: foundation — no CON, no SCR (presentation only)
- Risk: None — presentation only (FW record: none of FW-1…FW-4 is `risk::security`)
- Entry points added or changed: None
