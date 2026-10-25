# Design — Newsela Lesson Studio · D1 Clear Ledger (UX-3b)

**Owner of:** the design principles, the design tokens (colour, type, space, radius, borders, elevation, motion,
z-index, breakpoints), the status vocabulary, component anatomy and states, layout primitives and the accessibility
rules for Lesson Studio. **Written:** 2026-10-25 by Claude. **Status:** proposed (UX-3b; Innocent signs screen specs per
wave in [`SCREEN_SPECS.md`](../ux/03-structure/SCREEN_SPECS.md); nothing here is signed).
**Built from:** the pick in [`DESIGN-DIRECTIONS.md`](DESIGN-DIRECTIONS.md) (D1 · Clear Ledger, Innocent 2026-10-25),
the look-sheet generator [`build_d1_look.py`](../artifacts/_build/d1-look/build_d1_look.py) and its sheet
[`2026-10-25-d1-clear-ledger-look-sheet.html`](../artifacts/2026-10-25-d1-clear-ledger-look-sheet.html), the
[feel brief](../ux/02-concepts/FEEL_BRIEF.md), and the workspace `ui-*` rules (UI-4…UI-15).
**Read with:** [`IA.md`](../ux/03-structure/IA.md) (where things are) and
[`SCREEN_SPECS.md`](../ux/03-structure/SCREEN_SPECS.md) (what each screen shows in every state).

## What it looks like in practice

A reviewer opens Lesson 4. The window has a light grey desk (`ground`). A white page (`panel`) sits in the middle with
one soft shadow, and the lesson text is set at 16 px in a column about 68 characters wide. Above the page, a stepper
shows *Draft → **In review** → Submitted → Approved → Exported*. To the right, a white rail titled "Issues · Standards"
lists three blocking issues. Each issue carries a red octagon glyph **and** the word "Blocking". Nothing else on the
screen is red. At the bottom, "Submit for approval" is grey, with a lock and the reason beside it: "3 blocking issues".

That is the whole direction: a document on a desk, a quiet editor's frame around it, evidence beside the text, and
colour saved for the few things that stop a lesson.

## 1. Principles (from the feel brief)

| # | Principle | What it means on screen |
|---|---|---|
| P-1 | **Calm, not urgent** | Grey desk, white sheets, hairline borders. One accent (ink blue). Red appears only on blocking issues and failures; amber only on advisories, warnings and "waiting" states. |
| P-2 | **Editorial first, dashboard second** | The lesson is a page sheet with a reading measure and generous margins. Boards and queues exist to get the reviewer to that page. |
| P-3 | **Expert tool, but warm** | Dense, aligned tables and keyboard paths for professionals; plain sentences and real names ("M. Okafor is editing Part B") so it never feels machine-made. Copy never says AI replaces writers (GR-16). |
| P-4 | **Dense where scanning, airy where reading** | Tables and the board use 12 px cell padding and tabular numbers; the lesson page uses 16 px text at 1.6 line height. |
| P-5 | **Evidence visible, never a bare verdict** | No "aligned" badge (GR-4). Every flag shows its source and who asserted it; every approval shows the pinned snapshot. |
| P-6 | **Accountable** | Names, times and hashes are on screen where a decision is made. A disabled action always says why, in text. |
| P-7 | **AI is one quiet, labelled tool** | No sparkle, no gradient, no purple "magic" button. AI help is a plain secondary button and a side panel (R-31). |

**Avoid** (feel brief §5): LMS grey chrome, clip-art, mascots, primary-colour palettes, crowded toolbars, alarm
everywhere, AI sparkle, and the house texture (cream canvas, serif headings, outlined pills, sage accents).

## Design tokens

Two tiers (UI-10). The tables below are the **semantic** tokens components read; the raw values are the hex codes.
In CSS each colour is `--color-<name>` (e.g. `--color-ink2`), each space step `--space-<step>`, and so on. Light is
the default theme; dark is designed, not inverted (UI-9). The machine-readable copy is the `tokens` JSON block at the
end of this section.

### Colour

| Token | Light | Dark | Job |
|---|---|---|---|
| `ground` | `#F4F5F7` | `#0F1115` | The desk: app background behind sheets |
| `panel` | `#FFFFFF` | `#171A20` | Sheets, cards, rails, top bar, nav rail |
| `well` | `#F1F3F6` | `#1E222A` | Inset areas: code chips, segmented controls, sample responses, guard tiles |
| `selected` | `#EAF0FE` | `#1C2744` | Current nav item, selected row or radio card, focus halo on the stepper, in-review pill |
| `overlay` | `#FFFFFF` | `#1E222A` | Dialogs, toasts, popovers (in dark, one step lighter than `panel` instead of a shadow) |
| `hair` | `#E2E5EA` | `#2A2F38` | Decorative dividers and sheet borders only (never the only boundary of a control) |
| `edge` | `#858D9B` | `#6E7685` | Meaningful boundaries: input, checkbox and radio borders, the "next" stepper dot (≥ 3:1) |
| `ink` | `#14171C` | `#ECEEF2` | Main text, headings |
| `ink2` | `#4A5260` | `#A9B0BC` | Secondary text: meta lines, table notes, helper text |
| `ink3` | `#5D6573` | `#959DAA` | Tertiary text: labels, table headers, eyebrows, disabled-button text |
| `primary` | `#1F4FD8` | `#8AA9FF` | The one accent: primary buttons, links, focus ring, in-review state |
| `on-primary` | `#FFFFFF` | `#0B1530` | Text and icons on `primary` |
| `danger` | `#B42318` | `#F2806F` | Blocking issues, errors, failed states |
| `danger-tint` | `#FDEDEB` | `#3A1D1B` | Background of blocking tags and error banners |
| `on-danger` | `#FFFFFF` | `#1F0A07` | Text on `danger` (issue number markers) |
| `warn` | `#A4480A` | `#EFA65C` | Advisories, warnings, submitted and waiting states |
| `warn-tint` | `#FEF3E4` | `#32250F` | Background of advisory tags and warning banners |
| `on-warn` | `#FFFFFF` | `#1C1206` | Icons on `warn` (banner icon tiles) |
| `success` | `#17734A` | `#5CCB96` | Approved, ready, confirmed, done steps |
| `success-tint` | `#E7F5ED` | `#122A20` | Background of approved tags, OK rows, success banners |
| `on-success` | `#FFFFFF` | `#06170F` | Icons on `success` |
| `disabled` | `#E6E9EE` | `#262B34` | Disabled button fill |
| `presence-1` … `presence-4` | `#1F4FD8` `#0F6E73` `#8A3FB0` `#9A3412` | `#8AA9FF` `#5CC8C8` `#C9A2F0` `#F2A27A` | Co-editor cursors and name flags (each always shows the person's name) |
| `on-presence` | `#FFFFFF` | `#0B0D12` | Name text on a presence flag |
| `scrim` | `rgba(20,23,28,.40)` | `rgba(0,0,0,.60)` | Behind modal dialogs |
| `focus` | = `primary` | = `primary` | Focus ring colour (alias) |

### Contrast pairs (computed, not asserted)

Computed with the WCAG 2.x relative-luminance formula (the same `lum`/`ratio` functions as the look-sheet generator)
by the snippet in *How the ratios were computed* below, on 2026-10-25. Text pairs need 4.5:1; UI parts (control
boundaries, meaningful glyphs, focus rings, filled buttons) need 3:1. **All 59 pairs pass in both themes.**

- **Lowest text pair, light:** `ink3` on `disabled` = **4.83:1** (disabled-button label). **Dark:** `ink3` on `disabled` = **5.20:1**.
- **Lowest UI pair, light:** `edge` on `well` = **3.01:1** (just passes: keep inputs on `panel`, not inside wells). **Dark:** `edge` on `well` = **3.49:1**.
- `hair` on `panel` is 1.26:1 (light) and 1.30:1 (dark). That is why `hair` is decorative only and inputs use `edge`.
- Dark theme: as a second opinion (UI-14), run an APCA check on `ink3`, `edge` and the tints at UX-5a. It does not replace the 4.5:1 check.

| Kind | Foreground on background | Needs | Light | Dark |
|---|---|---|---|---|
| text | `ink` on `ground` | 4.5:1 | 16.47 | 16.27 |
| text | `ink` on `panel` | 4.5:1 | 17.96 | 15.00 |
| text | `ink` on `well` | 4.5:1 | 16.16 | 13.72 |
| text | `ink` on `selected` | 4.5:1 | 15.73 | 12.70 |
| text | `ink` on `overlay` | 4.5:1 | 17.96 | 13.72 |
| text | `ink2` on `ground` | 4.5:1 | 7.22 | 8.66 |
| text | `ink2` on `panel` | 4.5:1 | 7.87 | 7.99 |
| text | `ink2` on `well` | 4.5:1 | 7.08 | 7.30 |
| text | `ink2` on `selected` | 4.5:1 | 6.90 | 6.76 |
| text | `ink2` on `overlay` | 4.5:1 | 7.87 | 7.30 |
| text | `ink3` on `ground` | 4.5:1 | 5.39 | 6.91 |
| text | `ink3` on `panel` | 4.5:1 | 5.88 | 6.37 |
| text | `ink3` on `well` | 4.5:1 | 5.29 | 5.83 |
| text | `ink3` on `selected` | 4.5:1 | 5.15 | 5.40 |
| text | `ink3` on `disabled` | 4.5:1 | 4.83 | 5.20 |
| text | `primary` on `panel` | 4.5:1 | 6.63 | 7.63 |
| text | `primary` on `ground` | 4.5:1 | 6.08 | 8.28 |
| text | `primary` on `well` | 4.5:1 | 5.96 | 6.98 |
| text | `primary` on `selected` | 4.5:1 | 5.81 | 6.46 |
| text | `on-primary` on `primary` | 4.5:1 | 6.63 | 7.90 |
| text | `danger` on `panel` | 4.5:1 | 6.57 | 6.72 |
| text | `danger` on `ground` | 4.5:1 | 6.03 | 7.28 |
| text | `danger` on `danger-tint` | 4.5:1 | 5.79 | 5.90 |
| text | `ink` on `danger-tint` | 4.5:1 | 15.82 | 13.18 |
| text | `ink2` on `danger-tint` | 4.5:1 | 6.93 | 7.02 |
| text | `on-danger` on `danger` | 4.5:1 | 6.57 | 7.33 |
| text | `warn` on `panel` | 4.5:1 | 5.98 | 8.53 |
| text | `warn` on `ground` | 4.5:1 | 5.48 | 9.25 |
| text | `warn` on `warn-tint` | 4.5:1 | 5.46 | 7.30 |
| text | `ink` on `warn-tint` | 4.5:1 | 16.38 | 12.85 |
| text | `ink2` on `warn-tint` | 4.5:1 | 7.18 | 6.84 |
| text | `on-warn` on `warn` | 4.5:1 | 5.98 | 9.03 |
| text | `success` on `panel` | 4.5:1 | 5.85 | 8.66 |
| text | `success` on `ground` | 4.5:1 | 5.37 | 9.39 |
| text | `success` on `success-tint` | 4.5:1 | 5.21 | 7.58 |
| text | `ink` on `success-tint` | 4.5:1 | 15.98 | 13.12 |
| text | `ink2` on `success-tint` | 4.5:1 | 7.00 | 6.98 |
| text | `on-success` on `success` | 4.5:1 | 5.85 | 9.18 |
| text | `on-presence` on `presence-1` | 4.5:1 | 6.63 | 8.51 |
| text | `on-presence` on `presence-2` | 4.5:1 | 6.00 | 9.76 |
| text | `on-presence` on `presence-3` | 4.5:1 | 6.14 | 9.17 |
| text | `on-presence` on `presence-4` | 4.5:1 | 7.31 | 9.46 |
| ui | `primary` on `panel` | 3:1 | 6.63 | 7.63 |
| ui | `primary` on `ground` | 3:1 | 6.08 | 8.28 |
| ui | `primary` on `well` | 3:1 | 5.96 | 6.98 |
| ui | `primary` on `selected` | 3:1 | 5.81 | 6.46 |
| ui | `edge` on `panel` | 3:1 | 3.34 | 3.81 |
| ui | `edge` on `ground` | 3:1 | 3.07 | 4.13 |
| ui | `edge` on `well` | 3:1 | 3.01 | 3.49 |
| ui | `danger` on `panel` | 3:1 | 6.57 | 6.72 |
| ui | `warn` on `panel` | 3:1 | 5.98 | 8.53 |
| ui | `success` on `panel` | 3:1 | 5.85 | 8.66 |
| ui | `danger` on `danger-tint` | 3:1 | 5.79 | 5.90 |
| ui | `warn` on `warn-tint` | 3:1 | 5.46 | 7.30 |
| ui | `success` on `success-tint` | 3:1 | 5.21 | 7.58 |
| ui | `presence-1` on `panel` | 3:1 | 6.63 | 7.63 |
| ui | `presence-2` on `panel` | 3:1 | 6.00 | 8.76 |
| ui | `presence-3` on `panel` | 3:1 | 6.14 | 8.22 |
| ui | `presence-4` on `panel` | 3:1 | 7.31 | 8.48 |

### Type

**Families.** Sans: `"Inter", "Inter Variable", -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI",
"Helvetica Neue", system-ui, sans-serif` (the look sheet's stack). Mono: `ui-monospace, "SF Mono", "JetBrains Mono",
Menlo, Consolas, monospace`, used for standard codes, addresses, hashes, versions and filenames.
**Weights:** 400 regular, 500 medium, 600 semibold, 650 strong (variable font; a static fallback renders 600 or 700).
**Numbers** that align or change use `font-variant-numeric: tabular-nums`. Headings use `text-wrap: balance`, paragraphs
`text-wrap: pretty`; body text is antialiased.

| Token | Size / line height | Weight | Tracking | Used for |
|---|---|---|---|---|
| `micro` | 11 / 1.3 | 500 | 0 | "Step 2/5" under stepper labels, `kbd`, presence initials. Never body content |
| `caps` | 11 / 1.2 | 600 | +0.06em, uppercase | Issue-level tags in the rail ("BLOCKING") |
| `label` | 12 / 1.4 | 600 | +0.01em | Eyebrows, table headers, rail labels, status pill text |
| `small` | 13 / 1.45 | 400 | 0 | Meta lines, helper text, secondary cells, small buttons |
| `body` | 14 / 1.5 | 400 | 0 | UI body, table cells, buttons, dialog text |
| `reading` | 16 / 1.6 | 400 | 0 | Lesson text in the page sheet; measure `68ch` |
| `title-sm` | 17 / 1.3 | 650 | -0.01em | Routine headings in a lesson, card titles |
| `title` | 20 / 1.25 | 650 | -0.012em | Dialog titles, page-sheet section headings |
| `page` | 24 / 1.2 | 650 | -0.018em | The page's one `h1` |
| `stat` | 28 / 1.1 | 650 | -0.02em | Roll-up counts on the unit board |
| `display` | 34 / 1.0 | 650 | -0.03em | The north-star number |
| `code` | 12 / 1.5 (mono) | 400–600 | 0 | Code chips, versions, hashes |

### Space (4 px base)

| Token | `0` | `px` | `0.5` | `1` | `1.5` | `2` | `3` | `4` | `5` | `6` | `8` | `10` | `12` | `16` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| px | 0 | 1 | 2 | 4 | 6 | 8 | 12 | 16 | 20 | 24 | 32 | 40 | 48 | 64 |

**Semantic spacing:** `gap-inline` 8 (icon to label: 6), `pad-control-x` 16 (md) / 12 (sm), `pad-cell` 12 (dense 8),
`pad-card` 16, `pad-sheet` 24, `pad-reading-x` 32, `gap-stack` 12, `gap-section` 24, `pad-main` 24 × 32 (phone: 16).
**Control heights:** `sm` 28, `md` 36, `lg` 44; on `(pointer: coarse)` every control is at least 44 tall.

### Radius

| Token | px | Used for |
|---|---|---|
| `none` | 0 | Table cells |
| `xs` | 4 | Code chips, `kbd`, version chip |
| `sm` | 6 | Status pills, segmented-control thumbs, toolbar select |
| `md` | 8 | **The base**: buttons, inputs, selects, nav items, icon tiles, guard tiles, sample-response blocks |
| `lg` | 10 | Banners, issue cards, quote slots, radio cards, toasts |
| `xl` | 12 | Page sheets, cards, rails, footer action bar, dialogs |
| `2xl` | 14 | The stepper |
| `full` | 9999 | Avatars, stepper dots, radios, presence markers |

### Borders

| Token | Value | Used for |
|---|---|---|
| `border-hair` | 1 px `hair` | Sheets, cards, rails, table rules, dividers |
| `border-control` | 1 px `edge` | Inputs, selects, textareas |
| `border-strong` | 1.5 px `edge` | Checkboxes, radios, the "next" stepper dot |
| `border-slot` | 1.5 px dashed `primary` | Quote placeholders and excerpt slots in the lesson |
| `border-selected` | 1.5 px inset `primary` | Selected radio card, current issue card |
| `focus-ring` | 2 px solid `focus`, offset 2 px | Every focusable element (`:focus-visible`) |

### Elevation

Light uses at most two shadow levels plus an overlay level; dark uses **no shadows** and steps surfaces lighter
(`ground` → `panel` → `overlay`), with a `hair` border on overlays (UI-9).

| Token | Light | Dark | Used for |
|---|---|---|---|
| `e0` | none | none | Tables, wells, rails' inner content |
| `e-control` | `0 1px 1px rgba(16,24,40,.05)` | none | Secondary buttons |
| `e1` | `0 1px 2px rgba(16,24,40,.04)` | none | Cards, stepper, rails |
| `e2` | `0 1px 2px rgba(16,24,40,.04), 0 10px 28px -16px rgba(16,24,40,.16)` | none | The page sheet (the "one soft page shadow") |
| `e3` | `0 1px 2px rgba(16,24,40,.05), 0 24px 48px -24px rgba(16,24,40,.22)` | none + `overlay` surface + `hair` border | Dialogs, toasts, popovers |

### Motion

| Token | Value | Used for |
|---|---|---|
| `duration-fast` | 120 ms | Hover, press, colour changes, tile state changes |
| `duration-base` | 180 ms | Tab indicator, popover, toast enter |
| `duration-slow` | 240 ms | Dialog open, rail drawer slide |
| `ease-standard` | `cubic-bezier(.2,0,0,1)` | Most transitions |
| `ease-enter` | `cubic-bezier(0,0,0,1)` | Things arriving |
| `ease-exit` | `cubic-bezier(.4,0,1,1)` | Things leaving |
| `delay-indicator` | 250 ms | Wait before showing any spinner, so quick answers never flicker (UI-11) |

**Rules.** Animate only `opacity` and `transform`. Nothing loops except a spinner on a wait over 1 s. Board and tile
updates from polling change in place (120 ms fade), never slide or reorder with animation.
Motion is written as an opt-in (`@media (prefers-reduced-motion: no-preference)`), so the default is calm. **Under `reduce`:** every duration becomes 0 except opacity cross-fades (capped at 120 ms); no
transforms; the spinner becomes the static text "Working…" with its step count.

### Z-index

| Token | Value | Layer |
|---|---|---|
| `z-base` | 0 | Page content |
| `z-raised` | 1 | Sticky table headers |
| `z-sticky` | 10 | Top bar, footer action bar |
| `z-drawer` | 20 | The evidence rail when it is a drawer (under 1024 px) |
| `z-popover` | 30 | Menus, selects, popovers |
| `z-toast` | 40 | Toasts |
| `z-scrim` | 50 | Modal scrim |
| `z-dialog` | 60 | Dialogs (native `<dialog>` uses the top layer; the token covers fallbacks) |
| `z-tooltip` | 70 | Tooltips |

### Breakpoints and layout sizes

| Token | Min width | What changes |
|---|---|---|
| `sm` | 640 | Dialogs stop being full-screen sheets |
| `md` | 768 | Left nav rail appears (below it: a top bar with a menu button) |
| `lg` | 1024 | Right rail sits beside the content (below it: the rail becomes a drawer opened by an "Evidence" button) |
| `xl` | 1280 | The workspace shows three columns: section outline, page, rail. **The design width** |
| `2xl` | 1536 | Content stops growing (`content-max` 1440); the desk widens |

**Layout sizes:** `nav-rail` 60, `top-bar` 56, `outline` 160, `rail` 360, `rail-narrow` 288, `metric-tile` 340,
`reading-measure` 68ch, `dialog-sm` 440, `dialog-md` 560, `dialog-lg` 720, `content-max` 1440, phone gutter 16.

### Machine-readable tokens

Block name: `tokens`. Numbers are px unless the key says otherwise. The foundation wave (FW) turns this block into CSS
variables (`--color-*`, `--font-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--duration-*`, `--ease-*`, `--z-*`) with
light on `:root`, dark under `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`, and
`color-scheme: light dark`.

```json tokens
{
  "name": "clear-ledger",
  "version": "0.1.0",
  "status": "proposed",
  "source": "docs/artifacts/_build/d1-look/build_d1_look.py (LIGHT, DARK, CSS)",
  "colors": {
    "light": {
      "ground": "#F4F5F7", "panel": "#FFFFFF", "well": "#F1F3F6", "selected": "#EAF0FE", "overlay": "#FFFFFF",
      "hair": "#E2E5EA", "edge": "#858D9B",
      "ink": "#14171C", "ink2": "#4A5260", "ink3": "#5D6573",
      "primary": "#1F4FD8", "on-primary": "#FFFFFF",
      "danger": "#B42318", "danger-tint": "#FDEDEB", "on-danger": "#FFFFFF",
      "warn": "#A4480A", "warn-tint": "#FEF3E4", "on-warn": "#FFFFFF",
      "success": "#17734A", "success-tint": "#E7F5ED", "on-success": "#FFFFFF",
      "disabled": "#E6E9EE",
      "presence-1": "#1F4FD8", "presence-2": "#0F6E73", "presence-3": "#8A3FB0", "presence-4": "#9A3412",
      "on-presence": "#FFFFFF",
      "scrim": "rgba(20,23,28,0.40)", "focus": "#1F4FD8"
    },
    "dark": {
      "ground": "#0F1115", "panel": "#171A20", "well": "#1E222A", "selected": "#1C2744", "overlay": "#1E222A",
      "hair": "#2A2F38", "edge": "#6E7685",
      "ink": "#ECEEF2", "ink2": "#A9B0BC", "ink3": "#959DAA",
      "primary": "#8AA9FF", "on-primary": "#0B1530",
      "danger": "#F2806F", "danger-tint": "#3A1D1B", "on-danger": "#1F0A07",
      "warn": "#EFA65C", "warn-tint": "#32250F", "on-warn": "#1C1206",
      "success": "#5CCB96", "success-tint": "#122A20", "on-success": "#06170F",
      "disabled": "#262B34",
      "presence-1": "#8AA9FF", "presence-2": "#5CC8C8", "presence-3": "#C9A2F0", "presence-4": "#F2A27A",
      "on-presence": "#0B0D12",
      "scrim": "rgba(0,0,0,0.60)", "focus": "#8AA9FF"
    }
  },
  "type": {
    "family": {
      "sans": "\"Inter\", \"Inter Variable\", -apple-system, BlinkMacSystemFont, \"SF Pro Text\", \"Segoe UI\", \"Helvetica Neue\", system-ui, sans-serif",
      "mono": "ui-monospace, \"SF Mono\", \"JetBrains Mono\", Menlo, Consolas, monospace"
    },
    "weight": { "regular": 400, "medium": 500, "semibold": 600, "strong": 650 },
    "scale": {
      "micro":    { "size": 11, "lineHeight": 1.3,  "weight": 500, "tracking": "0" },
      "caps":     { "size": 11, "lineHeight": 1.2,  "weight": 600, "tracking": "0.06em", "transform": "uppercase" },
      "label":    { "size": 12, "lineHeight": 1.4,  "weight": 600, "tracking": "0.01em" },
      "small":    { "size": 13, "lineHeight": 1.45, "weight": 400, "tracking": "0" },
      "body":     { "size": 14, "lineHeight": 1.5,  "weight": 400, "tracking": "0" },
      "reading":  { "size": 16, "lineHeight": 1.6,  "weight": 400, "tracking": "0" },
      "title-sm": { "size": 17, "lineHeight": 1.3,  "weight": 650, "tracking": "-0.01em" },
      "title":    { "size": 20, "lineHeight": 1.25, "weight": 650, "tracking": "-0.012em" },
      "page":     { "size": 24, "lineHeight": 1.2,  "weight": 650, "tracking": "-0.018em" },
      "stat":     { "size": 28, "lineHeight": 1.1,  "weight": 650, "tracking": "-0.02em", "numeric": "tabular-nums" },
      "display":  { "size": 34, "lineHeight": 1.0,  "weight": 650, "tracking": "-0.03em", "numeric": "tabular-nums" },
      "code":     { "size": 12, "lineHeight": 1.5,  "weight": 400, "family": "mono" }
    },
    "measure": { "reading": "68ch" }
  },
  "space": { "0": 0, "px": 1, "0.5": 2, "1": 4, "1.5": 6, "2": 8, "3": 12, "4": 16, "5": 20, "6": 24, "8": 32, "10": 40, "12": 48, "16": 64 },
  "spaceSemantic": {
    "gap-inline": 8, "gap-icon": 6, "pad-control-x-md": 16, "pad-control-x-sm": 12, "pad-cell": 12, "pad-cell-dense": 8,
    "pad-card": 16, "pad-sheet": 24, "pad-reading-x": 32, "gap-stack": 12, "gap-section": 24,
    "pad-main-y": 24, "pad-main-x": 32, "pad-main-phone": 16
  },
  "control": { "height": { "sm": 28, "md": 36, "lg": 44, "coarse-min": 44 } },
  "radius": { "none": 0, "xs": 4, "sm": 6, "md": 8, "lg": 10, "xl": 12, "2xl": 14, "full": 9999 },
  "border": {
    "width": { "hair": 1, "control": 1, "strong": 1.5, "focus": 2 },
    "focusOffset": 2,
    "role": { "hair": "hair", "control": "edge", "strong": "edge", "slot": "primary dashed", "selected": "primary inset", "focus": "focus" }
  },
  "elevation": {
    "light": {
      "e0": "none",
      "e-control": "0 1px 1px rgba(16,24,40,.05)",
      "e1": "0 1px 2px rgba(16,24,40,.04)",
      "e2": "0 1px 2px rgba(16,24,40,.04), 0 10px 28px -16px rgba(16,24,40,.16)",
      "e3": "0 1px 2px rgba(16,24,40,.05), 0 24px 48px -24px rgba(16,24,40,.22)"
    },
    "dark": { "e0": "none", "e-control": "none", "e1": "none", "e2": "none", "e3": "none" }
  },
  "motion": {
    "duration": { "instant": 0, "fast": 120, "base": 180, "slow": 240, "indicatorDelay": 250 },
    "easing": { "standard": "cubic-bezier(.2,0,0,1)", "enter": "cubic-bezier(0,0,0,1)", "exit": "cubic-bezier(.4,0,1,1)" },
    "reducedMotion": { "durations": 0, "opacityFadeMax": 120, "transforms": false, "spinner": "static text" }
  },
  "z": { "base": 0, "raised": 1, "sticky": 10, "drawer": 20, "popover": 30, "toast": 40, "scrim": 50, "dialog": 60, "tooltip": 70 },
  "breakpoints": { "sm": 640, "md": 768, "lg": 1024, "xl": 1280, "2xl": 1536 },
  "layout": {
    "nav-rail": 60, "top-bar": 56, "outline": 160, "rail": 360, "rail-narrow": 288, "metric-tile": 340,
    "dialog-sm": 440, "dialog-md": 560, "dialog-lg": 720, "content-max": 1440, "phone-gutter": 16
  }
}
```

### How the ratios were computed

```python
def lum(h):  # WCAG 2.x relative luminance
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    f = lambda c: c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)

def ratio(a, b):
    hi, lo = sorted((lum(a), lum(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)
# Run over every (foreground, background) pair in the table above, for colors.light and colors.dark.
```

FW-1 should turn this into a test that reads the `tokens` block and fails under 4.5:1 (text) or 3:1 (UI), so a later
token change cannot silently break a pair.

## 2. Status vocabulary (text + shape + colour, never colour alone)

Every state the product names gets a glyph shape, a text label and a colour pair. The shapes are the look sheet's
filled glyphs (`glyph()` in the generator), so a state reads in greyscale and for colour-blind reviewers.

| Thing | State | Glyph | Pill colours (bg / text) | Label |
|---|---|---|---|---|
| Lesson | `draft` | open circle | `well` / `ink2` | Draft |
| Lesson | `in_review` | half-filled circle | `selected` / `primary` | In review |
| Lesson | `changes_requested` | circle with a back arrow | `selected` / `primary` | Changes requested |
| Lesson | `submitted` | filled circle, up arrow | `warn-tint` / `warn` | Submitted |
| Lesson | `approved` | filled circle, check | `success-tint` / `success` | Approved |
| Lesson | `reopened` | circle with a turn arrow | `selected` / `primary` | Reopened |
| Lesson | `exported` | filled square, out arrow | `success-tint` / `success` | Exported |
| Lesson | `generation_failed` | filled triangle, ! | `danger-tint` / `danger` | Failed |
| Tile | `queued` | dashed open circle | `well` / `ink3` | Queued |
| Tile | `planning` · `drafting` · `checking` | half-filled circle | `selected` / `primary` | Planning · Drafting · Checking |
| Tile | `repairing` | half-filled circle + wrench | `warn-tint` / `warn` | Repairing (1 repair) |
| Tile | `ready` | filled circle, check | `success-tint` / `success` | Ready |
| Tile | `failed` | filled triangle, ! | `danger-tint` / `danger` | Failed |
| Run | `planning` · `running` | half-filled circle | `selected` / `primary` | Planning · Running |
| Run | `complete` | filled circle, check | `success-tint` / `success` | Complete |
| Run | `partial` · `capped` · `paused` | filled circle, ! (pause bars for paused) | `warn-tint` / `warn` | Partial · Capped · Paused |
| Run | `cancelled` | filled square | `well` / `ink2` | Cancelled |
| Issue | blocking | octagon, bar | `danger-tint` / `danger` | Blocking |
| Issue | confirmation | octagon, bar | `danger-tint` / `danger` | Confirm (it blocks like a blocking issue, HP-3) |
| Issue | advisory | filled circle, i | `warn-tint` / `warn` | Advisory |
| Issue | resolved | filled circle, check | `success-tint` / `success` | Resolved by <name> |
| Standard origin | `outline` · `outline-fixed` | none (text only) | — / `ink` | from the outline · outline, fixed by <name> |
| Standard origin | `narrowed` · `added` | diamond | `selected` / `primary` | AI-proposed · confirm |
| Validation row | error · warning · OK | octagon · filled circle i · filled circle check | danger · warn · success pairs | Error · Warning · OK |

## 3. Components: anatomy and states

Every interactive component has the full state set (UI-11): default, hover (pointer devices only), `:focus-visible`
(the `focus-ring` token), active, disabled-with-a-reason, loading, error, success. The table cells below give only what
is specific to each component. Components are owned source on Radix primitives where a primitive exists (UI-10).

### Button

| Part | Spec |
|---|---|
| Anatomy | Optional leading icon (16 px, `gap-icon` 6) + label (`body` 600; `small` 600 on `sm`). Heights `sm` 28 · `md` 36 · `lg` 44 (full-width rail actions). `radius-md`. Padding `pad-control-x` |
| Variants | `primary` (`primary` fill, `on-primary` text), `secondary` (`panel` fill, `hair` border, `e-control`), `ghost` (no fill, `primary` text), `danger-ghost` (no fill, `danger` text: Cancel run, Remove standard) |
| Hover | primary: fill mixed 88% with `ink`; secondary: `well` fill; ghost: `selected` fill |
| Active | primary: 80% mix; others: `well` darker by one step; no movement |
| Disabled | `disabled` fill, `ink3` text, a lock icon, **and the reason in text next to it** ("Generate stays off: 5 errors to confirm"). Uses `aria-disabled="true"` (stays focusable) with `aria-describedby` → the reason; a click repeats the reason, never silently nothing |
| Loading | Keeps its width; after `delay-indicator` the leading icon becomes a spinner; `aria-busy="true"`; repeat clicks ignored |
| Rule | One `primary` per view or region (UI-5). In dialogs the primary is last (right) |

### Link

`primary` text; in reading text always underlined; in UI lists 600 weight, underline on hover. Focus ring. External
links (a source URL) show an out-arrow icon and the domain. A link that navigates is an `<a href>`, never a button.

### Text input and textarea

| Part | Spec |
|---|---|
| Anatomy | Label above (`small` 600 `ink`), field (`md` 36 tall, `panel`, `border-control`, `radius-md`, padding 0 12), helper below (`small` `ink2`) |
| Hover | border `ink3` |
| Focus | `focus-ring` plus border `primary` |
| Invalid | border `danger`; message under the field in `danger` with the octagon glyph, saying what, why and the fix ("A quote needs a source: add the book and page"); `aria-invalid`, `aria-describedby`. Validate on blur, then live (UI-11) |
| Disabled / read-only | Disabled: `disabled` fill, `ink3`. Read-only: `well` fill, no border, `ink` text, selectable |
| Counter | The quote field shows "9 of 12 words" for `short-quote-commentary`; over the limit the counter turns `danger` with text "13 of 12 words: shorten it" |

### Select and segmented control

**Select:** a native `<select>` (or Radix Select) styled like the input with a chevron; for lists of more than 6 options.
**Segmented control** (the look sheet's `.seg` / `.segc`): a radio group drawn as a `well` track (`radius-md`, 2–4 px
inner padding) with a `panel` thumb (`radius-sm`, `e1`) on the chosen option. Used for 2–6 visible choices: a
warning's *Apply · Show to reviewer only · Ignore*, an ELD *Keep · Re-map*, the board's state filters. Arrow keys move
the choice; the group has a visible label or `aria-label`.

### Checkbox, radio and radio card

16 px box or circle, `border-strong`, `panel` fill. Checked checkbox: `primary` fill with an `on-primary` check.
Checked radio: 5 px `primary` ring (look sheet). **Radio card** (the draft-quality rating): `well` fill, `radius-lg`,
padding 8 × 12, the whole card is the label (≥ 36 px tall); selected: `selected` fill, `border-selected`, `ink` 600
text. Groups use `<fieldset>` and `<legend>`. A required group shows "(required)" in the legend, not a red star.

### Status pill and badges

| Part | Spec |
|---|---|
| Status pill | Height 22, padding 0 8 0 6, `radius-sm`, `label` text, 12 px glyph + label from the status vocabulary (§2). Read by screen readers as its label only (the glyph is `aria-hidden`) |
| Caps tag | Height 20, `caps` text: issue levels in the rail |
| Count badge | 22 × 22, `radius-sm`, `danger-tint` / `danger`, `label` tabular (validation error numbers) |
| Marker | 20 px circle, `danger` / `on-danger`, sits on a quote slot's corner and matches the issue card's number |
| Version chip | `code` 600, `well`, `radius-xs`: `v3` |
| Code chip | `code`, `well`, `radius-xs`, padding 1 × 6, no wrap: `RL.6.1`, `G6.U4.L4.LearningInAction.PartA` |

### Banner

`radius-lg`, padding 12 × 16, tinted fill, a 32 px icon tile (`radius-md`, solid colour, `on-*` icon), title (`body`
600 `ink`), body (`small` `ink2`), optional action at the right. Variants: `info` (`selected` / tile `primary`),
`warn`, `danger`, `success`. A banner states a fact that stays true while you are on the page ("5 errors to confirm",
"Lesson 4 is waiting on this lesson's excerpt"). The stale-version message ("This lesson changed since you opened it.
Reload.") is a `danger` banner with `role="alert"` and a Reload button; other banners use `role="status"` only when
they appear after load.

### Card and metric tile

**Card:** `panel`, `border-hair`, `radius-xl`, `pad-card`, `e1`; title as a `label` line. **Stat list:** a `dl` with
`hair` rules between rows, numbers in `title` 650 tabular. **Metric tile** (north star): `label` title, the number in
`display`, unit in `title-sm` `ink2`, "median · *n* = 3" in `small` `ink2` at the right; two guard tiles (`well`,
`radius-md`) below; caption in `small` `ink3`. With no approved lesson it shows "No approved lessons yet" and **no
number** (FLOW-16 E1).

### Table

Full width, collapsed borders, no zebra (look sheet). `th`: `label` `ink3`, left aligned, padding 0 12 8, `hair`
bottom. `td`: `body`, padding 12 (`pad-cell-dense` 8 in the validation warnings), `hair` bottom, top-aligned (board
rows: middle). Numbers tabular and centred. A row that opens something: the title cell is the link, and the whole row
shows `well` on hover; the selected row is `selected`. Sortable headers use `aria-sort`. Each table has a caption
(visually hidden if the heading says it). Under `lg` the table scrolls inside its own container; the page never scrolls
sideways.

### Tabs

Used in the evidence rail (*Issues · Standards · Outline row*). Tab: `small` 600 `ink2`; selected: `ink` with a 2 px
`primary` underline that moves in `duration-base`; each tab may carry a count ("Issues 3"). Radix Tabs: roving
tabindex, arrow keys, `role="tablist"`. Board state filters are a segmented control, not tabs.

### Stepper

The look sheet's lesson stepper: `panel`, `border-hair`, `radius-2xl`, padding 8 16 8 12, `e1`. Five steps *Draft →
In review → Submitted → Approved → Exported*. Dot 28 px `radius-full`: done = `success` fill + check; now = `primary`
fill + glyph + 4 px `selected` halo; next = `panel` + `border-strong`. Above each label "Step 2/5" (`micro` `ink3`);
label `small` 600 (next steps `ink2` 500). Connectors 24 × 1.5 `hair`. It is an `<ol>` with `aria-current="step"`, not
interactive. Off-path states keep the step they belong to and show a pill beside the stepper: `changes_requested` and
`reopened` sit on step 2 with their pill; `generation_failed` shows step 1 with a Failed pill. Under `md` it shows only
the current step: "Step 2 of 5 · In review".

### Dialog shell

Native modal `<dialog>` (or Radix Dialog). `overlay` surface, `radius-xl`, `e3`, `scrim` behind. Widths `dialog-sm`
440, `dialog-md` 560, `dialog-lg` 720; under `sm` it is a full-height sheet. Header: optional eyebrow, title (`title`),
an icon-only close button with `aria-label="Close"`. Body padding 24. Errors from the server appear at the top of the
body as a `danger` banner and focus moves to it. Footer: secondary then primary, right-aligned. Focus goes to the first
field on open, is trapped while open and returns to the trigger on close. `Esc` closes unless a request is in flight.
Opens in `duration-slow`, no transform under reduced motion.

### Toast

Bottom-right, 16 px from the edges (bottom-centre on phones), above the footer action bar, never covering a focused
element (SC 2.4.11). `overlay`, `radius-lg`, `e3`, max width 360, padding 12 × 16, a glyph + one sentence + an optional
action ("View", "Undo"). `aria-live="polite"`. Leaves after 6 s, paused on hover or focus. **Never used for anything
that blocks or needs a decision**: those are banners or inline errors. Example: "Quote inserted. Issue 1 resolved."

### Side rail

`<aside>` with an accessible name ("Evidence"), `panel`, `border-hair`, `radius-xl`, padding 12 × 16, `e1`; header
`body` 650 with a `hair` rule under it; scrolls on its own; width `rail` 360 (`rail-narrow` 288 for summaries). Under
`lg` it becomes a right drawer (`z-drawer`, `duration-slow`) opened by an "Evidence (3 blocking)" button in the top bar.

### Page sheet

The lesson as a document. `panel`, `border-hair`, `radius-xl`, `e2` (light only). A toolbar strip on top (`hair`
bottom, `small` `ink2`: paragraph select, B / I / U, list, link, undo, redo). Inside: the reading column (`reading`,
`reading-measure` 68ch, padding 24 × 32).

| Part | Spec |
|---|---|
| Lesson title | `page` heading; meta line below (`small` `ink2`): type · minutes · status pill · version chip |
| Section label | `label` `ink3` with minutes at the right and a `hair` rule under it ("Literacy Lab · 10 min") |
| Routine heading | `title-sm` |
| Say / Ask | bold lead word, then the text in `reading` |
| Sample response | `well` block, `radius-md`, padding 8 × 12, a `label` "Sample response" above |
| Quote slot | `border-slot`, fill `selected` mixed 55% with `panel`, `radius-lg`, padding 16, a quote icon tile, the ask text, rights as a code chip, a primary `sm` button "Insert quote", the marker number |
| Issue anchor | The span an issue points at gets a 2 px underline in the issue's colour (`danger` or `warn`) and its number; never colour fill alone |
| Presence | A co-editor's caret in their `presence-*` colour with a name flag ("M. Okafor"); their initials on the section in the outline |
| Frozen | No toolbar; a `info` banner on top ("Submitted: waiting for approval" with a lock); text stays selectable; no caret |

### Issue card

In the rail. `border-hair`, `radius-lg`, padding 8 × 12, `small` text. Header row: caps tag (Blocking / Confirm /
Advisory), the issue sentence, its number. Under it: the address as a code chip, and where the issue has one, the
action ("Confirm", "Remove", "Resolve…", "Insert quote"). The card itself is a button "Go to issue N" that moves the
editor selection to the anchored span and scrolls it into view (FLOW-7 step 3). Current issue: `selected` fill with
`border-selected`. Resolved: collapses into a "Resolved (2)" group showing "Resolved by A. Chen · <reason> · 10:42".

### Smaller parts

**Avatar:** 26 px circle, `selected` / `primary`, initials in `micro` 650; with a 2 px `panel` + 1.5 px `primary` ring
when the person is editing now. **Toolbar:** icon buttons 28 × 28, each with an accessible name and a tooltip.
**Spinner:** 16 px ring in `primary`, shown only after `delay-indicator`. **Skeleton:** `well` blocks in the final
layout's shape, no shimmer under reduced motion.

## 4. Layout primitives

### App shell (left nav)

A grid of `nav-rail` (60) × `top-bar` (56). **Nav rail** (`panel`, `hair` right border): the product mark (32 px
`primary` tile), then icon buttons 40 × 40 (`radius-md`; current: `selected` / `primary`), a gear at the bottom. Each
icon has a visible tooltip and an accessible name; the current item has `aria-current="page"`. **Top bar** (`panel`,
`hair` bottom, `z-sticky`): breadcrumb at the left, page-level presence or status in the middle-right, the account menu
at the right. **Main:** `ground`, padding `pad-main`, max `content-max`. Under `md` the nav rail becomes a menu button in
the top bar. A skip link "Skip to main content" is the first focusable element.

### Page header with breadcrumb

Breadcrumb in the top bar (`small` `ink3`, current page `ink` 600, chevron separators in `edge`), as
`<nav aria-label="Breadcrumb">` with the current item `aria-current="page"`. In main: an eyebrow (`label` `ink3`:
"Unit board"), the `page` `h1` ("Unit 4 · *The Lightning Thief*"), an optional meta line, and at most one primary
action at the right.

### Two-pane with right rail

Content `minmax(0,1fr)` + `rail` (360) with a 24 px gap (validation report: `rail-narrow` 288). The rail is sticky to
the top of `main`. The **lesson workspace** adds a third column at `xl`: `outline` (160) + page + rail, with the
stepper above the page and a footer action bar under it (`panel`, `radius-xl`, `z-sticky` to the bottom, holding the
heartbeat disclosure, the blocking count and Submit).

| Width | Lesson workspace | Other two-pane screens |
|---|---|---|
| ≥ 1280 | outline · page · rail | content · rail |
| 1024–1279 | page · rail; the outline becomes a "Sections" menu above the page | content · rail |
| 768–1023 | page only; rail is a drawer ("Evidence (3 blocking)") | content, then rail stacked below |
| < 768 | one column; toolbar collapses to a "Format" menu; every action stays available (UI-7 parity), but long editing sessions are not optimised for phones | one column; tables scroll in their own box |

### Page sheet

A centred `panel` sheet on the `ground` desk. Used for the lesson (§3 Page sheet), the validation report body, the
approval review body and read-only history. One `e2` shadow per screen at most: the main sheet.

## 5. Accessibility rules (WCAG 2.2 AA floor, UI-14 and UI-15)

1. **Contrast:** the pairs in *Design tokens* are the only allowed text and UI pairings. A new pairing is computed and
   added before use.
2. **Never colour alone:** every state has a glyph and a word (§2); issue anchors have a numbered underline; presence
   carets carry a name.
3. **Focus:** `:focus-visible` ring 2 px `focus`, offset 2 px, on every focusable element, never removed. Sticky top
   bar and footer bar never hide focus: `scroll-padding-top: 56px` and `scroll-padding-bottom` equal to the footer
   bar's height.
4. **Keyboard:** everything works by keyboard in reading order. Dialogs trap and return focus. The workspace has a
   documented order: top bar → stepper → outline → page → rail → footer. Shortcuts are optional extras, never the only
   way (proposed: `]` / `[` next and previous issue; announced in a "Keyboard shortcuts" dialog).
5. **Disabled with a reason:** a control that is off (Generate, Submit, Approve, Regenerate) uses `aria-disabled`,
   stays focusable and points at its reason with `aria-describedby`.
6. **Landmarks and headings:** `nav` (app), `header` (top bar), `nav` breadcrumb, `main`, `aside` (rail), one `h1` per
   page, ordered headings. Lesson headings inside the editor stay in order (R-58).
7. **Live regions, used sparingly:** save state ("Saving…", "Saved", "Reconnecting: your last edits are not saved
   yet") and changes in the blocking count are `aria-live="polite"`, debounced to one announcement per 2 s. Polling
   screens announce only run-state changes and "Lesson 4 is ready", never every 2 s tick.
8. **Targets:** at least 24 × 24 px with spacing (SC 2.5.8) everywhere; under `(pointer: coarse)` controls are 44 tall.
   No drag-only action (SC 2.5.7): file upload has a "Choose file" button beside the drop zone.
9. **Forms:** real `<label>`s, `fieldset`/`legend` for groups, errors next to the field and wired with
   `aria-describedby`; on a failed submit, focus moves to the first error. Sign-in allows paste and password managers
   (SC 3.3.8).
10. **Outline text is text:** cells from the sheet render as plain text, never HTML (R-58). "`<script>`" shows as
    those characters.
11. **Motion and zoom:** `prefers-reduced-motion` honoured (Motion tokens). Works at 200% zoom and at 320 px wide with no
    page-level horizontal scroll; only tables and code scroll inside their own box.
12. **Time:** no time limits. The review-time heartbeat is invisible and disclosed in text on the workspace and the
    approval review (R-49).
13. **Check:** axe reports no serious violations on the four core screens (R-59 is Stretch, but UX-5a runs axe anyway).

## 6. Where each token came from (look sheet → token)

Source: `build_d1_look.py`, the `LIGHT` / `DARK` dicts and the `CSS` string (selectors named below).

| Token | Look-sheet value (selector) | Changed? |
|---|---|---|
| All colour tokens except the added ones | `LIGHT`, `DARK` dicts, identical hex | **no** |
| `on-danger`, `overlay`, `presence-1…4`, `on-presence`, `scrim`, `focus` | not on the sheet (`.mk` used `--panel` on `--danger`) | **added** (all pairs computed) |
| `type.family.*` | `SANS`, `MONO` constants | no |
| `body` 14 / 1.5 | `.fr` 13.5 / 1.45 | **changed**: 13.5 is off-scale; 14 at the real 1280 width |
| `reading` 16 / 1.6 | `.page p` 14.5 / 1.62 | **changed**: the sheet was drawn in a 1200 × 760 frame; ~3,300-word lessons need 16 px |
| `small` 13 | `.meta`, `.crumb` 13; cells 12.5–12.8 | rounded to 13 |
| `label` 12 | `.label`, `.eyebrow`, `th` 12 | no |
| `caps` 11 | `.tag.cap` 10.5 | **changed** to 11 (legibility floor) |
| `micro` 11 | `.step small` 11, `kbd` 11, `.pres` 9.5 | 9.5 → 11 |
| `title-sm` 17 | `.page h3` 17 | no |
| `title` 20 | none | **added** (dialog titles) |
| `page` 24 | `.fr h2` 22, `.page h2` 23 | **changed** to one size, 24 |
| `stat` 28 / `display` 34 | `.rc b` 28 / `.nbig b` 34 | no |
| `code` 12 | `.cd` 11.5 | **changed** to 12 |
| `space.*` | gaps and padding of 2–30 px | **normalised to a 4 px scale** (UI-6): 22 → 24, 18 → 20 or 16, 14 → 12 or 16, 10–11 → 12, 7 and 9 → 8, 30 → 32, 3 → 4 |
| `radius.md` 8 | `.btn`, `.search` 8; `.nb`, `.tile`, `.logo` 9 | 9 → 8 |
| `radius.xs` 4 | `.cd`, `kbd` 5 | 5 → 4 |
| `radius.sm` 6 | `.tag` 6; `.seg>*` 5, `.segc>*` 7 | 5 and 7 → 6 |
| `radius.lg` 10 | `.banner`, `.ic`, `.slot` 10; `.quality label` 9 | 9 → 10 |
| `radius.xl` 12 / `2xl` 14 | `.sheet`, `.card`, `.ev` 12 / `.stepper` 14 | no |
| `control.height` 28 / 36 / 44 | `.btn.sm` 28 / `.btn` 34 / `.btn.big` 40 | **changed**: 34 → 36 (grid), 40 → 44 (house target size) |
| `border-control` = `edge` | the sheet's search field had no border | **changed**: inputs need a 3:1 boundary (`hair` is 1.26:1) |
| Standard origin "AI-proposed · confirm" pill | `t-adv` amber in the Standards table | **changed** to `selected` / `primary` with a diamond: amber means "never blocks", and HP-3 makes these blocking confirmations |
| `e1`, `e2`, `e3`, `e-control` | `.card`, `.sheet`, `.fr`, `.btn` shadows; none in dark (`.t-dark`) | no |
| `layout.rail` 360 | `.ev` 372, `.m4` rail 352 | **changed** to one width, 360 |
| `layout.outline` 160 | `.m3` column 158 | 158 → 160 |
| `layout.nav-rail` 60, `top-bar` 56, `rail-narrow` 288, `metric-tile` 340 | `.fr` grid, `.m1` 288, `.m2-top` 340 | no |
| icon tile 32, nav item 40, logo 32 | `.tile` 34, `.nb` 38, `.logo` 34 | rounded to the grid |
| Motion, z-index, breakpoints | the sheet is static | **added** |

**No colour hex value changed.** Every colour change in the list above is an addition.

## 7. Open design questions (for Innocent; none blocks the foundation wave)

| ID | Question | Proposal (all decided 2026-10-25 under Innocent, 2026-10-25: 'take your recommendations to all decisions you need me for') |
|---|---|---|
| DQ-1 | The look sheet uses Inter. The workspace rule UI-8 warns against Inter as a default for a new product. Keep it? | Keep Inter: it is what the picked look sheet shows, it renders crisp at 13–16 px, and the mono face carries the codes. Swapping to Geist is a one-token change later — **decided 2026-10-25 (recommendation)** |
| DQ-2 | The look sheet's top bar has "Search ⌘K". No story asks for search | Leave it out of the MVP; the slot stays empty until a story asks for it — **decided 2026-10-25 (recommendation)** |
| DQ-3 | Four presence colours: enough for "20+ colleagues working the same unit"? | Yes for one lesson (rarely more than 2–3 editors at once). A fifth editor reuses colours; names always show — **decided 2026-10-25 (recommendation)** |
| DQ-4 | Dark theme: follow the system setting only, or also a toggle? | System setting plus a toggle in the account menu (`data-theme`) — **decided 2026-10-25 (recommendation)** |