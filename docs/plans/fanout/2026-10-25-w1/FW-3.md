# Plan FW-3: layout primitives (wave 1, lane::build-loop, not risk::security)

Blocked by FW-1 (merged on main at 186e5fe). Parallel with FW-2.

## Owned files (create only these)
- `apps/web/src/components/layout/app-shell.tsx`
- `apps/web/src/components/layout/page-header.tsx` (exports `PageHeader` and `Breadcrumb`)
- `apps/web/src/components/layout/two-pane.tsx` (exports `TwoPane` and `SideRail`)
- `apps/web/src/components/layout/page-sheet.tsx`
- `apps/web/src/components/layout/index.ts` (re-exports; FW-4 and NL-24 import from `@/components/layout`)
- `apps/web/tests/unit/layout/app-shell.test.tsx`, `page-header.test.tsx`, `two-pane.test.tsx`, `page-sheet.test.tsx`
- Area map row + dev-log entry (AC-5), see end.

Do NOT edit: `package.json`, `tsconfig.json`, `vitest.config.ts`, `globals.css`, `tokens.css`, `src/lib/cn.ts` (read-only, FW-1's). No new dependencies, no pins to change (all needed packages are already installed: react 19.3.0, @testing-library/react 16.3.3, user-event 14.6.7, vitest 5.0.3, jest-dom 7.0.1). Nothing to `npm view`.

## Real code to reuse (main)
- `import { cn } from "@/lib/cn";` with `export function cn(...inputs: ClassValue[]): string`. Alias `@` -> `apps/web/src` is set in `vitest.config.ts` and `tsconfig.json`.
- Vitest: `environment: "jsdom"`, `include: ["tests/unit/**/*.test.{ts,tsx}"]`, `setupFiles: ["./tests/unit/tokens/setup.ts"]` (which already imports `@testing-library/jest-dom/vitest`), `globals: false`, so import `describe, it, expect` from "vitest" and `render, screen, within` from "@testing-library/react". Test pattern: see `tests/unit/tokens/page.test.tsx`.
- Tailwind v4 theme from `src/styles/tokens.css`: colours `bg-ground bg-panel bg-selected border-hair text-ink text-ink2 text-ink3 text-primary border-edge`; spacing `--space-N`; radius `rounded-xl` (12), `rounded-md` (8); breakpoints `md`=768, `lg`=1024, `xl`=1280 (`--breakpoint-*`); layout vars `--layout-nav-rail` 60px, `--layout-top-bar` 56px, `--layout-rail` 360px, `--layout-rail-narrow` 288px, `--layout-content-max` 1440px, `--layout-phone-gutter` 16px; `--z-sticky` 10. Use arbitrary values like `md:grid-cols-[var(--layout-nav-rail)_minmax(0,1fr)]`, `lg:grid-cols-[minmax(0,1fr)_var(--layout-rail)]`, `max-w-[68ch]`, `z-[var(--z-sticky)]`. If a utility name (e.g. `z-sticky`, `text-label`) is not generated, fall back to arbitrary-value syntax; do not edit tokens.
- Focus ring rule (design.md section 5.3): do not remove outlines; skip link uses `focus-visible:outline-2 outline-focus outline-offset-2`.

## Component contracts (props only; no data/session/routing; no `next/link`, no `usePathname`)
```ts
// app-shell.tsx
export type NavCount = number;
export interface NavItem { id: string; label: string; href: string; count?: NavCount; current?: boolean; icon?: React.ReactNode }
export interface NavSection { id: string; label?: string; items: NavItem[] }
export interface AppShellProps {
  navSections: NavSection[];
  topBar?: React.ReactNode;          // breadcrumb / account slot, rendered in <header>
  children: React.ReactNode;         // rendered inside <main id="main-content">
  productName?: string;              // default "Lesson Studio"
}
export function AppShell(props: AppShellProps): React.JSX.Element
```
- First focusable element: `<a href="#main-content">Skip to main content</a>` (visually hidden until `:focus-visible`, `sr-only focus-visible:not-sr-only`). Target `<main id="main-content" tabIndex={-1}>`.
- `<header>` (top bar, sticky, h-[var(--layout-top-bar)]) containing `topBar` and a mobile menu `<button type="button" aria-expanded aria-controls="app-nav" aria-label="Menu">` (use `useState`; mark file `"use client"`). Below `md` the `<nav aria-label="Primary" id="app-nav">` is hidden unless open; from `md` it is always shown (`hidden md:block` + open state class). Only renders presentational toggle, no routing.
- `<nav aria-label="Primary">` lists sections (optional section label as heading element `h2` with class `label`), items as `<a href>`; current item `aria-current="page"`; count rendered as text `<span>` and included in the accessible name via visible text.
- `<main>` max width `--layout-content-max`, padding 16px phone, 24x32 from md.

```ts
// page-header.tsx
export interface Crumb { label: string; href?: string }
export interface BreadcrumbProps { items: Crumb[] }
export function Breadcrumb(p: BreadcrumbProps): React.JSX.Element
//  <nav aria-label="Breadcrumb"><ol>; non-last crumbs with href render <a>; LAST crumb is a <span aria-current="page"> (never a link); chevron separators aria-hidden.
export interface PageHeaderProps { eyebrow?: string; title: React.ReactNode; meta?: React.ReactNode; breadcrumb?: Crumb[]; actions?: React.ReactNode }
export function PageHeader(p: PageHeaderProps): React.JSX.Element
//  <header> with optional Breadcrumb, eyebrow, one <h1>{title}</h1>, meta, and <div data-slot="actions">{actions}</div> rendered only if actions given.
```
```ts
// two-pane.tsx
export interface TwoPaneProps { children: React.ReactNode; rail: React.ReactNode; railWidth?: "rail" | "rail-narrow"; className?: string }
export function TwoPane(p: TwoPaneProps): React.JSX.Element
//  DOM order: content <div> FIRST, then rail. grid: single column by default (rail stacks below), at lg: grid-cols [minmax(0,1fr) 360px|288px], gap 24px. Rail sticky only at lg (lg:sticky lg:top-[var(--layout-top-bar)] self-start).
//  data attribute data-rail-width={railWidth} for tests (class strings are not asserted in jsdom, CSS is not computed).
export interface SideRailProps { title: string; children: React.ReactNode; narrow?: boolean; className?: string }
export function SideRail(p: SideRailProps): React.JSX.Element
//  <aside aria-labelledby={id}>; header h2 with title (use React.useId); panel, border-hair, rounded-xl, p 12x16, overflow-y-auto.
```
`TwoPane` places `rail` inside its own wrapper; callers pass `<SideRail title="Evidence">`. Breakpoint note: design.md says <lg the rail becomes a drawer on the lesson workspace; for FW-3 stack-below is the specified behaviour (ticket AC-3); drawer is out of scope (lesson workspace, later ticket).
```ts
// page-sheet.tsx
export interface PageSheetProps { children: React.ReactNode; toolbar?: React.ReactNode; className?: string }
export function PageSheet(p: PageSheetProps): React.JSX.Element
//  <article data-slot="page-sheet"> bg-panel border border-hair rounded-xl shadow (light e2: use existing elevation var if present, else omit); optional toolbar strip (border-b border-hair); reading column <div data-slot="reading-column" class="max-w-[68ch] mx-auto px-8 py-6 max-sm:px-4"> wrapping children.
```
`index.ts`: `export * from "./app-shell"; export * from "./page-header"; export * from "./two-pane"; export * from "./page-sheet";`

Only `app-shell.tsx` needs `"use client"` (useState). Keep others server-safe.

## Tests (PE-9; names per ticket)
- `app-shell.test.tsx` (AC-1): render with two sections (counts 3 and 0). Assert: first tabbable via `userEvent.tab()` is the link named /skip to main content/i with `href="#main-content"`; `document.getElementById("main-content")` is the `main` element (`getByRole("main")`); `getAllByRole("navigation")` includes one named "Primary"; `getByRole("banner")` exists; current item has `aria-current="page"`; count appears in text (`getByRole("link", {name: /Drafts.*3/})`); menu button toggles `aria-expanded` false->true on click.
- `page-header.test.tsx` (AC-2): Breadcrumb: `getByRole("navigation",{name:"Breadcrumb"})`; last item has `aria-current="page"` and is not a link; earlier items are links without `aria-current`; single-item case. PageHeader: one h1 with title, eyebrow and meta text shown, actions slot content rendered (`getByRole("button",{name:"Approve"})`), no actions wrapper when omitted (`container.querySelector('[data-slot="actions"]')` null).
- `two-pane.test.tsx` (AC-3): in DOM, content node precedes the rail (`content.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING` truthy); rail is `complementary` landmark named by its title; `railWidth="rail-narrow"` sets `data-rail-width="rail-narrow"` (default `"rail"`); wrapper class contains `lg:grid-cols` (string check on the className to document the breakpoint; jsdom does not evaluate media queries; real 390 px no-sideways-scroll check is FW-4's gallery run, per ticket).
- `page-sheet.test.tsx`: reading column has class containing `max-w-[68ch]`; toolbar rendered when given; children rendered.

## Commands (run from `/home/linuxuser/workspaces/inno-newsela/apps/web`)
- Iterating: `npm test -- tests/unit/layout`
- Pre-commit gate (AC-4): `npm run lint && npm run typecheck && npm test -- tests/unit/layout`
- No full suite (tokens tests untouched; no shared fixture/config change).
- Formatter: none configured in the project; lint is the format gate. Do not run `next build`.
- Context check (AC-5): `python3 ~/.claude/skills/icm-project/scripts/check_context.py /home/linuxuser/workspaces/inno-newsela` -> no FAIL.

## Context upkeep (AC-5, same commit)
- `.claude/reference/area-map.md` FW row (line 24): change "FW-2..4 planned" to note "FW-3 built: `apps/web/src/components/layout/`, `apps/web/tests/unit/layout/`; FW-2, FW-4 planned" (keep FW-2's state as found at merge; append-style row edit only).
- ICM row: none changes unless a route's evidence changed; do not touch.
- Dev log: one new file `docs/devlog/2026-10-25-fw-3-layout.md` (Changed · Why · Checked · Remaining, 50-100 words) with the test output. If the batch merger owns the dev-log, return the note instead.

## Open items
- Nav/section data shape (`NavSection`/`NavItem`) is invented here as props; NL-24 wires real data. Not a blocker; flag at review.
- Lesson workspace 3-column (outline) and the <lg drawer are not in this ticket; ticket AC-3 requires stacking only.
- Elevation token name for `e2` was not verified in `tokens.css`; implementer checks `grep -n elevation src/styles/tokens.css` and uses the matching `shadow-*` utility, else omits the shadow.
- No NEEDS-DECISION.
