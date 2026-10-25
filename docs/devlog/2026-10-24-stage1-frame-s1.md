# 2026-10-24 — Stage 1 frame

Project: Newsela Lesson Studio · Date: 2026-10-24 (US Central) · Writer: Claude (Opus 5.5), Stage 1
context-upkeep subagent (findings returned by the Stage 1 source, audit, research, direction, framing
and PRD agents) · Host: Mac · Branch: `main`, no commits.

## Sources captured and ranked

- **Changed:** Converted the brief and sample sheet and ranked every source in
  `docs/source/source-register.md` (S-1…S-8, C-1…C-3, D-1…D-5); wrote `02-sample-unit-outline.md`,
  `04-lesson-structure-analysis.md`, `05-standards-referenced.md`, `capture-notes.md` and
  `docs/data/samples/g6-u4-lesson-outline.json`. Full captures (50 lesson records, sheet exports,
  program PDFs) went to the git-ignored `docs/source/restricted/`.
- **Why:** the review site `ca-2026-review.newsela.com` is very likely the state adoption reviewers'
  copy of *Threads & Themes* 6–8, so its text stays local; the 45 published Unit 4 lessons (S-5) are
  the held-out eval set, never few-shot or retrieval input.
- **Checked:** `git check-ignore` matches `docs/source/restricted/`. Lessons are ProseMirror JSON with
  teacher and student editions of objectives and sections (`04` §1–§3). The outline is dirty:
  `RL.6.9.a` does not exist, 7 of 12 ELD labels describe another strand, A1 says U4 while filenames say
  U3 (`02` §5, `05`).
- **Remaining:** S-8 routine and scope PDFs downloaded, not yet read.

## Audit, research, direction, framing, PRD

- **Changed:** Wrote `docs/analysis/audit-parts/` (legal, ethical, engineering) → consolidated
  `docs/analysis/2026-10-24-brief-audit.md` (40 requirements, 16 questions AQ-1…AQ-16, 20 decisions);
  `docs/analysis/company-research/` (4 files) → `2026-10-24-newsela-company-profile.md`;
  `2026-10-24-product-direction.md`; `docs/delivery/2026-10-24-angle-and-demo-framing.md`;
  `docs/prd/newsela-prd.md` Draft v0.1.
- **Why:** the brief asks for a generator, but the bottleneck is review. *Threads & Themes* 6–8 was
  recommended by the CA 2026 adoption panels (reports dated August 2026); the SBE votes Nov 12–13, 2026.
  North star: reviewer minutes per approved lesson (NS), guarded against rubber-stamping, no baseline (AQ-14).
- **Checked:** PRD §6.1 arithmetic: ~49 h wall clock to the Mon 18:00 CT cutoff, ~27 h left for
  building; the §6.3 core is ~30.5 h, so the core alone is slightly over and the cut order (§6.4) applies.
- **Remaining:** Stage 1 review page `docs/artifacts/2026-10-24-newsela-prd.html` (another agent) and
  its check; §1 gate; Innocent's own calls on hosting spend over the $40/mo Render cap, sending the 16
  questions, gate skips (PD-23) and GitLab `origin`.
