# FW · Early frontend foundation wave — readiness record

> `docs/plans/foundation-wave.md` · Date: 2026-10-25 · Status: **ready**
> Allowed after the UX-2 pick and the `design.md` tokens, while §5–§6 continue (zero-to-hero 2.0.0; Innocent approved the
> path 2026-10-25: "Add a narrowly scoped early frontend foundation wave … I approve introducing this path").
> **Presentation only.** Anything behaviour-dependent goes through the normal feature path after the §6 gate.

**What it builds, concretely.** Before any feature screen exists, the Clear Ledger look becomes code: the design tokens as
CSS variables in light and dark, the type scale, about a dozen accessible components (button, status pill, banner,
table, tabs, stepper, dialog shell…) and the layout frame (left-nav app shell, page header, two panes with a right
rail, the page sheet), all shown on one gallery page that is tested for accessibility and compared with the look sheet.
When the first feature wave starts after §6, its screens are assembled from these parts against contract mocks.

## Preconditions
- [x] UX-2 direction picked: **D1 Clear Ledger**, Innocent ✓ 2026-10-25 ([`DESIGN-DIRECTIONS.md`](../design/DESIGN-DIRECTIONS.md) → *Shortlist and pick*)
- [x] Design tokens written: [`docs/design/design.md`](../design/design.md) → *Design tokens* (incl. *Machine-readable tokens*), status vocabulary §2, components §3, layout §4
- [x] This record complete (every section below filled)
- [ ] Not needed: the §6 gate (presentation only; `ticket_readiness.py` checks this rule)

## Stack
- **Frontend stack:** Next.js (App Router) + React + TypeScript, Tailwind CSS v4 with the design tokens as CSS custom
  properties, owned shadcn-style components on Radix primitives where behaviour is non-trivial (dialog, tabs), Vitest +
  Testing Library for component tests, Playwright + `@axe-core/playwright` for the gallery.
- **Decision source:** PRD §9 ("a Next.js web app", all TypeScript, PD-11); ux-pipeline `references/tooling.md` (owned
  shadcn/ui components, React, TypeScript); workspace rules `ui-tokens-and-components` (UI-4: owned components on tokens).
  The Tailwind + Radix choice was made under Innocent's 2026-10-25 delegation ("take your recommendations to all decisions
  you need me for").
- **Versions:** each package pinned to its latest release that is **at least 14 days old** on 2026-10-25 (published on or
  before 2026-10-11; checked with `npm view <pkg> time`), recorded in `apps/web/package.json` and the lockfile.
- **Package manager:** npm (installed: Node 24.14, npm 11.9; no pnpm on this Mac).
- **Fonts:** Inter (DQ-1, decided) self-hosted from the OFL `@fontsource-variable/inter` package, so pages work offline;
  system fallbacks as in `design.md` → *Type*; mono stays the system stack.
- **Frontend folder:** `apps/web/` (a standalone npm package for now). §6 DO-3 adopts this location or moves it in one
  change; nothing outside `apps/web/` depends on it yet.
- **Component gallery:** `apps/web/app/(dev)/gallery/page.tsx`, served only when `NODE_ENV !== "production"`.

## Owned files (only this wave touches them)
| Ticket | Owns |
|---|---|
| FW-1 | `apps/web/{package.json,package-lock.json,next.config.ts,tsconfig.json,postcss.config.mjs,eslint.config.mjs,vitest.config.ts,.gitignore,README.md}`, `apps/web/app/{layout.tsx,page.tsx,globals.css}`, `apps/web/src/styles/**`, `apps/web/scripts/build-tokens.mjs`, `apps/web/src/lib/cn.ts`, `apps/web/tests/unit/tokens/**` |
| FW-2 | `apps/web/src/components/ui/**`, `apps/web/tests/unit/ui/**` |
| FW-3 | `apps/web/src/components/layout/**`, `apps/web/tests/unit/layout/**` |
| FW-4 | `apps/web/app/(dev)/**`, `apps/web/e2e/gallery/**`, `apps/web/playwright.config.ts` |

No ticket edits another's files. FW-2 and FW-3 may only *read* FW-1's files.

## Bounded scope
**Eligible (in this wave):**
- [x] design tokens (CSS variables, light and dark, generated from `design.md`'s machine-readable block)
- [x] typography (the type scale, families, numerals)
- [x] basic accessible components: button, link, text input and textarea, select, checkbox and radio, status pill and
      badge (every state in `design.md` §2), banner, card and metric tile, table, tabs, stepper, dialog shell, toast
- [x] layout primitives: app shell with left nav, page header with breadcrumb, two-pane with right rail, page sheet

**Not eligible (normal feature path, after §6):** permissions, autosave, resumability, run or job state *logic*, data
fetching, backend error recovery, real-time collaboration, the ProseMirror editor, anything that reads a `CON-N`. A status
pill may *show* a state name; deciding a state is feature work.

## Dependencies
| Needs | From | Status |
|---|---|---|
| Direction picked | `DESIGN-DIRECTIONS.md` | done (D1, 2026-10-25) |
| Tokens and component anatomy | `design.md` | done (proposed values; DQ-1…DQ-4 decided 2026-10-25) |
| FW-1 scaffold + tokens | FW-1 | before FW-2 and FW-3 |
| FW-2 components, FW-3 layout | FW-2, FW-3 | before FW-4 |

Waves: **FW-1** → **FW-2 ∥ FW-3** → **FW-4**. Lane: all `lane::build-loop`; none is `risk::security`.

## Ticket specs

### FW-1 · Frontend scaffold, design tokens and typography
- **Kind:** foundation · **Lane:** `lane::build-loop` · **Owned files:** see the table above
- **Story:** As a reviewer (P-1) I need every screen to share one calm, legible look so that long reading stays easy (feel brief; `design.md` §1).
- **Scope:** create the Next.js app in `apps/web/`; `scripts/build-tokens.mjs` reads the fenced `tokens` JSON block in
  `docs/design/design.md` and writes `src/styles/tokens.css` (CSS variables for light on `:root`, dark under
  `[data-theme="dark"]` and `prefers-color-scheme: dark` when no `data-theme` is set); Tailwind v4 `@theme` maps them;
  `globals.css` sets the type scale, families (Inter via `@fontsource-variable/inter`), tabular numerals, focus ring,
  reduced motion; a placeholder `app/page.tsx` that says "Lesson Studio — foundation" (no data).
- **Acceptance:** PE-1, PE-2, PE-3.
- **Tests named:** `tests/unit/tokens/tokens.test.ts` (generated CSS matches the `design.md` block; every text pair in
  `design.md` → *Contrast pairs* recomputed from the CSS meets its threshold in both themes).
- **Checks:** `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

### FW-2 · Basic accessible components
- **Kind:** foundation · **Lane:** `lane::build-loop` · **Owned files:** `src/components/ui/**`, `tests/unit/ui/**`
- **Story:** As a reviewer I need statuses, issues and actions to read the same everywhere, in text and shape, so that nothing depends on colour alone (GR-4 spirit; `design.md` §2).
- **Scope:** Button (primary, secondary, ghost, danger; sizes 36/44; loading and disabled), Link, TextInput and Textarea
  (label, help, error), Select, Checkbox, Radio and RadioCard, StatusPill and Badge (every row of `design.md` §2, glyph +
  label + colour pair), Banner (blocking, advisory, info, success; icon tile + text), Card and MetricTile, Table
  (header cells with `scope`, numeric columns tabular), Tabs (Radix), Stepper (Draft → In review → Submitted → Approved →
  Exported with `aria-current="step"`), DialogShell (Radix; title, description, footer actions), Toast (with an Undo
  action slot for UXQ-8). Anatomy and states exactly as `design.md` §3.
- **Acceptance:** PE-4, PE-5, PE-6, PE-7, PE-8.
- **Tests named:** one `*.test.tsx` per component in `tests/unit/ui/` (roles, names, states, keyboard).

### FW-3 · Layout primitives
- **Kind:** foundation · **Lane:** `lane::build-loop` · **Owned files:** `src/components/layout/**`, `tests/unit/layout/**`
- **Story:** As a reviewer I need the lesson to sit on a page sheet with the evidence beside it, so that I read and check in one place (Clear Ledger construction; `design.md` §4).
- **Scope:** AppShell (skip link, left nav with sections and counts as props, `nav`/`main` landmarks, collapses below the
  `design.md` breakpoint), PageHeader with Breadcrumb and an actions slot, TwoPane with SideRail (right rail 360 px,
  stacks under the content on narrow widths), PageSheet (reading measure 68ch). Props only; no data.
- **Acceptance:** PE-9.
- **Tests named:** `tests/unit/layout/*.test.tsx` (landmarks, skip link target, breadcrumb `aria-current`).

### FW-4 · Component gallery with accessibility and visual checks
- **Kind:** foundation · **Lane:** `lane::build-loop` · **Owned files:** `app/(dev)/**`, `e2e/gallery/**`, `playwright.config.ts`
- **Story:** As the reviewer of this wave I need every component and state on one page in both themes, so that the look can be checked against the look sheet before features use it.
- **Scope:** `/gallery` renders every FW-2 component in every state and every FW-3 primitive, in light and dark (a theme
  switch writes `data-theme`), using the look-sheet copy where text is shown (`docs/ux/02-concepts/LOOK_SHEET_COPY.md`).
  Playwright runs axe at 1280 × 900 and 390 × 844 in both themes and saves screenshots to `e2e/__screenshots__/`.
- **Acceptance:** PE-10, PE-11.
- **Tests named:** `e2e/gallery/gallery.spec.ts`.

## Review requirements
- [ ] `code-review-agent` per ticket (findings fixed before the next wave)
- [x] accessibility: 0 serious or critical axe violations on the gallery at 1280 and 390, light and dark (PE-10)
- [ ] visual check: the gallery screenshot at 1280 light and dark compared with the D1 look sheet and `design.md` tokens by the orchestrator, result recorded in the dev log (PE-11)
- [ ] `ticket_readiness.py` passes for each ticket before it starts (ticket files in `docs/plans/tickets/`)

## Presentation examples (PE-N)
| ID | Example (observable, in plain words) | Checked by |
|---|---|---|
| PE-1 | `tokens.css` is generated from `design.md`'s tokens block; if the two differ, a test fails | unit test (FW-1) |
| PE-2 | Body text (`ink` on `ground`, `panel`, `well`) meets 4.5:1 in light and dark; secondary text (`ink2`) meets 4.5:1 on every surface it sits on | unit test recomputing ratios from the generated CSS (FW-1) |
| PE-3 | With no `data-theme`, the page follows the system theme; `data-theme="dark"` forces dark; reduced motion turns transitions off | unit test (FW-1) + gallery screenshot (FW-4) |
| PE-4 | The primary button's text meets 4.5:1 on `primary` in both themes; its focus ring is visible against the panel at ≥ 3:1; a disabled button is `aria-disabled` and says why in text when a reason is given | unit test (FW-2) |
| PE-5 | A status pill for each state in `design.md` §2 shows its glyph shape **and** its text label; nothing is colour-only | unit test over every state (FW-2) |
| PE-6 | A blocking banner uses `role="alert"`, an advisory or info banner `role="status"`; each has an icon and a text level word | unit test (FW-2) |
| PE-7 | Tabs move with the arrow keys; the stepper marks the current step with `aria-current="step"` and reads "Step 2 of 5, In review" | unit test (FW-2) |
| PE-8 | The dialog shell traps focus, closes on Escape, returns focus to its trigger and is labelled by its title | unit test (FW-2) |
| PE-9 | The app shell has a working skip link and `nav`/`main` landmarks; at 390 px there is no sideways scroll and the rail stacks below the content | unit test (FW-3) + gallery at 390 (FW-4) |
| PE-10 | The gallery has 0 serious or critical axe violations at 1280 and 390, light and dark | Playwright + axe (FW-4) |
| PE-11 | The gallery at 1280 shows the Clear Ledger palette, radius and type (cool grey desk, white sheet, ink-blue primary, 8 px radius) — compared side by side with the D1 look sheet | screenshot review by the orchestrator (FW-4) |
