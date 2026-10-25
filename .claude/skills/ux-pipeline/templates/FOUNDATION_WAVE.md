# FW · Early frontend foundation wave — readiness record

> Lives at `docs/plans/foundation-wave.md` · Date: YYYY-MM-DD · Status: draft | ready
> Allowed after the UX-2 pick and the `design.md` tokens, while §5–§6 continue (Innocent approved the path 2026-10-25).
> Presentation only. Anything behaviour-dependent goes through the normal feature path after the §6 gate.

## Preconditions
- [ ] UX-2 direction picked: <direction>, Innocent ✓ <date> (`docs/design/DESIGN-DIRECTIONS.md`)
- [ ] Design tokens written: `docs/design/design.md` § <tokens section>
- [ ] This record complete (every section below filled)

## Stack
- Frontend stack: <e.g. React + Vite + TypeScript + shadcn/ui> · Decision source: <ID / doc / Innocent, date>
- Frontend folder: <e.g. `web/`> · Component gallery route or page: <path>

## Owned files (only this wave touches them)
- <path/glob>

## Bounded scope
**Eligible (in this wave):**
- [ ] design tokens (CSS variables, light and dark)
- [ ] typography
- [ ] basic accessible components: button, link, input, badge / status pill, banner, card, table, tabs, stepper, dialog shell
- [ ] layout primitives: app shell, sidebar, page header, split panes

**Not eligible (normal feature path):** permissions, autosave, resumability, booking or job state, data fetching,
backend error recovery, real-time collaboration, anything that reads a CON.

## Dependencies
| Needs | From | Status |
|---|---|---|
| tokens | `design.md` | |

## Ticket specs (one per ticket, same format as zero-to-hero §7b)
### FW-1 · <title>
- Lane: `lane::build-loop` · Owned files: <paths>
- Scope: <eligible items only>
- Acceptance (presentation examples):
  - PE-1: <e.g. "the primary button meets 4.5:1 text contrast on the panel in light and dark; its focus ring is visible at 3:1; its disabled state says so in text">
  - PE-2: <e.g. "a status pill shows text and shape for every state">
- Tests named: <files>

## Review requirements
- [ ] code review (`code-review-agent`)
- [ ] accessibility: 0 serious axe violations on the component gallery
- [ ] visual check: the gallery at 1280 px matches the look sheet's palette and radius tokens and `design.md`

## Presentation examples (PE-N)
| ID | Example (observable, in plain words) | Checked by |
|---|---|---|
| PE-1 | | axe · screenshot · test |
