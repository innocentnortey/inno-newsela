# Artifact Map

Every artifact the sequence produces, per stage. Paths are relative to the **build repo** and follow
the layout Equinox and Cerbo already share (`docs/source`, `prd`, `design`, `testing`, `plans`,
`delivery`, `artifacts`, `analysis`). The only new folder is `docs/data/`. A project that already has
its own layout keeps it and records the substitutions in `PROJECT-CHECKLIST.md`.

**Drafts / Signs off:** *Claude* drafts unless stated. *Innocent* in the sign-off column means the
gate is not passed until his `Innocent ✓ YYYY-MM-DD` is in the checklist.

**Stable IDs used across stages:** `WP-N` worked pair · `HP-N` hard problem · `US-N` user story · `UXP-N` open
behaviour question · `SCR-N` screen spec · `CON-N` shared contract card · `CHG-N` contract change · `PE-N`
presentation example · `FW-N` foundation-wave ticket · `SP-N` spike · `FT-N` failure type · `XP-N` experiment. Tickets, tests and experiments cite these so any later
reader can walk back to the data and the decision.

---

## §0 Scaffold

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| Project checklist | `PROJECT-CHECKLIST.md` (from `templates/`) | Claude | — |
| Entry point | `CLAUDE.md` (+ `AGENTS.md` if Codex works the repo) | Claude | — |
| Context system (`icm-project` Phases 1 and 3) | `.claude/README.md` (router), `.claude/rules/context-maintenance.md`, dev-log home (`docs/devlog/` unless the project has one), `.claude/state/icm-progress.md`, `.claude/state/resume.md` | Claude | — |
| Principles pack | `.claude/rules/` + `docs/principles/` (below) | Claude | — |
| Submission tracker (Gauntlet) | `SUBMISSION.md` | Claude | Innocent |

**Principles pack — two halves, both required.** The rules are the checks; the principles are the
reasoning they cite (GP IDs). Copying only the rules leaves every `[GP-N]` pointing nowhere.

1. **Principles:** copy `Gauntlet AI/principles/*.md` (every principle file and `README.md`; not
   `lecture-notes/`) to `docs/principles/`.
2. **Rules:** the sets below, into `.claude/rules/`.

Originals live in `Gauntlet AI/`; change the original first, then re-copy. Each copied rule starts
with a one-line provenance note naming the original.

| Set | Rules | Copy when |
|---|---|---|
| General engineering | `agent-architecture`, `agent-tools`, `retrieval-and-context`, `verification-evals-observability`, `safe-validation-errors`, `synthetic-test-data`, `design-doc-defense` (adapt its scope line, which names AgentForge), `system-design-conversation`, `system-design-questioning`, `problem-framing`, `business-metrics` | Every project with LLM or agent code; the non-agent rules for every project |
| Gauntlet policy | `gauntlet-gitlab-versioning`, `gauntlet-hosting-default`, `html-files-not-artifacts` | Every Gauntlet project |
| Hiring partner | `hiring-partner-framing` | Hiring-partner projects |
| Build loop | `build-loop-test-scope`, `code-design-solid-modularity`, `ticket-lanes` (originals in the workspace `.claude/rules/`, not `Gauntlet AI/`) | Every project with a coding repo |
| Legacy integration | `legacy-integration-constraints` | OpenEMR projects only — it is OpenEMR-specific |

**Context system.** The project checklist links `.claude/state/icm-progress.md` and does not copy its rows.
The ICM checklist tracks context maturity only; product status stays in the project checklist and tickets.
Later stages add to it: Stage 6 writes `.claude/reference/area-map.md` (planned paths labelled planned);
Stage 8 turns planned into actual and keeps router rows, rule `paths:` and ICM rows true in each slice.

**Gate:** both halves of the pack present (`docs/principles/system-design.md` exists); checklist
filled in with project name, mode and date; `icm-progress.md` exists and is linked from `CLAUDE.md`;
the context system was made by invoking `icm-project` (version recorded in `icm-progress.md`) and
`~/.claude/skills/icm-project/scripts/check_context.py <repo>` reports no FAIL.

---

## §1 Frame

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| Source documents, ranked | `docs/source/` (brief and portal pages converted to Markdown; ISSUED → PROPOSED → DERIVED → CONTEXT) | Claude | — |
| Brief audit (traps, real problem, real guideline) | `docs/analysis/YYYY-MM-DD-brief-audit.md` | Claude | Innocent |
| Success framing: two layers + metrics tree | `docs/delivery/YYYY-MM-DD-angle-and-demo-framing.md` (hiring partner) or a PRD section | Claude | Innocent |
| PRD draft | `docs/prd/<project>-prd.md` | Claude | (approved at §4) |
| Stage 1 visual review page | `docs/artifacts/YYYY-MM-DD-<project>-prd.html`: a visual synthesis built *after* the PRD, audit and framing Markdown. It shows the problem, the user journey (what the product does vs what humans decide), the metrics chain with baselines, scope and cuts, evidence limits and the approval request, with status, date and source links visible. Per `references/visual-review-pages.md`; passes `scripts/check_review_page.py` | Claude | Innocent reviews before the §1 gate |

**Principles at this stage:** `docs/principles/problem-framing.md` (GP-120 – GP-130) and `docs/principles/business-metrics.md` (GP-131 – GP-144). The brief audit opens with *The problem behind this brief* and carries a why-chain, the brief's assumptions, and a hop chain from each metric to money or customer value. Rules: `.claude/rules/problem-framing.md`, `.claude/rules/business-metrics.md` (metrics: health vs value, leading and lagging pairs, a decision line per metric, baseline / aspiration / hard gate).

**Gate:** audit and framing signed off after Innocent has seen the **current** visual review page (check passes; inspected at laptop and phone width); PRD draft exists.

---

## §2 Data reality ★

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| Sample set | `docs/data/samples/` — raw files, each named by source and capture date | Claude | — |
| Selection matrix | `docs/data/README.md` — sources × types × edge cases, which sample covers which cell, how each was captured, what is synthetic and why | Claude | Innocent |
| Worked pairs | `docs/data/worked-pairs.md` | Claude drafts outputs | **Innocent checks every pair flagged uncertain** |
| Stage 2 visual review page | `docs/artifacts/YYYY-MM-DD-data-reality.html`: a visual synthesis built *after* `docs/data/README.md` and `worked-pairs.md`. It shows a sample-coverage matrix (sources × types × edge cases, synthetic cells marked with their assumption) and each worked pair side by side (input → required output → gap, difficulty and confidence badges), linked back to both sources. Per `references/visual-review-pages.md`; passes the check | Claude | Innocent reviews before the §2 gate |

**Worked-pair format (one per `WP-N`):**

```
WP-3  ·  source: Kalshi  ·  sample: samples/kalshi-2026-10-09-fed-rate.json  ·  synthetic: no
Input (the parts that matter):   <verbatim excerpt>
Required output:                 <the output contract, filled in by hand>
Gap:                             <what it took to get from input to output>
Difficulty:   easy (copy / map) | hard (needs judgement)      → hard ⇒ becomes or joins an HP card
Confidence:   sure | uncertain (Innocent to check)            Checked: Innocent ✓ YYYY-MM-DD
```

**Rules.** Choose samples on purpose: every source, every type, the strange ones. Twenty easy samples
make everything look easy. Real data that cannot be had yet is replaced by a realistic stand-in
marked `synthetic: yes` with the assumption it encodes, and rechecked when real data arrives.
Client or personal data is redacted or kept out of the repo (record where it lives).

**Gate:** every core workflow has worked pairs (full: 5–10 total; light: 3); the HTML review page
is current and passes the check; every uncertain pair checked by Innocent.

---

## §3 Hard problems ★

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| Hard-problem register (source of truth) | `docs/design/hard-problems.md` | Claude | Innocent |
| Stage 3 visual review page | `docs/artifacts/YYYY-MM-DD-hard-problems.html`: a visual synthesis built *after* the register. It opens with *the story so far* and a map of where each HP sits in the user's journey, then one card per HP (HP-1 orchestration first). Each card starts with *where this comes up in the project*, *the problem we're solving* and *why it's hard* (`data-hp`, `data-part`), then the options as small diagrams, the recommendation, the consequences of each option, the status and the evidence pairs, plus the *Handled by default* list. Per `references/visual-review-pages.md`; passes the check | Claude | Innocent works through it |
| Diagrams | `docs/design/diagrams/HP-N-*.excalidraw` (or inline SVG in the page) | Claude | — |

**Card format (one per `HP-N`; `HP-1` is always orchestration):**

```
HP-2  Resolution-criteria extraction across venues
What it is (plain words):  ...
Evidence:                  WP-3, WP-7 (input beside required output)
Why it's hard:             ...
Options:                   A ... | B ... | C ...   (each with a diagram)
Recommendation:            B, because ...
Principles that apply:     GP-44, GP-72, ...
How we'll know it worked:  metric + threshold, scored on WP-3, WP-7 (seeds the eval plan)
Status:  open → chosen (Innocent ✓ date) | needs spike (→ SP-N) | proven (SP-N)
```

The register ends with **Handled by default** — one line per easy problem, so it's visible that it
was considered.

**How cards are found:** the gaps in the worked pairs, plus every *Raise in the design conversation*
question in `docs/principles/system-design.md` that the docs can't yet answer.

**Gate:** HP-1 orchestration has a card; every `hard` worked pair maps to a card; Innocent has
been through the current visual page (check passes).

---

## §4 Interview ★

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| Interview document | `docs/prd/interview.md` (or where `prd-interview` records it) | `prd-interview` | Innocent answers |
| Decision record | The project's convention (e.g. PRD §13); each HP choice gets a decision entry | Claude | Innocent |
| Approved PRD | `docs/prd/<project>-prd.md` | Claude | **Innocent approves** |

Feed the interview the register: it records the choices made on the page as decisions and does not
re-ask them; its remaining questions are the quick facts.

**Gate:** PRD approved; interview completion gate passes.

---

## §4b UX/UI ★

Starts the moment the PRD is approved: functionality, scope and problem are now fixed, so the UI
can be researched and designed against them rather than guessed.

> **Three tracks after UX-1 (2.0.0, Innocent 2026-10-25; `proposals/2026-10-25-concurrent-frontend.md`).**
> UX-1 is linear; its gate is the **fork**. From there three tracks run at the same time:
> - the **UX track**: UX-2 visual direction → UX-3b screens and tokens → FW foundation wave;
> - the **Joint track**: UX-3a, the shared contracts, starting right after UX-1;
> - the **System track**: §5 spikes → §6 design.
>
> Nothing in the UX track waits for §5 or §6, except that feature tickets need the §6 gate (§7). **No full
> prototype is built before tickets.** The frontend is built in §8 as tickets, against mocks generated from the
> agreed interface spec. UX-4 is optional and focused on one named interaction question. UX-5 splits into UX-5a
> (checks during the build) and UX-5b (final acceptance before §9). Worked example of the reference research:
> `inno-houseaccount/docs/design/ui-design-reference.md` + `docs/design/references/`.

> **PILOT (2026-10-18; v2 2026-10-25): the `ux-pipeline` skill** (`.claude/skills/ux-pipeline/`) runs this stage
> as the gated phases below (the PRD stays §1–§4's), with the ID chain REQ → US → FLOW → SCR → **CON** → TEST.
> A project in the pilot follows the skill's layout (stories → `docs/ux/01-planning/`, references →
> `docs/ux/02-concepts/`, structure → `docs/ux/03-structure/`, contracts → `docs/contracts/`, verification →
> `docs/ux/05-verify/`; `design.md` stays `docs/design/design.md`). Projects outside the pilot use the paths in
> the tables below. Each gate has a visual review page, `docs/artifacts/YYYY-MM-DD-ux-<phase>.html`, built per
> `references/visual-review-pages.md`. Promote or drop after the pilot retro.

### UX-1 · Stories, flows, states (the fork)

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| User stories | `docs/ux/01-planning/USER_STORIES.md` (or `docs/prd/user-stories.md`) | Claude | — (Claude closes the gate) |
| Flows, with each step's **states, permissions and recovery paths**, and a draft `CON-N` on every data step | `docs/ux/01-planning/USER_FLOWS.md` | Claude | — |
| Sitemap | `docs/ux/01-planning/SITEMAP.md` | Claude | — |
| Open behaviour questions (`UXP-N`), listed where they can be seen, each routed to the UX-3a card it affects | the open `UXP-N` list in `docs/ux/01-planning/` | Claude | Innocent decides them at UX-3a |
| UX-1 review page | `docs/artifacts/YYYY-MM-DD-ux-1.html` (journeys, flows, sitemap as diagrams, the CON list, the open UXP list) | Claude | Innocent reads it when he chooses |

**User-story format (one per `US-N`):**

```
US-3  ·  PRD: R-4  ·  evidence: WP-2  ·  HP: HP-3 (if any)
As a <who, from the PRD's users>, I need <what>, so that <why, tied to a PRD metric>.
Acceptance: <observable result, in the user's words>
Screen: <which screen/state carries it>
```

Every core PRD flow has at least one story; a story with no PRD requirement behind it is scope creep
and goes back to Innocent.

**Gate (the fork; Claude ticks it, no sign-off, since 1.12.0):** every core PRD flow has a story; every flow step
has its states, permissions and recovery path; every unresolved behaviour question is a listed `UXP-N` routed to
UX-3a; `trace_check --upto FLOW` passes; the UX-1 review page is built and `check_review_page.py` passes. Innocent
reads the page when he chooses, and anything he raises reopens UX-1.

### UX-2 · Visual direction ★ — UX track

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| Feel brief (feel, interaction shape, analogous products; style searches never use the industry's name) | `docs/ux/02-concepts/FEEL_BRIEF.md` | Claude | — |
| Reference research + captured images | `docs/design/ui-design-reference.md` (or `docs/ux/02-concepts/REFERENCES.md`), images in `docs/design/references/` (or `docs/ux/02-concepts/references/`) | Claude | Innocent reviews |
| A look sheet for each of **4 directions** that differ at a glance (credited references, light + dark palette with computed contrast, 3–4 static mockups of core screens on real flow copy) | `docs/artifacts/YYYY-MM-DD-<direction>-look-sheet.html` (`ux-pipeline` `templates/LOOK_SHEET.md`) | Claude | — |
| Representative screens in the picked direction | `docs/ux/02-concepts/` | Claude | — |

Lightweight linked screens (static screens joined by links) **may** help a choice. They are never a mandatory
application and never become the product.

**Reference research — what the doc must hold** (the HouseAccount shape):
1. **What was examined, and how** — 2–4 real products whose screens solve a similar job, each driven
   live (Chrome DevTools MCP; desktop ~1440 and phone ~390 width), with the date.
2. **Reference images** — screenshots captured live, named `<product>-NN-<what>.jpg|png`, compressed
   (≈1600px JPEG for full screens, PNG crops for components), with a table: file · what it shows · why it is
   kept. Marked *internal design reference only* — never in the product, demo video or published material.
3. **Reference analysis** — per product: what a visitor actually experiences, how it is built, why it
   works, and **what does not fit our product** (privacy, scope, PRD exclusions). Every finding tagged
   **[O]** observed live, **[D]** vendor-documented, **[P]** our proposal.
4. **Design directions [P]** — per direction: one-line intent, visual identity, layout sketch, information
   hierarchy, desktop vs phone, the minimal build sized to the time box. Each is shown as a static **look
   sheet**, and Innocent picks from the sheets.
5. **Reference → product mapping** — pattern · source · our application · why · confidence, rejections
   included.
6. **Interaction model** — the stories walked as steps on the screens, including empty, loading,
   partial, error and stale states.
7. **Not verified** and **decisions that must stay open** — what could not be seen, and each open
   question with who/what unblocks it.

**Gate:** the reference doc has live-captured images and a mapping table; every direction shown has a look sheet;
Innocent picked a direction (his words and the date in the checklist).

### UX-3a · Shared contracts ★ — Joint track

Starts **right after UX-1**, alongside UX-2, §5 and §6. UX defines what the experience needs; system design
establishes how those promises are kept. One canonical interface spec per project:

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| Behavioural contract cards (`CON-N`) | `docs/contracts/INTERFACE.md` (`ux-pipeline` `templates/INTERFACE.md`) | UX side (needs) + System side (support) | both sides review each card; **Innocent** decides product-behaviour questions |
| Machine form of the same promises; each operation names its `CON-N` | `docs/contracts/interface.openapi.yaml` | either side, in step with the cards | — |
| Change log (`CHG-N`) | `docs/contracts/CHANGES.md` (`ux-pipeline` `templates/CHANGES.md`) | whoever proposes the change | both sides; Innocent for product meaning |

**What a card holds**, where it applies: operation(s), fields, states, permissions, named errors, recovery,
guarantees (e.g. "Approve pins the snapshot hash; a stale pin returns 409 and changes nothing"), timing (e.g.
"checks re-run within 5 s of a store"), the screens and stories that need it, the backend owner, and a status:
`draft` → `proposed` → `agreed`, or `changing` while a change is under way. Product behaviour is kept apart from
presentation: moving a summary into a sidebar is presentation; adding a reservation or changing what "approved"
means is behaviour.

**Ownership.** The UX side owns the *needs* (which operations, fields, states and errors a screen requires). The
System side owns the *support* (feasibility, guarantees, timing, the errors it can promise). A card is `agreed`
when both sides have reviewed it (a named reviewer each, dated) and every product-behaviour question in it has
Innocent's decision. In a one-person project both reviews may be the same session, but they are recorded
separately.

**Change procedure** (any change to an `agreed` card, including a change in meaning that leaves the schema the same):
1. **Identify** the changed promise: `CON-N`, the aspect (operation, field, state, permission, error, recovery,
   guarantee, timing), and whether it is presentation-only or behavioural.
2. **Review consequences:** both sides review; a change to product meaning goes to Innocent.
3. **Update the sources:** `INTERFACE.md`, the OpenAPI file, the DO-4 links, the screen specs.
4. **Mark** affected design sections, tickets, code and evidence `reconcile: CHG-N` until each is reconciled.
5. **Unrelated work continues.** Only work citing the changed `CON-N` waits.

Schema validation alone does not catch a behavioural change, so every change gets a `CHG-N` with its aspect, even
when the OpenAPI file is unchanged. **Old layout:** a project that already has `docs/ux/03-structure/UI_CONTRACTS.md`
keeps it as a pointer to `docs/contracts/`, or migrates it.

**Gate (per card):** a card is `agreed` before anything relies on it: both reviews named and dated, no open
`UXP-N` or other product-behaviour question in it, the OpenAPI file lints and the Prism mock starts from it, and
every operation names its `CON-N`; `trace_check --upto CON` passes for the cards marked agreed.

### UX-3b · Screens and tokens ★ — UX track

**Precondition:** the UX-2 pick.

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| Information architecture | `docs/ux/03-structure/IA.md` | Claude | Innocent |
| Screen specs (`SCR-N`) with every state; each names the `CON-N` it uses | `docs/ux/03-structure/SCREEN_SPECS.md` | Claude | **Innocent, per wave allowed** |
| Design doc with design tokens, in the chosen direction | `docs/design/design.md` (UI-2 template, `.claude/rules/ui-process-and-design-doc.md`) | Claude | **Innocent** |

**Gate:** Innocent signs the screen specs for the screens in a wave (signing one wave at a time is allowed); every
signed `SCR-N` names its contracts; `design.md` holds the tokens. An unsigned screen spec for one feature never
blocks otherwise-ready backend work.

### FW · Early frontend foundation wave — UX track

**Precondition:** the UX-2 direction is picked **and** the design tokens are written in `design.md`. Runs while
§5–§6 continue; it does **not** need the §6 gate, because it is presentation only (Innocent approved this path,
2026-10-25).

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| Foundation readiness record | `docs/plans/foundation-wave.md` (`ux-pipeline` `templates/FOUNDATION_WAVE.md`) | Claude | — |
| Presentation examples (`PE-N`), the acceptance examples for this work | inside each FW ticket spec | Claude | — |

The readiness record states: the frontend **stack** and the decision it comes from; the **owned files** (paths only
this wave touches); the **bounded scope**; the **dependencies**; the **ticket specs** (one per ticket, in the §7b
format); and the **review requirements** (code review, accessibility check, visual check against the look sheet and
`design.md`).

**Eligible:** design tokens, typography, basic accessible components (button, link, input, badge or status pill,
banner, card, table, tabs, stepper, dialog shell), layout primitives (app shell, sidebar, page header, split panes).
**Not eligible** (these take the normal feature path): anything that depends on behaviour, such as permissions,
autosave, resumability, booking or job state, data fetching, backend error recovery or real-time collaboration.

**Presentation examples, not invented backend pairs.** For example: "the primary button meets 4.5:1 text contrast
on the panel in light and dark; its focus ring is visible at 3:1; its disabled state says so in text"; "a status
pill shows text and shape for every state"; "the component gallery has 0 serious axe violations"; "the gallery at
1280 px matches the look sheet's palette and radius tokens".

**Gate:** per ticket, as in §8 (lanes, plan → implement → test → review, affected tests); each FW ticket passes
`scripts/ticket_readiness.py` before it starts.

### UX-4 · Focused interaction prototype (optional)

Only for a **named interaction uncertainty**, e.g. "does live co-editing plus a frozen Submit confuse reviewers?".
When there is none, the checklist records `n/a — <reason>`. **Never a prerequisite for tickets.**

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| Prototype plan: the named question, what is built to answer it, how Innocent will judge it | `docs/ux/04-prototype/PROTOTYPE_PLAN.md` | Claude | — |
| The focused prototype | `docs/ux/04-prototype/` | Claude | Innocent judges the named question |

**Gate:** Innocent's judgement of the named question is recorded, or `n/a — <reason>` is recorded.

### UX-5 · Verify — UX-5a during the build, UX-5b final acceptance ★

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| UX-5a per frontend slice in §8: traceability, accessibility (axe at 1280/390, light and dark), visual check against the look sheet and `design.md`, behavioural checks against the `CON-N` cards (Playwright) | `docs/ux/05-verify/TRACEABILITY.md`, `screenshots/` | Claude | — (part of the slice's evidence) |
| UX-5b final acceptance on the connected application: Innocent's walkthrough, Lighthouse, the QA report | `docs/ux/05-verify/QA_REPORT.md` | Claude | **Innocent** |

**Gate:** UX-5a evidence exists for every merged frontend slice; UX-5b signed by Innocent before §9 and §10.

**Products without an end-user UI** (a library, pipeline or API): the stage still runs, on the
surface a reviewer or operator actually sees — demo page, CLI output, audit/log view, admin panel.
Skipping it entirely needs a written reason in the checklist's *Skips*.

---

## §5 Spikes

**Precondition:** the fork (PRD approved and the UX-1 gate closed by Claude). Runs in the **System-track
session**, alongside UX-2, UX-3a and UX-3b; it never waits for a screen. A spike result that changes what a screen
needs, or what the backend can promise, is a contract change: it goes through UX-3a's change procedure (`CHG-N`).

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| Spike record (one per `SP-N`) | `docs/analysis/spikes/SP-N-<slug>.md` | Claude | Innocent reads the result |
| Scoring harness | committed on the spike base branch before any option is built; SHA recorded in the SP record | Claude | — |
| Throwaway code | one `spike/SP-N-<option>` branch per option, built **in parallel by fan-out agents** — never merged as product code; archived as `archive/spike/…` | Claude (builder agents) | — |

**How spikes are built (v1.3.0):** fan-out, light testing — the procedure is
[`references/spikes.md`](references/spikes.md). Options are built concurrently, one agent per
option, against one frozen scoring harness; the orchestrator re-runs the harness on every branch;
no review gates because nothing merges. Compute-heavy spikes run on the VPS.

**Spike record:** question · the HP it decides · options · measures and pass line (written first) ·
time box · harness SHA · comparison table (option × measure) · result · decision → the HP card's
status becomes `proven (SP-N)`.

**Gate:** every HP card is `chosen` or `proven`. No card is `open`.

---

## §6 Design

**Precondition:** the §5 gate, still in the System-track session. **DO-4 (component contracts) consumes the shared
contracts:** it links each internal contract to the `CON-N` card it serves in `docs/contracts/INTERFACE.md`, adds
internal signatures, and never repeats or contradicts a card's promise. Where a card is not yet `agreed`, DO-4
marks the link as resting on a draft. The frontend stack is the house default (`ux-pipeline`
`references/tooling.md`) unless a recorded decision says otherwise; §6 and the FW readiness record cite the same
decision. **The §6 gate still comes before ordinary feature implementation**; only FW presentation work may start
before it.

**Questions first (`system-design-questioning.md`, added 1.7.0).** Before DO-1 is drafted, Innocent
answers the foundation questions: SD-3.1 load target and scale path, SD-3.4 peak and concurrency, SD-7.2
failure to survive, SD-1.6 spend ceiling, SD-1.9 hardest uncertainty. Each is asked in the story → options →
**Decision needed** format and recorded before use. A test load, a default or a public count is never an answer.
If he is away, only the parts that don't depend on an open answer are drafted. New choices that surface while
designing become `SDQ-N` questions the same session; non-foundation ones may be drawn as labelled proposals
with a `data-ask` card on the Stage 6 page.

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| Readiness report | Where `system-design-readiness` writes it | Claude | READY verdict |
| DO-1…DO-7 (system design, architecture, code design, component contracts, evaluation plan, observability contract, key-metrics registry) | Locations in the interview's *Artifact map*; default `docs/design/` | Claude | Innocent reviews DO-1, DO-2 |
| Stage 6 visual review page (added 1.5.0 on the VPS, 2026-10-19; merged in 1.6.0) | `docs/artifacts/YYYY-MM-DD-system-design.html`: built *after* DO-1…DO-7. A study guide, story first: system map with trust boundaries, one request traced with its time budget, load and bottleneck findings (today and at the scale target), the scale path, every major decision with its reasoning, every DO-1/DO-2 finding in full, open items as `data-ask` cards, the approval request. Per `references/visual-review-pages.md` (incl. *Write it as a story*); passes the check | Claude | Innocent reviews it with DO-1/DO-2 |

**Required inside DO-3 (code design), added 1.10.0:** written to `.claude/rules/code-design-solid-modularity.md`.
For each module: its one-sentence responsibility, the interface it exposes, what it depends on and which way the
dependency points (core depends on abstractions; adapters wrap every external system), and its owner area. Each
candidate seam is marked **cut** or **deferred** with one line of why: strive for modularity where a seam pays
(a second known variant, a volatile external system, policy apart from mechanism), never speculatively. Then
`metz-code-design-agent` reviews DO-3 and DO-4 and writes `docs/design/reviews/YYYY-MM-DD-code-design-review.md`;
its Blocking findings are fixed (or put to Innocent) before the Stage 6 page is built. These module boundaries are
what §7 cuts parallel waves along.

**Required inside DO-5 (evaluation plan):** the worked pairs as the first development set; each HP's
"how we'll know it worked" as an eval criterion; the rule that experiments open with error analysis.

**Code design feeds the context system.** The code-design map (DO-3) is mirrored into `.claude/reference/area-map.md`
with a provenance header (extracted from, as of, authority) and every planned path labelled planned; the router
(`.claude/README.md`) gets a row per area, and rule `paths:` are set from it (`icm-project` Phase 2, coding branch).
The ICM "code design" row is updated with a link to both.

**Then rebuild the entry (1.8.0).** Once the area map exists, re-run `icm-project` Phase 3: rebuild `CLAUDE.md`
and the router from icm-project's `references/entry-template.md` against the area map. The entry links the area
map and decision record; it never carries a code map, current state or decision summaries. Walk the fresh-context
route walkthrough and mark that ICM row verified with the date.

**Signature completeness and a spec dry run, before the gate (1.14.0).** A §7 spec writer can only write testable
acceptance criteria against types that exist. Check, and record the result in the readiness report
(`system-design-readiness` `DESIGN-OUTPUTS.md` → *Before the ticket-ready gate*):
1. every cross-area call in DO-3's build-areas table has a DO-4 signature with field-level result types (no bare
   `dict`, `Any` or "returns the result");
2. every service and adapter has its constructor (what it is built from and who builds it);
3. every error code the shared interface spec (`docs/contracts/interface.openapi.yaml`) names maps to a DO-4 error type;
4. every record DO-6 requires has a storage location (table or file);
5. every typed settings field a consumer needs is named.

Then the **spec dry run**: one agent writes the acceptance criteria for three representative tickets (one service,
one route, one graph node, or the project's nearest equivalents) from the design alone. Whatever it cannot write
testably is a design gap, closed in DO-3/DO-4 before the gate, not left for 7b. Why: on AEA the 7b spec writers
raised ~170 needs-decision items, mostly missing signatures and types, all found after §6 was signed.

**Run the signature check mechanically (1.14.1).** Checks 1, 3 and 4 above are a script, not a read-through
(`system-design-readiness` `scripts/signature_check.py`). From the repo root, with the paths the design-outputs
register gives (defaults shown):

```bash
python3 "/home/linuxuser/workspaces/Gauntlet AI/.claude/skills/system-design-readiness/scripts/signature_check.py" \
  --code-design docs/design/code-design.md \
  --contracts docs/design/component-contracts.md \
  --observability docs/design/observability-contract.md \
  --openapi docs/contracts/interface.openapi.yaml
```

(Older projects pass `--openapi docs/ux/03-structure/ui-contracts.openapi.yaml` until they migrate.) It exits 0 only when it finds nothing: no unsigned module, no undefined return type, no OpenAPI error code without
a DO-4 error type, no DO-6 record without storage. Each finding is fixed in DO-3, DO-4 or DO-6 and the script re-run;
the clean result line and its date go in the readiness report and the checklist. Checks 2 and 5 (constructors,
settings fields) stay judgement items for the spec dry run to catch.

**File the spec dry run (1.14.1)** at `docs/design/spec-dry-run.md`, from `templates/SPEC-DRY-RUN.md`: the three
sample specs as the agent wrote them, and under each, every criterion it could not write testably with the missing
fact named. Each of those is a design gap, closed in DO-3/DO-4 (and marked closed in the file, with where) before the
gate. Why a file: on AEA the gaps lived only in spec writers' reports, so nobody could see they were design gaps.

**Coverage requirements sweep, at §6 (1.14.0).** Draft `to-tickets`' mandatory-requirements table
(`references/coverage-audit.md`) now, against DO-6's workflow registry, and fix what it shows in the design
registers rather than in tickets: every entry point (route, script, job, demo login) has a `WF-n`, every
requirement's *Applies to* names registered workflows, and every DO-7 metric is inherited by at least one workflow.
The table carries forward to 7c. Why: on AEA the demo login had no `WF-n` (it became WF-18) and M-2/M-29 belonged to
no workflow; both surfaced only at §7.

**Gate:** `design_outputs.py check <register> --gate tickets` passes; `signature_check.py` (command above) exits 0 and
the signature-completeness check is otherwise clean; `docs/design/spec-dry-run.md` exists with its three sample specs
and every could-not-write item closed in DO-3/DO-4; the coverage requirements sweep found no unregistered entry point and no metric without
a workflow; the area map exists and agrees with DO-3;
the code-design review's verdict is PASS (no open Blocking finding);
DO-4 links every `CON-N` it serves and agrees with the agreed cards (none it relies on still `draft` or `proposed`,
none marked `reconcile: CHG-N`); Innocent has reviewed the **current** Stage 6 page (check passes; inspected at laptop and phone width);
the entry was rebuilt, `~/.claude/skills/icm-project/scripts/check_context.py <repo>` reports no FAIL, and the ICM walkthrough row is verified.

---

## §7 Tickets — four separate passes ★

**Readiness is per ticket, not per track (2.0.0).** Every §2–§5 gate is passed, and then each ticket is ready
when the conditions for its kind hold:

| Ticket kind | Ready when | Does **not** need |
|---|---|---|
| **Backend feature** | §6 gate ticked **and** every `CON-N` it serves is `agreed` | UX-3b, UX-4, UX-5 |
| **Frontend feature** | §6 gate ticked **and** its screen spec (`SCR-N`) is signed **and** every `CON-N` it uses is `agreed` | a UX-4 prototype; UX-5 acceptance |
| **Integration** | *Planned* any time, with explicit dependencies; *executed* once the frontend and backend tickets it joins are merged against the same agreed `CON-N` | — |
| **Foundation (FW)** | UX-2 direction picked **and** design tokens written **and** the foundation readiness record exists (§4b FW); scope inside the eligible list | the §6 gate (it is presentation only) |
| `lane::direct` / `lane::human` / `lane::spike` | as before (`ticket-lanes`) | — |

**Check it mechanically.** Before a ticket is published as ready or handed to a builder, run
`python3 scripts/ticket_readiness.py check <ticket.json> --root <repo>` (path relative to this skill). The ticket
JSON gives `id`, `kind` (`backend`, `frontend`, `integration`, `foundation`), `cons` (`CON-N` list), `screens`
(`SCR-N` list), `depends_on` (ticket ids) and `scope` (strings). It reads the checklist gates, the statuses in
`docs/contracts/INTERFACE.md`, the screen-spec sign-offs and the foundation readiness record, and exits 1 naming
each missing condition. Examples: a frontend ticket for SCR-14 whose `CON-18` is still `proposed` (because "who may
reopen", UXP-4, is undecided) is **not ready**, reason `CON-18`; a frontend ticket for SCR-4 with §6 ticked, SCR-4
signed and `CON-3`/`CON-4` agreed, and no UX-4 or UX-5, is **ready**; an FW ticket listing "autosave" in its scope
is **not ready** (outside foundation scope); a backend ticket before §6 is **not ready**, reason "§6 gate".

A contract changed after tickets exist marks every ticket that cites it `reconcile: CHG-N`; only those wait.

**Models (1.14.0).** 7a–7c run on **Opus**, with the `to-tickets` skill invoked explicitly (not paraphrased from
memory); fast evidence sweeps (grepping the design for a signature, listing CON or `WF-n` IDs) may run on **Haiku**;
**Sonnet** only for §8 implementers and reviewers. Why: AEA's first slicing ran on Sonnet and Innocent had it redone.

| Pass | Artifact | Path | Signs off |
|---|---|---|---|
| 7a Slice plan | **Product-wide**: ticket titles, waves, one line each, each ticket's **kind** (backend, frontend, integration, foundation), its US, HP, `CON-N` and `SCR-N` links, cut along DO-3's module boundaries for **maximum safe parallelism**; every integration ticket names the frontend and backend tickets it joins; ends with `to-tickets` §2a's **parallelism audit** (every edge tested "needs the blocker's result?", edges removed and why, human/external gates in wave 0, shared shells and contracts in an early wave, critical-path length, widest wave, any large critical-path ticket split) and the **collision map** for every wave of two or more; each ticket's **lane** (`ticket-lanes`: build-loop, direct, human, spike) with the lane split stated, and `risk::security` on every ticket where a bug in it could leak data, grant access, expose a secret or open the system to an attacker (count stated) | `docs/plans/slice-plan.md` | **Innocent** |
| 7b Spec, one wave at a time | GitLab issues; each opens with its **user story (US-N)**, carries **a real example input + its expected output (WP-N)** (presentation work: its **PE-N** presentation examples instead), cites the `CON-N` it serves or uses and, for UI work, its signed `SCR-N`, and links its HP card; hard problems with residual uncertainty become spike-style tickets with written decision criteria; each wave's tickets pass `ticket_readiness.py` before they are marked ready | GitLab | — |
| 7c Coverage audit | `to-tickets` coverage audit, product-wide (every story, screen and agreed CON covered by a ticket) | `docs/plans/coverage-audit.md` (or the template's location) | Claude, findings to Innocent |
| 7d Publish | Issues live, waves, kinds and lanes labelled (exactly one `lane::` per issue) | GitLab | — |

**Gate:** 7a–7c run on Opus via `to-tickets`; the slice plan is product-wide and signed off **with its parallelism
audit and collision map present** (and re-run after 7c repairs); every ticket has exactly one lane label and one
kind; every ticket marked ready passes `ticket_readiness.py`; coverage audit clean; every user story is covered by a
ticket; no ticket without a story and an example (WP-N, or PE-N for presentation work) unless it states why none
applies (e.g. pure infrastructure).

---

## §8 Build

Builds the frontend **and** the backend. Frontend tickets work against Prism mocks generated from
`docs/contracts/interface.openapi.yaml` while the backend is built; integration tickets join the two once both
sides are merged against the same agreed `CON-N`.

| Artifact | Path | Notes |
|---|---|---|
| Tests from worked pairs and presentation examples | `tests/` | A ticket's WP-N (or PE-N) is one of its tests: written by the implementer with the code; for a `risk::security` ticket, frozen by `test-writer-agent` before the implementation |
| Frontend code | the project's frontend folder | Built from the signed `SCR-N` and `design.md` tokens; types generated from `interface.openapi.yaml`; runs on the Prism mock until its integration ticket lands; mock-only machinery stays in a dev-only layer |
| Backend code + contract tests | repo | Contract tests run against the same `interface.openapi.yaml` the mocks come from |
| Integration | repo / MR | Points the frontend at the real backend for the `CON-N` it joins; the UX-5a behavioural checks rerun against the real backend |
| UX-5a evidence per frontend slice | `docs/ux/05-verify/TRACEABILITY.md`, `screenshots/` | Traceability, axe at 1280/390 light and dark, visual check against the look sheet and `design.md`, behavioural checks against the CON cards |
| Code + review evidence | repo / MR | Only `lane::build-loop` tickets enter the loop; a wave's `lane::direct` tickets go to one general agent each at the same time, with no build-loop gates (`ticket-lanes`). Every dependency-ready build-loop ticket in a wave is built **at the same time**, one planner → implementer pair each (`fanout-plan-then-implement`, or the project's own pair), inside the collision map's file ownership; plan → implement → test → `code-review-agent` (`test-writer-agent` first only for `risk::security`); each role runs only the affected tests and the merge runs the tests affected by everything merged; the full suite only when a change reaches everything and before each deploy (`.claude/rules/build-loop-test-scope.md`) |
| Dev log | the project's devlog convention | milestone entries |
| Context reconciliation | `.claude/reference/area-map.md`, `.claude/README.md`, rule `paths:`, `.claude/state/icm-progress.md` | Same change as the code that moved the ground (`rules/context-maintenance.md`); planned → actual; ICM rows get dated evidence |

**Gate:** per ticket, the ticket's own acceptance tests (and UX-5a evidence for a frontend slice); per wave, the seam
audit, `security-privacy-agent` on the wave's `risk::security` diffs (only when the wave has one), and a check that
the area map matches the checkout; no merged work still marked `reconcile: CHG-N`. **UX-5b** (Innocent's final
acceptance of the connected application, §4b) follows the build and comes before §9.

---

## §9 Experiment ★

| Artifact | Path | Drafts | Signs off |
|---|---|---|---|
| Experiment kickoff page | `docs/artifacts/YYYY-MM-DD-experiment-kickoff.html` — **generated from the code**: current flow diagram, prompts verbatim with versions, the chosen approach (HP link), failure types so far | Claude | Innocent reads before any tuning |
| Error analysis | `docs/testing/error-analysis/YYYY-MM-DD-round-N.md` — ~20 traces, the **first** failure in each, grouped into `FT-N`; a table of models × failure types ("what is everyone getting wrong") | Claude drafts | **Innocent reviews the taxonomy** |
| Experiment records | `docs/testing/experiments/XP-N-<slug>.md` — target `FT-N` · the one change · score against the frozen set · decision | Claude | Attended with Innocent |

**Rule:** no prompt, model or parameter change before the error-analysis round that names the
failure type it targets. One change per experiment.

**Gate:** each XP cites an FT; the frozen set is never edited to make a result pass.

---

## §10 Ship & defend

| Artifact | Path | Signs off |
|---|---|---|
| Submission tracker walked | `SUBMISSION.md` | Innocent |
| Demo script (two-layer order) | `docs/delivery/` | Innocent |
| Demo decision inventory (hiring partner): pillars + business/technical/research decisions, each with source path, built from dev logs and decision records before narration is written | `docs/delivery/YYYY-MM-DD-demo-decision-inventory.md` (rule `hiring-partner-framing` → *Demo video*) | Innocent |
| Interview prep | `docs/delivery/` or `Gauntlet AI/prep/` | Innocent |
| Retro | `docs/analysis/YYYY-MM-DD-retro.md`; lessons also go back into `Gauntlet AI/principles/` (new GP or note) and this skill | Innocent |

**Gate:** every tracker row has evidence at the path the rubric expects; retro written.
