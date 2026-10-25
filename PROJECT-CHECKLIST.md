# Project Checklist — Newsela Lesson Studio

Sequence: `zero-to-hero` **v2.0.0** (`Nortorious-Technologies/.claude/skills/zero-to-hero/`); migrated 2026-10-25 from the
1.13.0 checklist (backup of the old file kept outside the repo). §0–§4 are unchanged; §4b onward follows the 2.0.0 template.
Artifact paths: that skill's `ARTIFACT-MAP.md` (§ numbers below match).

| Field | Value |
|---|---|
| Project | Newsela Lesson Studio (working name). Brief title: *Lesson Content Generation and Editing/Approval Workflow* (Newsela, v1, last updated 2026-10-19) |
| Kind | hiring partner (Newsela, via Gauntlet AI) |
| Mode | light |
| Started | 2026-10-24 |
| Deadline / internal cutoff | Tue 2026-10-27 03:00 CT ("Monday night at 3 am", Innocent 2026-10-24; read as the end of Monday night, if he meant early Monday 2026-10-26 03:00 the runway is a day shorter) / Mon 2026-10-26 18:00 CT (proposed: leaves 9 h for video, docs and submit) |
| Layout substitutions | company and market research → `docs/analysis/company-research/` (plus the profile `docs/analysis/2026-10-24-newsela-company-profile.md`) |
| Context system | [ICM progress checklist](.claude/state/icm-progress.md) — tracks `.claude/` maturity; its rows are not copied here |

**How to use.** Tick an item when its artifact exists at the mapped path. A gate line is passed
only with evidence, and a ★ gate only with `Innocent ✓ YYYY-MM-DD`. Up to the fork, the first
unticked gate is where the project is. After it there is one current gate per marked track (headings
ending **— UX track**, **— Joint track** and **— System track**). §7 readiness is **per ticket**, not
"both tracks closed": run `python3 scripts/ticket_readiness.py check <ticket.json> --root <repo>` from the
`zero-to-hero` skill before a ticket starts; it names each missing condition.
A stage skipped goes under *Skips* with its reason.

**Ownership after the fork (two sessions):** the UX session ticks the UX-track rows; the System session
ticks the §5–§6 rows. The contract files in `docs/contracts/` (`INTERFACE.md`, `interface.openapi.yaml`,
`CHANGES.md`) are **jointly owned**: the UX side owns the needs, the System side owns the support, both
review every card, and Innocent decides product behaviour. Either session ticks a Joint-track row once both
reviews are recorded. An agreed card changes only through the change procedure (`CHG-N`).

---

## 0 · Scaffold  (§0)
- [x] `PROJECT-CHECKLIST.md` (this file) filled in
- [x] `CLAUDE.md` entry point (no `AGENTS.md`: Codex not working this repo yet)
- [x] Principles pack, both halves (17 files in `docs/principles/`; 18 rules in `.claude/rules/`, legacy set not copied: not OpenEMR): `Gauntlet AI/principles/` → `docs/principles/` (incl. `system-design.md`), and rules → `.claude/rules/` with a provenance line each: general (incl. `system-design-conversation`, `system-design-questioning`, `problem-framing`, `business-metrics`) · Gauntlet policy · hiring partner · legacy (OpenEMR only)
- [x] Context system bootstrapped by **invoking** `icm-project` (v1.5.0, 2026-10-24) (Phases 1 and 3; version recorded in `icm-progress.md`): `CLAUDE.md` from its entry template, `.claude/README.md` router, `rules/context-maintenance.md`, dev-log home, `.claude/state/icm-progress.md`; `CLAUDE.md` and the router both link the ICM checklist
- [ ] Remote and host set per policy (Gauntlet: GitLab `origin`, Render): host recorded as **Render** (Gauntlet default; the brief allows AWS or a lighter host). GitLab `origin` `git@labs.gauntletai.com:innocentnortey/inno-newsela.git` **not created yet**: Innocent creates it; then add the remote
- [x] `SUBMISSION.md` opened (Gauntlet)
- **Gate:** ☑ pack present, checklist filled, `icm-progress.md` exists and is linked from `CLAUDE.md`, `check_context.py` reports no FAIL — Claude ✓ 2026-10-24 (`check_context.py`: "ok all"). Open: GitLab `origin` (row above; Innocent creates it)

## 1 · Frame  (§1)
- [x] Sources converted and ranked in `docs/source/` — `docs/source/source-register.md` (S-1…S-8, C-1…C-3, D-1…D-5), `01`/`02`/`04`/`05`, `capture-notes.md`; sheet rows `docs/data/samples/g6-u4-lesson-outline.json`; full captures in git-ignored `docs/source/restricted/`
- [x] Brief audit: traps, real problem, real guideline — `docs/analysis/2026-10-24-brief-audit.md` (from `docs/analysis/audit-parts/` legal, ethical, engineering)
- [x] Problem behind the brief: why-chain, assumptions marked, each metric's hop chain to money, north star named (GP-120 – GP-130) — brief audit §1–§4, §7; north star NS = reviewer minutes per approved lesson
- [x] Metrics chosen: health vs value groups, leading + lagging pair per branch, decision line / denominator / baseline / aspiration / hard gate per metric (GP-131 – GP-144) — `docs/delivery/2026-10-24-angle-and-demo-framing.md` §3; PRD §4
- [x] Two-layer success framing + metrics tree — `docs/delivery/2026-10-24-angle-and-demo-framing.md` §1–§3 (context: `docs/analysis/2026-10-24-newsela-company-profile.md`, `docs/analysis/company-research/`, `docs/analysis/2026-10-24-product-direction.md`)
- [x] PRD draft — `docs/prd/newsela-prd.md` (Draft v0.1, 2026-10-24)
- [x] Stage 1 **visual** review page — `docs/artifacts/2026-10-24-newsela-prd.html`: `check_review_page.py` 0 fail / 0 warning (6 SVG, 123 status items), claim-to-source pass done; inspected 1280px + 500px (and a 400px iframe), light + dark, print; linked from `.claude/README.md` (2026-10-24)
- **Gate:** ☑ audit + framing signed off — Innocent ✓ 2026-10-24, given in advance: "I'm trusting you, and I will take whatever your recommendations are … make sure that you finish the stage" (and "if you have any questions, just do the recommended option"). He has not yet read the page; anything he raises on it reopens §1. Not covered by this sign-off: the PRD (approved at §4), the Render spend over the $40/month cap, sending the questions to Newsela, any gate skip.

## 2 · Data reality ★  (§2)
- [x] Samples in `docs/data/samples/` (full 20–50 · light ~10) — 14 issued (DS-1…DS-14, 17 sheet rows) + 3 synthetic (SYN-1…3), built by `docs/data/scripts/build_samples.py` (byte-identical on re-run, 2026-10-24)
- [x] Selection matrix: every source, every type, the strange ones — `docs/data/README.md` (every sheet lesson type sampled; edge cases from `02` §5 and `05`)
- [x] Worked pairs `WP-1…` in `docs/data/worked-pairs.md` (full 5–10 · light 3), each marked easy/hard and sure/uncertain — WP-1…WP-5 (4 hard/uncertain, 1 easy/sure control); uncertain items U1–U10
- [x] Synthetic stand-ins labelled with their assumption — SYN-1 injection, SYN-2 layout drift, SYN-3 clean control (`docs/data/README.md`, *Synthetic stand-ins*)
- [x] Stage 2 **visual** review page — `docs/artifacts/2026-10-24-data-reality.html`: `check_review_page.py` 0 fail / 0 warning (3 SVG, 54 status items, 10 `data-ask` items); inspected 1280px light and 400px dark (no page-level horizontal scroll), print via headless PDF (matrix print rule added); linked from `.claude/README.md` (2026-10-24)
- **Gate:** ☑ every core workflow has pairs (intake WP-1…5; generation and review WP-1…4) — Innocent ✓ 2026-10-24, given in advance: "you will not be getting any input from me as i am just going to take your recommendations" (goal set for this session). The recommended answer to each uncertain item U1–U10 stands under that; **he has not checked them yet**, and anything he raises on the page reopens §2. Not covered: PRD approval (§4), §3 hard-problem choices, the R-19 rule change WP-3 implies (decided at §4).

## 3 · Hard problems ★  (§3)
- [x] Register `docs/design/hard-problems.md`: HP-1 orchestration + one card per hard problem + *Handled by default* list — HP-1…HP-10 (HP-9 content safety and HP-10 teaching quality added from Stage 2 and the system-design walk), 15 handled-by-default lines, 3 spikes (SP-1…SP-3) (2026-10-25)
- [x] Every `hard` worked pair maps to a card — WP-1 → HP-1/2/3/6; WP-2 → HP-2/3/6; WP-3 → HP-3/6; WP-4 → HP-9/5/2; U1–U10 all closed (register *Index*)
- [x] Each card: evidence pairs, why hard, options with diagrams, recommendation, principles, success measure — text-flow diagrams in the register, SVG on the page
- [x] `docs/principles/system-design.md` questions walked; open ones are cards or interview options — 41 questions: 16 answered, 25 routed (register Appendix A); 3 gaps → HP-10 and the HP-4 / HP-5 addenda
- [x] Stage 3 **visual** review page — `docs/artifacts/2026-10-25-hard-problems.html` (built by a subagent from the register and worked pairs): `check_review_page.py` 0 fail / 0 warning (11 SVG, 54 status items, 10 `data-hp` cards with all three parts in order); inspected 1280px and 500px light + dark (subagent, headless), 400px light (Chrome DevTools, no page-level horizontal scroll), print via headless PDF; claim-to-source pass done; linked from `.claude/README.md` (2026-10-25)
- **Gate:** ☑ HP-1 has a card; every hard pair maps to a card; check passes — Innocent ✓ 2026-10-25, given in advance: "finish stage 3 and 4 dont ask for my input ill follow your recommendations, use sub agents as needed". Every card's recommendation is recorded as chosen on that basis. **He has not worked through the page yet**; anything he raises reopens that card (and its PRD rows).

## 4 · Interview ★  (§4)
- [x] `prd-interview` run *after* §3, fed the register (page choices recorded, not re-asked) — followed by hand (the skill is user-invoked): `docs/prd/interview.md`, 23 questions (13 carried from the register, 10 answered in batch 1), 60/60 checklist items closed; `interview.py check --complete`: "completion gate holds" (2026-10-25)
- [x] Every HP choice in the decision record — PRD §10 PD-4–PD-7, PD-13, PD-14 updated; new PD-26–PD-30; requirement changes in PRD §5.4; new R-60
- **Gate:** ☑ PRD approved — Innocent ✓ 2026-10-25, given in advance: "finish stage 3 and 4 dont ask for my input ill follow your recommendations, use sub agents as needed". PRD v1.0 (`docs/prd/newsela-prd.md` header; interview Q-023). He has not read v1.0 yet; anything he raises reopens the affected row. Covered by the same instruction: hosting spend (option D, $0), the $75 build model ceiling (PD-29), questions not sent (PD-24), no gate skipped (PD-23), and the five §6 foundation answers (interview Q-002, Q-003, Q-006–Q-008). **Not covered:** creating the GitLab `origin` (his action).

## 4b · UX-1 (fork)  (§4b) — starts once the PRD is approved; Claude closes the gate (no sign-off)
*Via the `ux-pipeline` (UX-1); projects outside it use `ARTIFACT-MAP.md` §4b's list.*
- [x] User stories `US-1…` (`docs/ux/01-planning/USER_STORIES.md`): As a <who> I need <what> so that <why>; each links its PRD requirement, WP-N and screen; every core flow covered — 37 stories over 44 in-scope requirements (2026-10-25)
- [x] Flows (`USER_FLOWS.md`) with each step's **states, permissions and recovery paths**, and a draft `CON-N` on every data step; sitemap (`SITEMAP.md`); `trace_check --upto FLOW` passes — 19 flows (every required error branch, states and roles per step), 21 screens, 24 draft CONs; `trace_check --upto FLOW`: 0 fail(s)
- [x] Unresolved behaviour questions listed where they can be seen (`UXP-N`), each routed to the UX-3a card it affects — UXP-1…UXP-10 + GAP-2 in `USER_FLOWS.md`, routed in `docs/contracts/INTERFACE.md` → *Behaviour questions*; all decided 2026-10-25 under Innocent's delegation (PD-31)
- [x] UX-1 review page built (journeys, flows, sitemap as diagrams + the CON list + the open UXP list); `check_review_page.py` passes; path given to Innocent — `docs/artifacts/2026-10-25-ux-1-planning.html`: 0 fail / 0 warning
- **Gate:** ☑ UX-1 checks pass — Claude ✓ 2026-10-25 (no sign-off: Innocent, 2026-10-20; he reads the page when he chooses, and anything he raises reopens UX-1)

> **▶ FORK — open a second session for the System track now (§5 spikes → §6 design).**
> Launch it on the same machine or VPS as this project's working copy, on the same model as this session
> (`~/.claude/rules/match-model-on-vps.md`). It reads first: the PRD, `docs/ux/01-planning/USER_STORIES.md`,
> the flows with their states and draft CONs in `USER_FLOWS.md`, the open `UXP-N` list,
> `docs/design/hard-problems.md`, `docs/data/worked-pairs.md`. Its first gate is §5's.
> The Joint track (UX-3a) starts now too. This session continues with UX-2.

## UX-2 · Visual direction ★  (§4b) — UX track
- [x] Feel brief `docs/ux/02-concepts/FEEL_BRIEF.md` (feel, interaction shape, analogous products; style searches never use the industry name) — 2026-10-25
- [x] Reference research with live-captured images and a reference → product mapping table — 16 Dribbble searches, 371 shots, 24 credited references (`docs/ux/02-concepts/REFERENCES.md`, `docs/design/references/`)
- [x] A look sheet for each of **4 directions** that differ at a glance (credited references, light + dark swatches with computed contrast, 3–4 static mockups on real flow copy) — `docs/artifacts/2026-10-25-d{1..4}-*-look-sheet.html`; shortlist page `docs/artifacts/2026-10-25-ux-2-directions.html` (check 0/0)
- [x] Representative screens in the picked direction (lightweight linked screens only if they help the choice; never a full application) — the D1 look sheet's four screens (M1–M4) plus M3 dark; no linked screens needed (picked from the sheets)
- **Gate:** ☑ direction picked: **D1 Clear Ledger** ("All right, we're going to go with the clear ledger direction") — Innocent ✓ 2026-10-25

## UX-3a · Shared contracts ★  (§4b) — Joint track
- [x] `docs/contracts/INTERFACE.md`: one `CON-N` card per data step, each with operations, fields, states, permissions, named errors, recovery, guarantees, timing, the screens and stories that need it, the backend owner, and a status (`draft` → `proposed` → `agreed`, or `changing`) — CON-1…CON-24, all `proposed` (2026-10-25)
- [ ] `docs/contracts/interface.openapi.yaml`: the same promises in machine form; each operation names its `CON-N`; lints; the Prism mock starts from it; types are generated from it — draft 0.1.0, 35 operations (CON-12 as `x-collaboration-channel`), `redocly lint` clean; Prism start and type generation not yet run; UXQ follow-ups (UXQ-2, 5, 7, 8, 9, 11) not yet in it
- [x] `docs/contracts/CHANGES.md` opened; every change to an agreed card is a `CHG-N` with its aspect and presentation-only/behavioural, even when the OpenAPI file is unchanged — 0 CHG so far
- [ ] Each card reviewed by both sides (UX needs, System support), each review named and dated; every `UXP-N` and product-behaviour question in it decided by Innocent — UX review done on all 24 (Claude, UX session, 2026-10-25); every UXP/UXQ decided 2026-10-25 (delegated, PD-31); **System review pending on all 24: the System track has not started**
- [x] Older layout only: `docs/ux/03-structure/UI_CONTRACTS.md` is a pointer to `docs/contracts/` (or migrated) — n/a: Newsela never had `UI_CONTRACTS.md`; contracts went from the UX-1 draft table straight to `docs/contracts/`
- [ ] `trace_check --upto CON` passes for the agreed cards
- **Gate:** ☐ every card that something relies on is `agreed` (both reviews recorded; product behaviour decided) — Innocent ✓ ____ (repeat per card set; cards still `draft` or `proposed` listed: ____)

## UX-3b · Screens and tokens ★  (§4b) — UX track
- [x] IA `docs/ux/03-structure/IA.md` — 2026-10-25
- [x] Screen specs `SCR-N` with every state (`docs/ux/03-structure/SCREEN_SPECS.md`); each names the `CON-N` it uses — all 21 screens; UXQ-1…UXQ-11 decided 2026-10-25
- [x] `docs/design/design.md` (UI-2 template) in the chosen direction, with the design tokens — Clear Ledger; 59 contrast pairs per theme computed, all pass; DQ-1…DQ-4 decided 2026-10-25
- **Gate:** ☑ screen specs signed for wave **1** (SCR-1, SCR-4, SCR-5, SCR-8, SCR-9, SCR-10, SCR-11, SCR-14, SCR-15) — Innocent ✓ 2026-10-25, delegated: "take your recommendations to all decisions you need me for" (he has not read them; anything he raises reopens the screen). Later waves: ____

## FW · Early frontend foundation wave  (§4b) — UX track
- [x] Preconditions: UX-2 direction picked and `design.md` tokens written (the §6 gate is **not** needed: presentation only)
- [x] Readiness record `docs/plans/foundation-wave.md`: stack and the decision it comes from, owned files, bounded scope, dependencies, one ticket spec per ticket, review requirements (code review, accessibility, visual check against the look sheet and `design.md`) — FW-1…FW-4, PE-1…PE-11 (2026-10-25)
- [x] Scope only from the eligible list (tokens, typography, basic accessible components, layout primitives); nothing behaviour-dependent (permissions, autosave, resumability, booking or job state, data fetching, backend error recovery, real-time collaboration)
- [x] Each FW ticket's acceptance examples are presentation examples (`PE-N`), not invented backend pairs
- [ ] Each FW ticket passes `ticket_readiness.py` before it starts; built and reviewed like any §8 ticket (lane, plan → implement → test → review, affected tests)
- **Gate:** ☐ FW tickets merged with their review evidence — Claude ✓ ____

## 5 · Spikes  (§5) — System track
*2026-10-25: no System-track session has started (checked with `ListAgents`; no `docs/analysis/spikes/`). SP-1…SP-3 are defined in `docs/design/hard-problems.md`.*
- [ ] `SP-N` record for every card not yet `chosen`: brief + pass line first, frozen scoring harness, options built **in parallel by fan-out agents**, harness re-run by the orchestrator on each branch (`references/spikes.md`)
- [ ] Innocent has read each SP result
- [ ] Any spike result that changes what a screen needs or what the backend can promise logged as a `CHG-N` and run through the change procedure
- **Gate:** ☐ no HP card is `open`

## 6 · Design  (§6) — System track
- [ ] **Foundation questions answered by Innocent before DO-1** (`.claude/rules/system-design-questioning.md`): SD-3.1 load target + scale path, SD-3.4 peak/concurrency, SD-7.2 failure to survive, SD-1.6 spend ceiling, SD-1.9 hardest uncertainty. Each recorded with date and his words in the readiness report and the PRD decision table; none filled by a test load, default or public count
- [ ] `system-design-readiness` READY
- [ ] DO-1…DO-7 written at their mapped locations; DO-4 links every internal contract to the `CON-N` it serves in `docs/contracts/INTERFACE.md`, adds internal signatures only, and never repeats or contradicts a card's promise
- [ ] Code design recorded: `.claude/reference/area-map.md` with planned paths labelled planned; router rows added; ICM "code design" row updated with evidence
- [ ] Entry rebuilt: `icm-project` Phase 3 re-run so `CLAUDE.md` and the router follow the entry template against the area map; fresh-context walkthrough done and its ICM row verified; `check_context.py` reports no FAIL
- [ ] DO-3 code design to `code-design-solid-modularity`: each module's one-sentence job, interface and dependency direction; each seam cut or deferred with why
- [ ] `metz-code-design-agent` review `docs/design/reviews/YYYY-MM-DD-code-design-review.md` — verdict PASS (Blocking findings fixed or put to Innocent)
- [ ] DO-5 eval plan: worked pairs as the first dev set, HP success measures as criteria, error-analysis-first rule
- [ ] Stage 6 visual review page `docs/artifacts/YYYY-MM-DD-system-design.html`: a story-first study guide with every DO-1/DO-2 finding (`check_review_page.py` passes; inspected at laptop and phone width)
- [ ] Questions raised while designing: each new choice is an `SDQ-N` (asked, or drawn as a labelled proposal with a `data-ask` card); any answer the numbers undercut was put back to Innocent, not changed silently; pre-gate sweep leaves no foundation item proposed or defaulted
- [ ] Signature completeness: every cross-area call in DO-3's build-areas table has a DO-4 signature with field-level result types; every service and adapter has its constructor; every OpenAPI error code maps to a DO-4 error type; every DO-6 record has a storage location; every typed settings field consumers need is named
- [ ] Signature check run: `signature_check.py --code-design … --contracts … --observability … --openapi docs/contracts/interface.openapi.yaml` exits 0 (command in `ARTIFACT-MAP.md` §6) — evidence: result line ____ , date ____
- [ ] Spec dry run: one agent wrote testable acceptance criteria for three representative tickets (a service, a route, a graph node); every gap it hit closed in DO-3/DO-4
- [ ] Spec dry run filed: `docs/design/spec-dry-run.md` (from `templates/SPEC-DRY-RUN.md`) holds the three sample specs and each could-not-write item with its missing fact, every one marked closed
- [ ] Coverage requirements sweep (`to-tickets` mandatory-requirements table against DO-6's workflow registry): every entry point has a `WF-n`, every DO-7 metric is inherited by a workflow
- **Gate:** ☐ `design_outputs.py check … --gate tickets` passes; `signature_check.py` exits 0 (result line + date recorded); `docs/design/spec-dry-run.md` filed with no open gap; signature check, spec dry run and coverage sweep clean; DO-4 links and agrees with the agreed `CON-N` cards; code-design review PASS; Innocent reviewed DO-1/DO-2 and the current Stage 6 page ✓ ____ (the gate every backend, frontend and integration feature ticket needs)

## 7 · Tickets — four passes ★  (§7)
- [ ] Readiness per ticket (`ARTIFACT-MAP.md` §7): backend = §6 + its CONs agreed; frontend = §6 + its `SCR-N` signed + its CONs agreed; integration = planned any time, executed once its FE and BE tickets are merged against the same agreed CON; foundation = UX-2 pick + tokens + readiness record
- [ ] 7a–7c run on Opus with `to-tickets` invoked explicitly; Haiku only for fast evidence sweeps; Sonnet only from §8
- [ ] 7a **Product-wide** slice plan `docs/plans/slice-plan.md`, cut along DO-3's module boundaries; every ticket has a kind (backend / frontend / integration / foundation) and its `CON-N` and `SCR-N` links; every integration ticket names the tickets it joins — Innocent ✓ ____
- [ ] 7a parallelism audit in the slice plan (`to-tickets` §2a): edges removed and why, human gates in wave 0, critical-path length, widest wave, collision map per wave; re-run after 7c repairs
- [ ] Every ticket has exactly one lane (`ticket-lanes`: build-loop / direct / human / spike); lane split stated in the slice plan; `risk::security` on every security ticket (count stated)
- [ ] 7b Spec one wave at a time; each issue opens with its user story (US-N), has an example pair (WP-N, or PE-N for presentation work), cites its `CON-N` and (UI work) its signed `SCR-N`, and links its HP card
- [ ] Each ticket passes `ticket_readiness.py check <ticket.json> --root <repo>` before it is marked ready
- [ ] 7c Coverage audit clean (product-wide: every story, screen and agreed CON covered)
- [ ] 7d Published to GitLab, waves, kinds and lanes labelled
- **Gate:** ☐ all four passes done for the waves cut so far — Innocent ✓ ____ (slice plan)

## 8 · Build  (§8)
- [ ] Frontend tickets built from signed `SCR-N` and `design.md` tokens, on Prism mocks generated from `docs/contracts/interface.openapi.yaml`, while the backend is built alongside
- [ ] Backend contract tests run against the same `interface.openapi.yaml`
- [ ] Integration tickets point the frontend at the real backend once both sides are merged against the same agreed `CON-N`
- [ ] UX-5a per frontend slice: `docs/ux/05-verify/TRACEABILITY.md` updated, axe at 1280/390 light and dark, visual check against the look sheet and `design.md`, behavioural checks against the CON cards (rerun against the real backend after integration)
- [ ] Each wave's ready build-loop tickets built at the same time (one planner → implementer pair each), inside the collision map; its direct tickets done by one general agent each alongside, no build-loop gates
- [ ] Each ticket's WP-N (or PE-N) is one of its tests, written with the code (plan → implement → test → review); frozen first by `test-writer-agent` only for `risk::security` tickets
- [ ] Only affected tests per role and per merge; full suite only when a change reaches everything and before each deploy
- [ ] Each slice reconciles `.claude/` in the same change: area map (planned → actual), router rows, rule `paths:`, and ICM rows (scaffold, routes verified) with dated evidence
- [ ] `code-review-agent` per ticket; seam audit per wave; `security-privacy-agent` at a wave merge only when the wave has a `risk::security` ticket
- [ ] No merged work left marked `reconcile: CHG-N`
- **Gate:** ☐ waves merged, seam audits clean, UX-5a evidence for every frontend slice, area map matches the checkout — Claude ✓ ____

## UX-4 · Focused interaction prototype (optional)  (§4b)
*Only for a named interaction uncertainty; never a prerequisite for tickets. Otherwise record `n/a` with the reason.*
- [ ] Named question: ____ — or `n/a — <reason>` (*candidate, not yet decided:* "does live co-editing plus the Submit freeze confuse reviewers?" — SP-2 tests the mechanics; decide after SP-2)
- [ ] If run: `docs/ux/04-prototype/PROTOTYPE_PLAN.md` (question, what is built to answer it, how it is judged) and the focused prototype in `docs/ux/04-prototype/`
- **Gate:** ☐ Innocent judged the named question — Innocent ✓ ____ — or `n/a — ____` recorded

## UX-5b · Final acceptance ★  (§4b)
- [ ] Walkthrough of the connected application (real backend, not mocks); Lighthouse; `docs/ux/05-verify/QA_REPORT.md`
- [ ] Every UX-5a slice's evidence linked from `TRACEABILITY.md`
- **Gate:** ☐ final acceptance signed (before §9 and §10) — Innocent ✓ ____

## 9 · Experiment ★  (§9)
- [ ] Kickoff page generated from code (flow, prompts with versions, approach, failure types)
- [ ] Error-analysis round: ~20 traces, first failure each, `FT-N` taxonomy, models × failures table — Innocent ✓ ____
- [ ] Every `XP-N` targets one `FT-N`, one change, scored on the frozen set
- **Gate:** ☐ no tuning change without a named failure type

## 10 · Ship & defend  (§10)
- [ ] `SUBMISSION.md` walked; every row's evidence at the expected path
- [ ] Demo script (two-layer order) and interview prep
- [ ] Hiring-partner demo: decision inventory from dev logs + decision records + research (`docs/delivery/…-demo-decision-inventory.md`); video = product under 5 min, then decisions (`hiring-partner-framing` → *Demo video*)
- [ ] ICM progress checklist reconciled: no row left provisional without a named reason
- [ ] Retro written; lessons fed back to `Gauntlet AI/principles/` and `zero-to-hero`
- **Gate:** ☐ shipped — Innocent ✓ ____

---

## Skips

| Stage | Reason | Decided by | Date |
|---|---|---|---|

## ID registers (quick index)

| Prefix | Where | Count |
|---|---|---|
| WP | `docs/data/worked-pairs.md` | 5 (WP-1…WP-5; uncertain items U1–U10) |
| HP | `docs/design/hard-problems.md` | 10 (HP-1…HP-10, all chosen 2026-10-25) |
| US | `docs/ux/01-planning/USER_STORIES.md` | 37 |
| UXP / UXQ | `docs/ux/01-planning/USER_FLOWS.md`, `docs/ux/03-structure/SCREEN_SPECS.md`; routed in `docs/contracts/INTERFACE.md` | 10 / 11, all decided 2026-10-25 |
| SCR | `docs/ux/03-structure/SCREEN_SPECS.md` | 21 (wave 1: 9 signed) |
| CON | `docs/contracts/INTERFACE.md` | 24 (all `proposed`; System review pending) |
| CHG | `docs/contracts/CHANGES.md` | 0 |
| FW / PE | `docs/plans/foundation-wave.md` | 4 / 11 |
| SP | defined in `docs/design/hard-problems.md`; results in `docs/analysis/spikes/` (§5) | 3 defined (SP-1…SP-3), 0 run |
| FT | `docs/testing/error-analysis/` | 0 (§9) |
| XP | `docs/testing/experiments/` | 0 (§9) |
| T / AR / AD | `docs/analysis/2026-10-24-brief-audit.md` (traps / audit requirements / audit decisions) | 26 / 40 / 20 |
| AQ | brief audit §9 (AQ-1…16, not sent); PRD adds AQ-17…22 | 22 |
| R / GR / PD | `docs/prd/newsela-prd.md` (requirements / guardrails / PRD decisions), v1.0 approved 2026-10-25 | 60 / 18 / 31 |
