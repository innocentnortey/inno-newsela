# UX-2 · Look sheet (one per direction)

> Added 2026-10-20 (Innocent, AEA call center): "what i wish was that you did screenshots or fast light
> mockups before showing me so i can see the colors then you can build the full full protoype".

**What it is, concretely.** One static HTML page per design direction that lets Innocent judge its
colours and feel in under a minute. For example, AEA's A4 sheet showed nine credited Dribbble shots, a
warm-porcelain light palette and its dark twin with computed contrast, and four static mockups: phone
booking (arrival windows), the handoff promise, the gas-safety card and a slice of the staff console.
All four used the real words from the UX-1 flows. Nothing on it was clickable. It took minutes, not
hours.

**Worked example:** `inno-aea-callcenter/docs/artifacts/_build/a4-look/build_a4_look.py`, which writes
`docs/artifacts/2026-10-20-a4-look-sheet.html`.
**Starter generator:** `templates/look_sheet_generator.py` (copy it to
`docs/artifacts/_build/<direction>-look/build_<direction>_look.py` and fill in the four blocks marked
`FILL`).

## Where it goes

| What | Path |
|---|---|
| The page | `docs/artifacts/YYYY-MM-DD-<direction>-look-sheet.html` |
| Its generator | `docs/artifacts/_build/<direction>-look/build_<direction>_look.py` |
| The reference images it embeds | `docs/design/references/` (already captured during Dribbble research) |

## What it contains, top to bottom

1. **A header:** direction name, its one-line intent, status *proposal*, the date, and one sentence
   saying it is a static look; the frontend is built later in the picked direction.
2. **Mockups in light mode (the primary theme):** 3–4 static screens of the **core flows**, drawn
   in the direction's construction (its component anatomy) and filled with the **real flow copy**
   from `USER_FLOWS.md` and synthetic data. Pick the screens that carry the most weight: the main
   task, its hardest state (an error, a handoff, a safety stop) and one staff or desktop view if the
   product has one.
3. **The same in dark:** at least one of those mockups again on the dark palette.
4. **Palette:** swatches for light and dark (ground, panel, inset, selected, ink 1–3, primary,
   danger, and their "on" colours), each with its hex, plus a **contrast table computed from those
   hex values** (text on every surface it sits on, on-primary on primary, on-danger on danger).
5. **References:** the direction's reference shots (Dribbble, Mobbin, Refero…), each with title, designer
   or product, URL and why it is kept, marked *internal reference only*; the feel-brief line each one serves.
6. **Footer:** "local file, not published" and the rebuild command.

## Checks before showing it

- [ ] **Same screens, same copy as the other directions' sheets.** Only the look changes between sheets.
- [ ] **Copy is real:** every visible sentence comes from the flows (or is synthetic data); no lorem ipsum.
- [ ] **Contrast is computed:** body text pairs ≥ 4.5:1, large text and UI parts ≥ 3:1; the generator
      prints the lowest pair per mode, and a FAIL is fixed or called out on the page.
- [ ] **Light first, dark present.**
- [ ] **Static:** no shared JS engine, no click handlers. If it needs them, it has become a prototype.
- [ ] **Opens offline:** images embedded (data URIs), fonts with a system fallback, a complete `<!doctype html>` document.
- [ ] **At-a-glance values** (softness, density, shape, temperature, type) written in
      `DESIGN-DIRECTIONS.md`, and the sheets compared side by side at thumbnail size
      (`references/phases.md` → *At-a-glance check*).
- [ ] **House-texture check** passed for this direction.

## What it is not

- Not the UX-2 gate review page. The gate page shows every sheet side by side and doesn't need to
  repeat their content.
- Not linked screens (optional, after a shortlist) and not a prototype. Since pilot v2 (2026-10-25) no full
  prototype is built at UX-2; the frontend is built in §8.
- Not `design.md`. The palette is a proposal; UX-3b makes it exact as design tokens.
