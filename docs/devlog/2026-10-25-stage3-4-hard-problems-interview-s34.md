# 2026-10-25 — Stage 3 hard problems and Stage 4 interview

Project: Newsela Lesson Studio · Date: 2026-10-25 (US Central) · Writer: Claude (Opus 5.5), orchestrating; workers
returned their notes here · Host: Mac · Branch: `main`, no commits. Basis: Innocent's goal "finish stage 3 and 4 dont
ask for my input ill follow your recommendations, use sub agents as needed".

## Hard-problem register

- **Changed:** `docs/design/hard-problems.md`: four general-purpose subagents drafted HP-1…HP-9 from one brief, a fifth
  walked `docs/principles/system-design.md` (41 questions, 16 answered, 25 routed) and drafted *Handled by default*.
  I merged them, added HP-10 (teaching quality) and the HP-4 / HP-5 addenda from the walk's gaps, and set every status.
  WP-1's `L.6.4.b` row became a blocking confirmation (HP-3); the Stage 2 page was rebuilt for it.
- **Why:** cards found real defects in the PRD: R-16's "no job billed twice" can't hold literally; a pre-call spend
  check overshoots under concurrency; the 12-word quote rule misses every short invented quote.
- **Checked:** every hard pair and U1–U10 map to a card; card IDs grepped by the drafters.
- **Remaining:** SP-1…SP-3 at §5.

## Interview and PRD v1.0

- **Changed:** `docs/prd/interview.md` (23 questions; a sixth subagent swept all 60 readiness items); PRD v1.0: §5.4
  amendments, R-60, PD-4–PD-7, PD-13–PD-15, PD-23–PD-25 updated, PD-26–PD-30 added, §9, §12, §13.
- **Why:** Innocent's instruction answers the quick facts: $0 hosting (local recording), $75 model ceiling, questions
  not sent, no gate skipped, the §6 foundation answers from PRD §13.
- **Checked:** `interview.py check --complete`: completion gate holds (60/60; 52 answered, 7 assumed, 1 n/a).
- **Remaining:** the Stage 1 page now shows PRD v0.1 and is marked historical in the router; GitLab `origin` is
  Innocent's action.
