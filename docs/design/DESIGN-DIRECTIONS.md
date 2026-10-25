# Design directions — Newsela Lesson Studio (UX-2)

**Owner of:** the four candidate visual directions, their component construction, at-a-glance values, palettes, and
(once he chooses) Innocent's shortlist and pick. **Written:** 2026-10-25 by Claude. **Status:** proposal; nothing is
picked. Built from the [feel brief](../ux/02-concepts/FEEL_BRIEF.md) (calm, editorial, expert, warm, accountable) and
a Dribbble sweep of 16 feel-and-pattern searches, 371 unique shots, none using the words "education", "lesson" or
"school" ([search record](../ux/02-concepts/references/dribbble-search-2026-10-25.json)). Reference images are in
[`references/`](references/) with credits in `references/_index.json`; they are other designers' work, kept as
internal reference only.

**Why four, and why these four.** Innocent asked for four options (2026-10-25). Each direction answers the feel brief
a different way, and the four differ at a glance: light vs dark, soft vs hard, airy vs dense, cool vs warm.

| | D1 · Clear Ledger | D2 · Night Desk | D3 · Soft Studio | D4 · Warm Workroom |
|---|---|---|---|---|
| **The idea** | The lesson is a document on a desk; the tool is a quiet editor's frame around it | A focused workbench for experts who live in it all day | A friendly team space that makes review feel shared | A well-run workshop: the numbers and the trail are always visible |
| **Feel-brief lines it leans on** | editorial, calm, evidence visible | expert, dense where scanning, calm | warm, calm, shared | accountable, warm, dense where scanning |
| **Analogous source** | Contract review and document editors with a changes rail | Calm issue trackers and AI code review | Collaborative team inboxes and doc dashboards | Data-import cleanup and multi-step approval tools |

## At-a-glance check

| Trait | D1 | D2 | D3 | D4 |
|---|---|---|---|---|
| **Softness** | medium: 8 px radius, hairline borders, one soft page shadow | hard: 6 px radius, hairlines, no shadow | very soft: 16–20 px radius, soft shadows, full pills | firm: 6 px radius, ruled tables, no shadow |
| **Density** | airy: generous margins, reading width ~70 ch | dense: 32 px rows, grouped lists | airy: big cards, open spacing | dense: 36 px table rows, compact stat tiles |
| **Shape language** | page sheet, top stepper, right rail | rows, groups, tabs, mono IDs | cards, pills, three panes | tables, banded headers, vertical timeline, dark sidebar |
| **Palette temperature** | cool neutral white + ink blue | cool graphite (dark-first) + signal green | cool pastel periwinkle + indigo | warm: white canvas, walnut sidebar, terracotta |
| **Type** | crisp grotesk, large calm headings | grotesk + monospace numbers and IDs | rounded sans | grotesk with tabular numbers |

**Thumbnail test** (to repeat on the four look sheets side by side): no two directions share both theme and
temperature; D1 and D3 are both light and cool, so they must separate on softness, shape and tint, which they do
(white and sharp-ish vs periwinkle and very soft).

## Component anatomy (each row cites its reference)

### D1 · Clear Ledger
| Part | Construction | From |
|---|---|---|
| Canvas | Light grey desk, white page sheet centred for the lesson | `d1-02`, `d1-04` |
| Navigation and state | Breadcrumb + a horizontal **status stepper** (Draft → In review → Submitted → Approved → Exported) with coloured step dots | `d1-01`, `d1-03` |
| Alerts | Tinted banner with an icon tile ("Pending signatures" style) for blocking issues | `d1-01` |
| Evidence pane | Right rail titled like "Changes and suggestions": tabbed (Issues · Standards · Suggestions), cards tagged ADDED / REMOVED | `d1-04` |
| AI suggestion | A card with the rewrite, "Replace" / "Insert" and a change toggle | `d1-05` |
| Comments | Threaded comments with an unresolved count | `d1-06` |
| Tables | Light rules, no zebra, generous row height | `d1-03` |

### D2 · Night Desk
| Part | Construction | From |
|---|---|---|
| Canvas | Graphite ground, slightly lighter panels, hairline borders | `d2-01`, `d2-05` |
| Navigation | Narrow icon rail + collapsible sidebar with counts | `d2-01`, `d2-02` |
| Lists | Grouped rows (In review · Ready · Failed · Approved) with status glyph circles and mono IDs (`L4`, `L5`) | `d2-01` |
| Lesson tabs | "Lesson · Evidence · Preview · Trace" tabs, a changed-sections list with issue counts | `d2-02` |
| AI suggestion | Diff-style card: removed in red, added in green, Insert / Replace | `d2-02`, `d2-03` |
| Reading | Long-form text in a dark reading column | `d2-04` |
| Tables | Status pills (Completed / Processing style) in a dense report table | `d2-05` |

### D3 · Soft Studio
| Part | Construction | From |
|---|---|---|
| Canvas | Periwinkle wash with white floating panels | `d3-02`, `d3-03` |
| Layout | Three panes: list, item, detail (inbox shape) | `d3-01`, `d3-06` |
| Greeting | "Good morning, Priya — 9 lessons waiting for you" header | `d3-02`, `d3-03` |
| Approval | A checklist card "2 of 3 approved" with soft status pills | `d3-01` |
| Cards | Document cards with a thumbnail and owner avatars | `d3-02` |
| Comments | Composer with a floating format bar; friendly empty state | `d3-04` |
| Stats | Soft tinted stat tiles | `d3-05` |

### D4 · Warm Workroom
| Part | Construction | From |
|---|---|---|
| Canvas | White work area beside a walnut sidebar | `d4-04` |
| Import report | Row-level error table: error rows tinted, an icon in the first column, banners stating counts ("3 formatting errors") | `d4-01` |
| Progress | File card with a progress bar and four stat tiles (added, updated, success, warning) | `d4-02` |
| Approval | Horizontal step header plus a vertical approval history timeline; Approve / Request changes as radio choices | `d4-03` |
| Tables | Walnut banded header row, tabular numbers | `d4-04` |
| Lists | Dense inbox rows with coloured category tags | `d4-05` |

## Palettes (proposals; computed contrast on each look sheet)

| Token | D1 light | D1 dark | D2 dark (primary) | D2 light | D3 light | D3 dark | D4 light | D4 dark |
|---|---|---|---|---|---|---|---|---|
| ground | `#F4F5F7` | `#0F1115` | `#0E0F11` | `#FAFAFA` | `#EEF0FB` | `#14152A` | `#FFFFFF` | `#1A1714` |
| panel | `#FFFFFF` | `#171A20` | `#17181B` | `#FFFFFF` | `#FFFFFF` | `#1D1F38` | `#FFFFFF` | `#221E1A` |
| well | `#F1F3F6` | `#1E222A` | `#1F2024` | `#F2F2F4` | `#F5F6FD` | `#262947` | `#F3F1EE` | `#2B2621` |
| ink | `#14171C` | `#ECEEF2` | `#EDEDEF` | `#111113` | `#1C1D35` | `#EEEEFB` | `#231F1C` | `#F1ECE6` |
| ink2 | `#4A5260` | `#A9B0BC` | `#A1A1AA` | `#55555E` | `#535675` | `#B4B6D6` | `#5E5650` | `#BDB3A8` |
| primary | `#1F4FD8` | `#8AA9FF` | `#3DD68C` | `#12804F` | `#4B48D6` | `#A5A8FF` | `#B4410F` | `#F08A5D` |
| sidebar | — | — | — | — | — | — | `#4A332B` | `#2A1E19` |

## House-texture check (cream canvas, serif headings, outlined pills, sage accents)

| | Cream canvas | Serif headings | Outlined pills | Sage | Pass |
|---|---|---|---|---|---|
| D1 | no (cool grey desk, white page) | no | no (filled dots, tinted tags) | no | ✓ |
| D2 | no (graphite) | no | no (filled glyphs) | no | ✓ |
| D3 | no (periwinkle) | no | no (filled soft pills) | no | ✓ |
| D4 | no (white canvas; warmth from the walnut sidebar and terracotta) | no | no (filled tags) | no | ✓ |

## Shortlist and pick

**Picked: D1 · Clear Ledger** — Innocent, 2026-10-25: "All right, we're going to go with the clear ledger direction"
and "We've finished UX2, and I'm choosing **D1 Clear Ledger**." He picked from the look sheets; no shortlist and no
linked-screen prototypes were needed. Status: **decision**. UX-3 makes the D1 palette and construction exact in
[`design.md`](design.md).
