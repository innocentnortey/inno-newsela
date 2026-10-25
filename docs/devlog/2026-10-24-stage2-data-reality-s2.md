# 2026-10-24 — Stage 2 data reality

Project: Newsela Lesson Studio · Date: 2026-10-24 (US Central) · Writer: Claude (Opus 5.5), one session,
run under Innocent's goal "continue with Newsela zero-to-hero stage 2 … i am just going to take your
recommendations" · Host: Mac · Branch: `main`, no commits.

## Samples and selection matrix

- **Changed:** Added `docs/data/scripts/build_samples.py` and its outputs in `docs/data/samples/`: 14 issued
  samples (DS-1…DS-14, 17 sheet rows) and 3 synthetic (SYN-1 injection, SYN-2 layout drift, SYN-3 clean
  control). Wrote `docs/data/README.md` (sample set, types × edge-case matrix, synthetic assumptions, gaps).
- **Why:** pick rows on purpose: every sheet lesson type and every defect kind in `02` §5 / `05`.
- **Checked:** two runs gave byte-identical files (`diff -r`). The script reads only tracked files.
- **Remaining:** none for §2.

## Worked pairs and the flex-day finding

- **Changed:** `docs/data/worked-pairs.md` WP-1…WP-5 (rows 8, 9, 25, 39; SYN-3), each traced through
  intake → generation → review; uncertain items numbered U1–U10. PRD §13 now says WP-3 is hard/uncertain.
- **Why:** a structure-only count of the held-out Unit 4 flex days (L21, L38, L44) shows 3 focus standards
  each; the sheet's six flex rows have none, so R-19's "no code outside the row's lists" needs a rule (U7).
- **Checked:** every code and quote in the pairs traced to the sheet, `05` or `04`; no novel text quoted;
  held-out codes not used to derive any output.
- **Remaining:** Innocent to check U1–U10 (recommendations stand under his advance sign-off).

## Review page and gate

- **Changed:** `docs/artifacts/2026-10-24-data-reality.html`; checklist §2 rows and gate ticked; router,
  ICM row and resume note updated.
- **Checked:** `check_review_page.py` 0 fail / 0 warning. Browser: 1280px light, 400px dark, no page-level
  horizontal scroll; headless print to PDF (matrix needed a print rule, added). Not inspected: 1280px dark
  and 400px light separately.
- **Remaining:** §3 hard-problem register and page, fed by the pairs' *Joins* lines.
