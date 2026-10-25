---
name: zero-to-hero
description: The standard sequence for every new project that has a coding repo, from brief to shipped product — scaffold with the principles in force, frame the problem, look at real data and hand-work input→output pairs, put the hard problems (orchestration first) on a visual page Innocent works through, interview, then (once the PRD is approved) write user stories and research and design the UX/UI from live reference products with captured images, spike what's uncertain, design, cut tickets in separate passes, build, run experiments error-analysis-first, ship and defend. Use when creating or scaffolding any new coding project (Gauntlet weekly build, hiring-partner project, product, client build), when checking whether an in-flight project skipped a stage, or when Innocent says "zero to hero", "new project", "project checklist" or "artifact map".
---

# Zero to Hero — The New-Project Sequence

Version 2.0.0, 2026-10-25. Origin: the Equinox retrospective,
`Gauntlet AI/artifacts/2026-10-14-design-process-concerns-after-equinox.md` (concerns 1–7).
2.0.0 (2026-10-25) lets **frontend work run alongside system design**, kept in step by one shared contract
instead of a finished prototype (`proposals/2026-10-25-concurrent-frontend.md`; approved by Innocent on
2026-10-25 during Newsela, after UX-2: "This is an approved process change, not just a proposal or a
Newsela-specific skip"). What changes, in plain words: UX-1 is still the fork that Claude closes, and now also
covers states, permissions and recovery paths, with every unresolved behaviour question listed where it can be
seen (`UXP-N`). UX-3 splits in two. **UX-3a shared contracts** is a new **Joint track** that starts right after
UX-1: one interface spec per project in `docs/contracts/`, cards that go `draft` → `proposed` → `agreed`, owned by
both sides, and every change to an agreed card logged as a `CHG-N`. **UX-3b** is the screens and design tokens.
An **early frontend foundation wave (FW)** of presentation-only work (tokens, type, basic components, layout) may
start once the UX-2 direction is picked and the tokens exist. §7 readiness is now **per ticket** (backend,
frontend, integration, foundation), checked by `scripts/ticket_readiness.py`, instead of waiting for whole tracks.
§8 builds the frontend **and** the backend; the frontend runs on mocks generated from the agreed interface spec,
and UX-5a checks each slice during the build. UX-4 becomes an optional, focused prototype for one named
interaction question (`n/a — <reason>` when there is none). UX-5b, Innocent's final acceptance of the connected
app, comes before §9. Every §6 safeguard stays. The notes below are history: where one states a rule that 2.0.0
changes (two tracks joined at tickets, the prototype as the real frontend, §8 as backend plus plumbing, tickets
waiting for UX-4 or UX-5), this note and the body govern.
1.14.1 (2026-10-21) makes the §6 signature check **mechanical**: the gate requires `system-design-readiness` `scripts/signature_check.py --code-design <DO-3> --contracts <DO-4> --observability <DO-6> [--openapi <file>]` to exit 0 (no unsigned module, undefined return type, OpenAPI error code without a DO-4 error type, or DO-6 record without storage), with its result line and date in the checklist; the spec dry run is filed at `docs/design/spec-dry-run.md` from the new `templates/SPEC-DRY-RUN.md`, each could-not-write item a design gap closed before the gate; and the guard hook names the signature-check item while it is unticked at §6 (AEA: the §6 gate passed with ~170 component-contract gaps that surfaced only in §7 specs).
1.14.0 tightens the **§6 → §7 hand-off** after the AEA call-center run: the §6 gate adds a **signature-completeness check** (every cross-area call in DO-3's build-areas table has a DO-4 signature with field-level result types; every service and adapter has its constructor; every error code the OpenAPI names maps to a DO-4 error type; every record DO-6 requires has a storage location; every typed settings field consumers need is named) and a **spec dry run** (one agent writes testable acceptance criteria for three representative tickets: a service, a route, a graph node; what it cannot write is a design gap), plus the `to-tickets` **coverage requirements sweep** against DO-6's workflow registry (AEA's 7b spec writers raised ~170 needs-decision items, mostly missing signatures and types, after §6 was signed; the demo login had no `WF-n` and M-2/M-29 belonged to no workflow, both found only at §7); **§7 opens for backend tickets once the UX-3 contracts are signed and the §6 gate passes**: only the ticket that serves the built frontend waits for the UX-4 sign-off and the §8 UI-integration ticket for UX-5, so no *Skips* row is needed (AEA ran it as a one-off skip, Innocent, 2026-10-21); and a **§7 model line**: 7a–7c on Opus with `to-tickets` invoked explicitly, fast evidence sweeps on Haiku, Sonnet only for §8 implementers and reviewers (AEA's first slicing ran on Sonnet and was redone).
1.13.0 puts **look sheets before prototypes at UX-2**: every design direction gets a quick static look sheet (credited Dribbble references, light + dark palette with computed contrast, 3–4 static mockups of the core screens on real flow copy), Innocent picks from the sheets, and only the pick gets a clickable prototype; directions must differ at a glance (softness, density, shape, palette temperature, type), and no unbuilt direction is shown next to built ones (`ux-pipeline` `references/phases.md` UX-2, `templates/LOOK_SHEET.md`; Innocent, 2026-10-20, AEA: "screenshots or fast light mockups before showing me so i can see the colors then you can build the full full protoype").
1.12.0 makes the **UX-1 gate (the fork) Claude-closed**: the stories, journeys, flows and sitemap still get their review page, but Claude ticks the gate itself once `trace_check --upto FLOW` and `check_review_page.py` pass, gives Innocent the page path, and opens the fork without waiting for approval. A standing policy, not a *Skips* entry; UX-2 to UX-5 keep their sign-offs (Innocent, 2026-10-20: "skip need approval on the flow diagram … i trust the flow that you've been building").
1.11.0 adds **ticket lanes**: every §7 ticket carries exactly one `lane::` label (`build-loop`, `direct`, `human`, `spike`; workspace rule `ticket-lanes`, copied at Stage 0) and only `lane::build-loop` tickets go through the §8 build loop; docs, trackers and review pages are done by one general agent alongside their wave (Innocent, 2026-10-20).
1.10.0 makes **code design SOLID and modular, and ticketing parallel by gate**: Stage 0 copies the workspace rule `code-design-solid-modularity` (Build loop set); §6 writes DO-3 to it (each module's one-sentence job, interface, dependency direction, each seam cut or deferred) and has `metz-code-design-agent` (Sandi Metz persona) review DO-3 before the Stage 6 page; §7a must carry `to-tickets` §2a's parallelism audit (edges removed, critical path, widest wave, collision map) and its gate checks it; §8 builds every ready ticket in a wave at once (Innocent, 2026-10-20).
1.9.0 adds the **build-loop test scope**: Stage 0 copies the workspace rule `build-loop-test-scope` into the repo (a new *Build loop* set in the principles pack), and Stage 8 runs each role's tests to it — the full suite once per merge, on main, not 5–6 times per ticket (Innocent, 2026-10-19, after the YourAI factory build).
1.1.0 adds Stage 4b UX/UI (user stories, live reference research with captured images, design doc),
modelled on `inno-houseaccount/docs/design/ui-design-reference.md`. Numbered 4b so no existing § moves.
1.8.0 makes the **entry shape a gated, rebuilt artifact** (icm-project 1.5.0): Stage 0 and every later gate run `~/.claude/skills/icm-project/scripts/check_context.py <repo>` (no FAIL); the System-track close **rebuilds `CLAUDE.md` and the router** from icm-project's entry template against the area map and verifies the fresh-context walkthrough before §7; and a retrofit must *invoke* `icm-project`, never copy a sibling project's context files (`Gauntlet AI/artifacts/ICM Rework/2026-10-19-vps-sync-and-icm-entry-diagnosis.md`; Innocent, 2026-10-19).
1.7.0 adds the rule **`system-design-questioning`** to the principles pack (general set): the system-design foundation questions (load target and scale path, peak, failure to survive, spend ceiling, hardest uncertainty) are asked of Innocent **before** anything that depends on them is drafted, new choices that surface **while** designing are asked as `SDQ-N`, and a stand-in (a test load, a default, a public count) is never an answer. §6 opens with that step (Innocent, 2026-10-19, after Riverside's design was drafted on an unasked load).
1.6.0 merges the two parallel 1.5.0 changes made on 2026-10-19, one on the Mac and one on the VPS, so both machines carry both: the two tracks (Mac) and the Stage 6 review page with the writing standard (VPS); the Stage 6 page is the System track's §6 gate page.
1.5.0 (Mac) runs **two tracks in parallel after the UX-1 user stories**: the UX track (UX-2 → UX-5) and the System track (§5 spikes → §6 design), in two sessions, joining at §7 tickets; the UI contracts are the only agreement between them, and the prototype is the real frontend (`proposals/2026-10-19-parallel-tracks.md`; Innocent, 2026-10-19).
1.5.0 (VPS) adds a **Stage 6 visual review page** (the system design, with every finding Innocent needs to study it) and a **writing standard for every page**: story-driven, tied to the whole project, plain words at about a fifth-grade reading level with each technical term explained where it is used, and every decision asked of Innocent says why it is being asked and what it changes (`references/visual-review-pages.md` → *Write it as a story*; Innocent, 2026-10-19).
1.4.0 makes every review page **context before content**: it opens with *the story so far*, and each item Innocent judges (every Stage 3 hard-problem card) opens with where it comes up in the project, the problem being solved, then why it's hard; the check enforces it on Stage 3 cards (`references/visual-review-pages.md`; Innocent, 2026-10-19).
1.3.0 makes Stage 5 spikes **fan-out builds with light testing**: one agent per option in parallel against a frozen scoring harness, run on the VPS when compute-heavy (`references/spikes.md`; Innocent, 2026-10-18).
1.2.0 integrates the `icm-project` skill: Stage 0 bootstraps the project's context system, and Stages 6 and 8 and every gate keep it true (see *The context system evolves with the repo*).

| File | Job |
|---|---|
| `ARTIFACT-MAP.md` | Every artifact each stage produces: path in the repo, who drafts, who signs off, the gate check |
| `templates/PROJECT-CHECKLIST.md` | Copied to the new repo's root at Stage 0 and ticked as the project moves; the per-project record |
| `~/.claude/skills/icm-project/` | The context-system method (entry, router, area map, maintenance rule, dev log, ICM progress checklist). Zero-to-hero calls it; it is not folded in |
| `references/visual-review-pages.md` | The standard for the Stage 1–3 and Stage 6 visual review pages, and the writing standard for every page: anatomy, status vocabulary, per-stage visuals, quality bars, review check |
| `references/spikes.md` | Stage 5 procedure: what a spike is, fan-out build (one agent per option, in parallel), frozen scoring harness, light testing, VPS for heavy compute |
| `../ux-pipeline/` (PILOT v2) | The §4b UX/UI process after PRD approval: UX-1 (fork), UX-2, UX-3a shared contracts (`docs/contracts/`, with its change procedure), UX-3b, FW, optional UX-4, UX-5a/5b; used instead of §4b's list by projects in the pilot |
| `scripts/ticket_readiness.py` | §7 per-ticket readiness: `python3 scripts/ticket_readiness.py check <ticket.json> --root <repo>`. The ticket JSON gives `id`, `kind` (`backend`, `frontend`, `integration`, `foundation`), `cons`, `screens`, `depends_on`, `scope`. It reads the checklist gates, the `INTERFACE.md` statuses, the screen-spec sign-offs and the foundation readiness record, and exits 1 naming each missing condition |
| `proposals/` | Approved process revisions with their reasons; `2026-10-25-concurrent-frontend.md` is the source of 2.0.0 (`2026-10-19-parallel-tracks.md` is history) |
| `templates/SPEC-DRY-RUN.md` | §6 spec dry run: the brief for the agent (three tickets, sources, output format) and the filed result at `docs/design/spec-dry-run.md` |
| `templates/visual-review-page.html` | Starter page (tokens, components, status legend, metadata contract) every review page is built from |
| `scripts/stamp_review_page.py` | Records the sources' current SHA-256 and the review date in a page, run only after its content was refreshed from those sources |
| `scripts/check_review_page.py` | Review check: fails plain dumps, missing diagrams, stale sources, missing status/links, external assets, finality wording on undecided items |

## What it does

Every new coding project runs the same stages: 0–10, plus 4b (UX/UI) and the FW foundation wave. The point of
the order is that **Innocent's judgement goes in at the front** (real data, hard problems, slice plan), where it
is cheap, instead of in the middle of experiments, where in Equinox he had to reverse-engineer an approach he
never chose. The sequence is linear up to the user stories (UX-1). Then it **forks into three tracks** that run
at the same time: the **UX track** (visual direction, screens, foundation wave), the **Joint track** (the shared
contracts) and the **System track** (spikes, design). The tracks do not join all at once. Each ticket becomes
ready on its own, when the gates and contracts *it* needs are in place (§7).

```
 0 Scaffold ─► 1 Frame ─► 2 Data reality★ ─► 3 Hard problems★ ─► 4 Interview (PRD)★ ─► 4b UX-1 stories, flows, states
                                                                                              │  FORK
      ┌───────────────────────────────────────────────────────────────────────────────────────┤
      │ UX track:     UX-2 visual direction★ ─► UX-3b screens + tokens★ ─► FW foundation wave
      │ Joint track:  UX-3a shared contracts★  (UX states needs ↔ System states support; one interface spec)
      │ System track: 5 Spikes ─► 6 Design★ (architecture, code design, area map; every safeguard)
      └──────────────────────────────┬─────────────────────────────────────────────────────────
                                     ▼  readiness per ticket (§7, scripts/ticket_readiness.py)
 7 Tickets★ (frontend · backend · integration · foundation; four passes) ─► 8 Build (FE + BE, UX-5a per slice)
   ─► UX-5b final acceptance★ ─► 9 Experiment★ ─► 10 Ship & defend
 UX-4 focused interaction prototype: optional, only when a named interaction question needs it
                                                                    ★ = Innocent's judgement is the main input
                                                                    (UX-1: Claude closes the gate, page still built)
```

**The shared contracts (UX-3a) keep the tracks in step.** The UX side says what the experience needs; the System
side says how those promises are kept. Each project has **one interface spec**, in `docs/contracts/`:

- `INTERFACE.md`: the behavioural contract cards (`CON-N`). A card covers, where it applies: the operations,
  fields, states, permissions, named errors, recovery, guarantees (what is promised, e.g. "Approve pins the
  snapshot hash; a stale pin returns 409 and changes nothing"), timing (e.g. "checks re-run within 5 s of a
  store"), the screens and stories that need it, the backend owner, and a **status**: `draft` → `proposed` →
  `agreed`, or `changing` while a change is under way.
- `interface.openapi.yaml`: the same promises in machine form. Generated types, the Prism mocks (a fake server
  that answers from the OpenAPI file) and the contract checks all read this one file. Each operation names its
  `CON-N`.
- `CHANGES.md`: the change log, one `CHG-N` per change.

A card is `agreed` when both sides have reviewed it (a named reviewer each, with the date) and Innocent has
decided every product-behaviour question in it. Behaviour and presentation are kept apart: moving a summary into
a sidebar is presentation; adding a reservation or changing what "approved" means is behaviour. §6's internal
component contracts (DO-4) link to the `CON-N` cards and add internal signatures; they never repeat or contradict
a card's promise. Projects that already have `docs/ux/03-structure/UI_CONTRACTS.md` keep it as a pointer to
`docs/contracts/`, or migrate it.

**Changing an agreed card** (any change, including one that changes meaning but leaves the schema the same):

1. **Identify** the changed promise: the `CON-N`, the aspect (operation, field, state, permission, error,
   recovery, guarantee, timing) and whether it is **presentation-only** or **behavioural**.
2. **Review the consequences:** both sides review; a change to product meaning goes to Innocent.
3. **Update the sources:** `INTERFACE.md`, the OpenAPI file, the DO-4 links and the screen specs.
4. **Mark** the affected design sections, tickets, code and evidence `reconcile: CHG-N` until each is reconciled.
5. **Unrelated work continues.** Only work that cites the changed `CON-N` waits.

Every change gets a `CHG-N` with its aspect, even when the OpenAPI file does not change, because schema
validation alone does not catch a change in meaning. A spike result that changes what a screen needs is a change
like any other.

**There is no full prototype before tickets.** The frontend is built in §8 as ordinary tickets, against mocks
generated from the agreed interface spec, while the backend is built alongside it; integration tickets join the
two. UX-4 is a small, focused prototype only when a named interaction question needs answering before the build.

## Why this order (the reasoning, not just the rule)

1. **Difficulty lives in the data, not in the brief.** "Normalize each contract" reads as one
   problem; a real contract next to its required output shows whether it is copy-a-field easy or
   needs-judgement hard. Equinox designed and cut 39 tickets before it saw one real contract
   (`inno-equinox` `78c8756`, 2026-10-09 02:14; first real Kalshi data arrived through ticket #10 at
   12:22), then spent its experiments rediscovering the hard parts. So Stage 2 comes before any
   judgement of difficulty.
2. **The hard problems must be seen before they are asked about.** An interview question gets a
   quick fact; a hard problem needs a picture and options. So the hard-problems page (Stage 3)
   precedes the interview (Stage 4), and the interview records what Innocent chose on the page.
3. **Orchestration is always the first hard problem.** GP-72: *draw the skeleton yourself; give the
   model autonomy only where the path can't be known.* It is never chosen silently.
4. **A ticket for an unresolved problem is vague no matter how it's written.** So every hard
   problem has a chosen approach (decided, or proven by a spike) before tickets (Stage 5 gate).
5. **Tickets are cut in separate passes**, because one pass doing seven jobs produced vague tickets.
6. **The UI is researched and designed only after the PRD is approved (Stage 4b), and then it runs
   alongside system design.** Before the PRD is approved, the functionality, scope and problem are
   still moving, so any screen drawn is a guess. Once the PRD fixes them, user stories say who does
   what and why, and real reference products (driven live, captured as images) show how others
   solved the same screen. Tickets then cite a story (`US-N`), a signed screen spec (`SCR-N`) and the
   contracts they rely on (`CON-N`) instead of inventing the UI during the build. **After the user
   stories the work forks**, because spikes and system design read the worked pairs, the hard-problem
   cards and the contracts, never a screen (Riverside, 2026-10-18: every HP card sat `open` while the
   UX track waited for review). Through 1.x the frontend then waited for a full clickable prototype
   (UX-4) and its verification (UX-5). That prototype cost more tokens than any other stage (Riverside:
   24 screens), arrived late, could not start before the look was chosen, and meanwhile the System
   track designed against contracts the UX side owned alone. So from 2.0.0 the contracts are agreed
   **jointly** from UX-1 on, each ticket is ready when what *it* needs is in place, and the frontend is
   built in §8 with the backend. The agreed contracts, not a prototype, are what stop the UX, the system
   design and the tickets from drifting apart.
7. **Experiments open with error analysis (GP-44)** — read ~20 traces, note the first failure in
   each, group into a taxonomy across models — and only then change one thing per failure type.

## How to run it

Starts automatically for new coding repos — trigger, scope and hard stops: `.claude/rules/new-project-zero-to-hero.md`.

1. **Stage 0:** copy `templates/PROJECT-CHECKLIST.md` to the new repo's root as
   `PROJECT-CHECKLIST.md`. Fill in project name, mode and date. Then work the stages in order,
   ticking items and writing each artifact at the path `ARTIFACT-MAP.md` gives.
2. **Sign-offs are recorded in the checklist** as `Innocent ✓ YYYY-MM-DD` on the stage's gate line.
   A ★ stage is not passed on Claude's say-so.
3. **Give Innocent a *visual* review page before each early gate** (Stages 1–3) **and before the design gate** (Stage 6, the System track's §6 gate); spec in
   `references/visual-review-pages.md`. The Markdown files are written first and stay the sources
   of truth. The page is a standalone, local **synthesis** generated afterwards, not a
   Markdown-to-HTML conversion. It must:
   - open with **the story so far**, and introduce every item Innocent judges with *where this
     comes up in the project → the problem we're solving → why it's hard* before any options;
   - be **written as a story in plain words** (about a fifth-grade reading level): every point is
     tied back to what the project is for, technical terms are allowed but explained in the same
     sentence, and every decision asked of Innocent also says **why he is being asked and what it
     changes** (*Write it as a story*);
   - show diagrams, timelines or cards of what the stage established;
   - separate **facts / Innocent's decisions / proposals / unknowns / items awaiting approval**;
   - show draft status, date and source paths, with direct links to each full source;
   - be responsive, accessible and printable, with no external assets.

   Expected content:
   - **Stage 1:** problem, user journey (product vs human decisions), metrics chain, scope and
     cuts, evidence limits, approval request.
   - **Stage 2:** sample coverage and the worked input → output pairs.
   - **Stage 3:** the story so far and a map of where each hard problem sits in the user's
     journey; per card, its project context, the problem and why it's hard, then options,
     recommendations and consequences.
   - **Stage 6:** the system design as a study guide: a system map (where it runs, what crosses
     each boundary), one real request traced with its time budget, the load and bottleneck
     findings at today's size and at the scale target, the scale path, every major decision with
     its reasoning, **every finding of DO-1/DO-2 in full** (Innocent studies them; nothing is
     only summarised), and the approval request.

   Before asking for a sign-off:
   - build from `templates/visual-review-page.html`;
   - run `scripts/check_review_page.py`;
   - inspect at laptop and phone width;
   - link source → page in the project's `.claude/README.md`;
   - refresh the page whenever a source changes.
4. **A skipped stage needs a written reason** in the checklist's *Skips* section, **and Innocent's
   own yes for that stage, asked separately with what the skip costs.** Silence is not a skip, and
   one "go" never approves several skips (YourAI, 2026-10-18: a bundled "go" was misread as
   approval to skip design and start the build).
5. **Resuming:** read `PROJECT-CHECKLIST.md` first. Before the fork, the first unticked gate is where
   the project is. After it, there is one current gate **per marked track**: the first unticked gate in
   the sections headed `— UX track`, `— Joint track` and `— System track`. Ticket readiness is **per
   ticket**, not per track. Before a ticket starts, run
   `python3 scripts/ticket_readiness.py check <ticket.json> --root <repo>` (path relative to this skill);
   it exits 1 and names each missing condition (for example "§6 gate" or "CON-18 is proposed").
   Checklists from 1.x (no `Joint track` heading) keep their old reporting until their sections from
   §4b on are replaced with the 2.0.0 template. Older single-track checklists keep the single
   first-unticked-gate rule.
6. **At the fork (UX-1 gate ticked by Claude, no approval stop):** open a second session for the System
   track, on the same machine or VPS as the project's working copy and on the same model
   (`~/.claude/rules/match-model-on-vps.md`). It reads first: the PRD, `USER_STORIES.md`, the flows with
   their states, permissions, recovery paths and draft CONs (`USER_FLOWS.md`), the open `UXP-N` list,
   `docs/design/hard-problems.md` and `docs/data/worked-pairs.md`. The Joint track (UX-3a) starts at the
   same time: the draft CONs move into `docs/contracts/INTERFACE.md` and each unresolved behaviour question
   (`UXP-N`) is routed to the card it affects. **Ownership:** the UX session ticks the UX-track rows and the
   System session ticks the §5–§6 rows. The contract files in `docs/contracts/` are **jointly owned**: the
   UX side owns the *needs* (which operations, fields, states and errors a screen requires), the System
   side owns the *support* (whether it is feasible, and the guarantees, timing and errors it can promise),
   both review every card, and Innocent decides every product-behaviour question. Once a card is `agreed`,
   either side changes it only through the change procedure above. In a one-person project both reviews
   may happen in one session, but they are recorded separately. Tickets are cut as each kind becomes ready
   (§7); a contract change after tickets exist marks the tickets that cite it `reconcile: CHG-N`.
7. **Auditing an in-flight project:** walk the checklist against the repo and report which gates
   have no evidence at the mapped path, and run `~/.claude/skills/icm-project/scripts/check_context.py <repo>`. **Retrofitting** a project's context system
   means invoking the `icm-project` skill (Phases 1 and 3, then 2 if a design exists) and recording its
   version in `icm-progress.md`; copying another project's entry, router or maintenance rule is not a
   retrofit. If the skill cannot be invoked (no `~/.claude/skills/icm-project` link on this machine), stop
   and say so instead of hand-writing the files.

## The context system evolves with the repo (ICM)

Zero-to-hero says where the *product* is; `PROJECT-CHECKLIST.md` tracks that. The `icm-project` skill
builds and maintains the *context system* in `.claude/` — the entry point, router, area map,
maintenance rule and dev log — so Claude's map of the repo keeps pace with the repo. Its own record,
`.claude/state/icm-progress.md` (the **ICM progress checklist**), tracks context maturity only. The
two checklists stay separate; the project checklist **links** to the ICM one and never copies its rows.

Three touch points:

1. **Stage 0:** invoke `icm-project` Phases 1 and 3 — `CLAUDE.md` entry (from its entry template),
   `.claude/README.md` router, `rules/context-maintenance.md`, a dev-log home, and
   `.claude/state/icm-progress.md`. It sets up context and never implements. The gate runs the checker.
2. **Stage 6 (design) and the first scaffold:** re-enter Phase 2 with the coding branch. Code design
   produces the area map, `.claude/reference/area-map.md`, with planned paths *labelled planned*; the
   router gets rows for them. Creating the directory spine ticks the ICM "physical scaffold" row.
   **At the System-track close, rebuild the entry:** re-run `icm-project` Phase 3 so `CLAUDE.md` and the
   router are rebuilt from the entry template against the area map (nothing the design produced is
   copied into the entry), then do the fresh-context route walkthrough and mark that ICM row verified.
   No §7 feature ticket (backend, frontend or integration) is cut while the checker reports a FAIL or the
   walkthrough row is provisional.
3. **Every later gate, and each Stage 8 slice:** in the same change that moves the ground, reconcile
   the area map, router rows and rule `paths:`, and update the ICM rows with dated evidence
   (`icm-project` Phase 4). A gate is not passed while the area map disagrees with the repo or the
   checker reports a FAIL. Upkeep **replaces** checklist evidence and router links; narrative goes in the
   dev log, never appended to a row.

## Modes

| | Full | Light (1–2 day hiring-partner projects, small builds) |
|---|---|---|
| Stage 2 samples | 20–50, 5–10 worked pairs | ~10, 3 worked pairs |
| Stage 3 cards | one per hard problem | 2–4 cards on one page |
| Stage 4b UX/UI | stories, flows and states for every flow; 2–4 reference products; a look sheet for each of 4 directions; every screen specced (signed per wave); a CON card for every data step | stories, flows and states for core flows; 2 references; a look sheet for each direction shown (never dropped); core screens specced, one with its phone layout; a CON card for every data step in the core flows |
| UX-4 focused prototype | only for a named interaction question; otherwise `n/a — <reason>` | the same; usually `n/a` |
| Stage 5 spikes | any card below "confident"; 2–4 options fanned out | only a card that is truly uncertain; 2 options fanned out |
| Stages 2–5 time | as needed | ≈ 2 hours total |

Light mode drops volume, never a stage (an optional UX-4 recorded as `n/a` is not a dropped stage). Both modes
fork into the three tracks after UX-1.

## Which existing tools do which stage

| Stage | Existing tool | Status |
|---|---|---|
| 0 Scaffold | `icm-project` (Phases 1 and 3); principles pack in `ARTIFACT-MAP.md` §0; `Gauntlet AI/.claude/rules/gauntlet-gitlab-versioning.md`, `gauntlet-hosting-default.md` | Manual copy — no scaffold script yet |
| 1 Frame | `Gauntlet AI/.claude/rules/hiring-partner-framing.md`; the brief-audit habit (audit the brief, find the real problem, write our own PRD) | Exists |
| 2 Data reality | — | **Manual until a skill is built** — follow `ARTIFACT-MAP.md` §2 |
| 3 Hard problems | `excalidraw-skill` for diagrams; `modern-ui-principles` for the HTML | **Manual until a skill is built** — follow `ARTIFACT-MAP.md` §3 |
| 4 Interview | `Gauntlet AI/.claude/skills/prd-interview` | Exists; run it *after* Stage 3 and feed it the register |
| 4b UX/UI | `modern-ui-principles` (UI-2 `design.md` template); Chrome DevTools MCP for live reference capture, per `~/.claude/rules/browser-automation-patterns.md`; worked example `inno-houseaccount/docs/design/ui-design-reference.md` | **`ux-pipeline`** (PILOT v2): UX-1 fork → UX-2, UX-3a (joint), UX-3b, FW; optional UX-4; UX-5a in §8, UX-5b before §9; follow `ARTIFACT-MAP.md` §4b |
| FW Foundation wave | `ux-pipeline` `templates/FOUNDATION_WAVE.md` (readiness record); `modern-ui-principles`; the §8 build loop | Exists; readiness checked by `scripts/ticket_readiness.py` |
| 5 Spikes | Build loop's worktree plumbing (`Gauntlet AI/.claude/skills/tdd-swarm/scripts/worktree.sh`) | Fan-out, light testing — `references/spikes.md` |
| 6 Design | `Gauntlet AI/.claude/rules/system-design-questioning.md` (questions first, and while designing); `Gauntlet AI/.claude/skills/system-design-readiness` (seven design outputs); `.claude/rules/code-design-solid-modularity.md` + `metz-code-design-agent` for DO-3; `icm-project` Phase 2 coding branch for the area map; before the gate, the signature-completeness check (`system-design-readiness` `scripts/signature_check.py` must exit 0), spec dry run (filed at `docs/design/spec-dry-run.md` from `templates/SPEC-DRY-RUN.md`) and `to-tickets` coverage requirements sweep (`ARTIFACT-MAP.md` §6) | Exists |
| 7 Tickets | `Gauntlet AI/.claude/skills/to-tickets` (its §2a parallelism audit is mandatory in 7a), invoked explicitly, on Opus for 7a–7c; Haiku for fast evidence sweeps; Sonnet only from §8; `scripts/ticket_readiness.py` per ticket | Exists as one pass; **run it as the four passes in `ARTIFACT-MAP.md` §7** until it is split |
| 8 Build | frontend and backend tickets, the frontend on Prism mocks of `docs/contracts/interface.openapi.yaml`; UX-5a checks per frontend slice; plan → implement → test → review (`fanout-*` pair or the project's own), `code-review-agent`; `test-writer-agent` first and `security-privacy-agent` at the wave merge only for `risk::security` tickets; affected tests only (`.claude/rules/build-loop-test-scope.md`) | Exists |
| 9 Experiment | — | **Manual until built** — kickoff page + error-analysis-first, `ARTIFACT-MAP.md` §9 |
| 10 Ship & defend | `SUBMISSION.md`, `grill-with-docs`, `system-engineering-tutor` | Exists |


## Non-Gauntlet projects

The sequence is the same. Differences: skip the Gauntlet-only policy rules at Stage 0 (GitLab,
Railway, hiring-partner framing), use the project's own host and remote, and use the project's own
docs layout if it already has one — the map's paths are the default, not a mandate. Client projects
follow `AI Consulting`'s rules on where client data may live; real samples containing client or
personal data are redacted or kept out of the repo (record where they are instead).
