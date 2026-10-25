# The phases (pilot v2, 2026-10-25)

**The PRD is not a phase here.** Zero-to-hero §1–§4 write and approve it, and the project checklist
does not open §4b until the §4 gate (*PRD approved*) is ticked. So every phase below starts from an
approved PRD. A UX gap check can feed the §4 PRD interview beforehand (template `UX_GAPS.md`), but it
is an input to §4, not a gate of its own. (Innocent, 2026-10-18.)

**The order since v2** (`zero-to-hero/proposals/2026-10-25-concurrent-frontend.md`, approved by Innocent):

```
UX-1 Planning (the fork, Claude-closed)
 ├─ UX track:     UX-2 Visual direction★ ─► UX-3b Structure★ (per wave) ─► FW foundation wave
 ├─ Joint track:  UX-3a Shared contracts★ (starts right after UX-1, alongside §5–§6)
 └─ System track: §5 Spikes ─► §6 Design★
                     ▼ per-ticket readiness
 §7 Tickets★ ─► §8 Build (frontend + backend on mocks of the agreed contract; UX-5a runs here)
 ─► UX-5b Final acceptance★ ─► §9 ─► §10
 UX-4 Focused interaction prototype: optional, any time a named uncertainty needs it
```

Each phase: what goes in, what Claude does, what comes out, when it is done, and what Innocent decides.
"Done" is a checkable state, never "the files exist". Light mode (a 1–3 day build) keeps every gate and
cuts volume: one reference product per core flow, two concepts instead of three, wireframes for the
core screens only. It never drops a direction's look sheet (UX-2): those are the cheap step.

---

## UX-1 · Planning  (the fork)

- **In:** the approved PRD (§4 gate ticked), the worked pairs (§2), the hard-problem register (§3), and
  any UX gaps raised at §4.
- **First:** confirm the §4 gate is ticked. A gap found while planning becomes a question for Innocent,
  never a silent assumption. If the answer changes the PRD, the PRD changes first, as the owner of
  that fact, and the §4 gate reopens.
- **Claude:** writes the following.
  - **User stories** (`US-N`), each tracing to a requirement ID (`M-NN`, `SOL-NN`, a rule, or `R-N`).
  - **Journeys:** one per user type, as Mermaid `journey` or `flowchart` with swimlanes.
  - **Flows** (`FLOW-N`): steps, decisions, error branches, and the state each step leaves behind.
    Every step that reads or writes data names a draft `CON-N`. Each flow also says:
    - **states:** what the user can see at each step (empty, loading, partial, stale, done…);
    - **permissions:** who may do the step, and what someone without permission sees;
    - **recovery paths:** how the user gets back on track after each error branch, and what is kept.
  - **Sitemap:** screens (`SCR-N`), entry points, and how each screen is reached.
  - **Draft capability needs:** the draft CON list (name + one line each), written straight into
    `docs/contracts/INTERFACE.md` with status `draft`. This is the UX side's first statement of needs.
  - **Open behaviour questions (`UXP-N`)**, listed visibly in `USER_FLOWS.md` under
    `## Open behaviour questions`: anything the flows depend on that is not yet decided. Example:
    *UXP-4 · Who may reopen an approved lesson: only the approver, or any reviewer?* Each names the CONs
    and flows it affects and is routed to UX-3a. Never resolve one silently in a flow.
- **Out:** `01-planning/USER_STORIES.md`, `USER_FLOWS.md` (with the `UXP-N` list), `SITEMAP.md`, all with
  Mermaid source; draft cards in `docs/contracts/INTERFACE.md`.
- **Done when:**
  - every in-scope requirement has ≥ 1 story;
  - every story maps to ≥ 1 flow;
  - every flow ends at a reachable screen in the sitemap;
  - every flow names its states, permissions and recovery paths;
  - every error branch the brief names has a flow (OCR failure → manual, partial extraction,
    double-booking, bad upload, withdrawal);
  - every open behaviour question is a `UXP-N` with its affected CONs;
  - `trace_check.py --upto FLOW` passes.
- **Gate (Claude closes it, no sign-off):** *does the experience make sense?* The review page still
  gets built: the journeys, the flows and the sitemap as diagrams, the draft CON list and the open
  `UXP-N` list, with `check_review_page.py` passing. **Claude does not stop for Innocent's approval
  here** (Innocent, 2026-10-20: "skip need approval on the flow diagram … i trust the flow that you've
  been building"). Once *Done when* holds and the page passes its check, Claude ticks the gate itself
  (`☑ … — Claude, <date>, no sign-off`), gives Innocent the page path to read when he chooses, and
  goes straight to the fork. A gap found while planning is still a question for him (*First* above), and
  anything he raises after reading the page sends the work back to UX-1 and reopens what depends on it.
  This is a standing policy, not a per-project skip, so it needs no *Skips* row.
- **This gate is the fork.** Once it is ticked, three things start at once: the UX track (UX-2), the
  Joint track (UX-3a shared contracts) and, in a second session, the System track (§5 spikes → §6
  design) from the PRD, the stories, the draft CONs, the `UXP-N` list, the hard-problem register and the
  worked pairs. Say so to Innocent at the gate.

## UX-2 · Visual direction  (feel brief, research, 4 look sheets, representative screens)

**Order changed 2026-10-18 (Innocent):** visual texture is sourced from Dribbble *before* any concept
or wireframe, so the wireframes are drawn in that texture. Drawing a neutral skeleton first and
recolouring it later produced the same "house Claude texture" every time.

**History, 2026-10-20 (Innocent, AEA call center): look before you build.** AEA's UX-2 researched three
directions (A1–A3) but built full clickable prototypes for only A1 and A2. Innocent found those two
"very similar" and picked the unbuilt A3 as "nicer on the eyes", then asked for an A4. His words:
"what i wish was that you did screenshots or fast light mockups before showing me so i can see the
colors then you can build the full full protoype". So every direction got a cheap **look sheet** first.
(Then, only the pick got a prototype; since v2 no full prototype is built at UX-2 at all.)

**History, 2026-10-25 (Innocent, Newsela): search by feel, not by industry.** Searching Dribbble for the
industry ("HVAC dashboard") returned what that industry ships today, which is often dated: "most ui's in
those industries are ugly because theyre behind, some would say the same for medical, and i always lean
towards a modern look". What an industry should *feel* like is a different thing from how its current
software *draws* that feel. So UX-2 starts with a **feel brief** (step 0) and searches more than one
source. The same day he asked for **4 directions** every time, and v2 made linked screens optional.

- **In:** the planning set, plus `design.md` if the project already has one.
- **Claude:**
  0. **Feel brief (before any search), `02-concepts/FEEL_BRIEF.md`.** The idea behind it: separate
     *what the experience must communicate* (feelings and qualities the users and the business need)
     from *how the industry currently expresses it* (its dated screens). Search for the first; use the
     industry only for content (real terms, real data). This is the design-thinking practice called
     **analogous inspiration**: look for other products that already deliver the same experience
     qualities well. Answer five questions, one short line each:
     1. **Who, where, in what state?** The user at the key moment: device, setting, stress, time
        pressure, expertise. *HVAC: a homeowner at night with a broken AC, worried and on a phone; a
        dispatcher juggling twelve jobs on a desktop.*
     2. **What must it feel like?** 3–5 adjective pairs that name a position, e.g. calm ↔ urgent,
        warm ↔ clinical, expert ↔ friendly, dense ↔ airy, playful ↔ serious. Each ties to a user or
        business reason. *HVAC homeowner: calm, reassuring, competent, warm; never alarming.*
     3. **What is the interaction shape?** The core patterns, named generically: booking, scheduling,
        status tracking, chat intake, review and approve, document editor, dashboard, map.
     4. **Who already delivers that feel, outside this industry?** 3–5 analogous products or domains.
        *HVAC → smart-home thermostats (Nest, Ecobee), modern utilities and energy apps, home-services
        booking. Medical → modern telehealth and wellness apps, fintech onboarding. Newsela's reviewer
        workspace → editorial and code-review tools (document editors with suggestions and approvals,
        pull-request review).*
     5. **What must we avoid?** The industry's dated tells (dense grey tables, stock photos,
        clip-art icons, alarm-red everywhere) and the house Claude texture.

     **Search terms** = pattern (3) + feel words (2) + analogous domain (4), and **never the industry
     name** for style searches: "service booking app calm minimal", "smart home dashboard", "energy
     app UI", "document review approval web app". The industry name may appear only in a separate,
     labelled search for content and conventions. Show the brief at the top of the UX-2 review page,
     so the directions can be judged against it.
  1. **Texture research across sources (first after the brief).** Drive each source live in the
     Chrome DevTools MCP (isolated context `<project>-ux`) with the brief's terms, adding "web app" /
     "dashboard" for desktop products. Sources and what each is for (`references/tooling.md` →
     *Reference sources*):
     - **Dribbble** (default, free): concept shots, best for texture, palette and polish; often more
       polished than anything shipped.
     - **Mobbin** or **Refero** (if Innocent has an account; both are mostly paid): screens from
       **real shipped products**, searchable by pattern; best for modern patterns that actually work.
     - **Page Flows**: recorded user flows from real products; for step order, not texture.
     - **Godly, Land-book, SaaS Pages**: marketing sites only; use them for a landing page, not app UI.
     Review every result as a contact sheet, open the strongest 4–6 at full size, and keep 10–15 with
     designer and shot URL (internal reference only). Synthesise **exactly 4 named directions**
     (Innocent, 2026-10-25: "when you're making me choose i want 4 options to choose from"), each derived
     from the feel brief and the project context, **that differ at a glance, not only in construction**
     (see the *at-a-glance check* below), each with a *component anatomy* table (canvas,
     navigation/steps, headline, conversation, bubbles or transcript, input, summary/cards, booking,
     buttons, iconography, motion), every row citing the shot it comes from. Run the *house-texture
     check* below on each.
  2. **A look sheet for every direction.** One standalone HTML page per direction,
     `docs/artifacts/YYYY-MM-DD-<direction>-look-sheet.html`, built by a small generator kept in
     `docs/artifacts/_build/<direction>-look/` (contents and checks: `templates/LOOK_SHEET.md`). It holds:
     - the direction's credited references (image, title, designer, shot URL, why it's kept);
     - palette swatches, **light first, plus dark**, with WCAG contrast **computed** from the hex
       values (never asserted);
     - **3–4 representative static screens of the core flows drawn on real flow copy** (the words from
       UX-1's flows, synthetic data), at least one repeated in dark;
     - no interactivity: no JS engine, no clicks.

     Use the **same screens and the same copy** across all directions, so the comparison is about the
     look, not the content. A look sheet should take minutes, not hours; if one grows a shared engine
     or clickable states, it has turned into a prototype, so stop and cut it back.
  3. **Innocent picks from the look sheets** (or shortlists, or asks for another direction). A new
     direction gets its own look sheet before anything else is shown. Record the shortlist and the pick
     (his words, the date) in `DESIGN-DIRECTIONS.md` and on the checklist's UX-2 pick line.
  4. **Optional: lightweight linked screens for a shortlist.** Only when the sheets alone don't settle
     the choice. Each is standalone HTML: the look sheet's CSS plus a few representative screens, joined
     by ordinary links and `#screen` anchors. **No scripted engine**: no simulated chat, no timers, no
     state machine; at most a few lines of JS for a theme toggle. Budget: under an hour per direction.
     They help make a choice; they must **not** become a mandatory full application. If the question is
     really about an interaction ("does a frozen Submit confuse reviewers?"), name it and use UX-4 instead.
  5. **Behaviour research on real products:** drive 2–4 live products (desktop width for
     desktop-first projects) for flows and patterns: intake, upload and confirm, booking, and so on.
     Capture screenshots into `02-concepts/references/` and tag each finding **[O]** observed live,
     **[D]** vendor-documented or **[P]** our proposal. Say what does *not* fit, and why. It does not
     depend on the direction, so it may run while Innocent looks at the sheets. Behaviour findings that
     change what a screen needs go to UX-3a as a need, not into a screen silently.
  6. **Concepts:** 2–3 layout ideas, each with one idea, an intent, what it is good and bad at, and
     the stories it serves best. Stitch variants are optional (`references/tooling.md`).
  7. **Wireframes in texture:** the core screens of each concept are drawn **with the chosen
     direction's component construction** (not a grey skeleton), at the project's primary width.
- **Two hard rules for showing directions:**
  - **Every direction put to Innocent gets a look sheet.** Never present an unbuilt direction next to
    built ones; a name and a paragraph lose to a page he can see, whatever their merits.
  - **Nothing heavier than a look sheet before he has seen the sheets.** Linked screens, if used, come
    after the shortlist and never with a scripted engine.
- **Out:** `02-concepts/FEEL_BRIEF.md`, `REFERENCES.md`, `CONCEPTS.md`, `wireframes/`,
  `docs/design/DESIGN-DIRECTIONS.md` (with each direction's at-a-glance values and the recorded pick) and
  `docs/design/references/`; one look sheet per direction plus its generator; linked screens only if used.
- **Done when:**
  - 4 directions were shown, each with a look sheet holding credited references, light and dark
    swatches, computed contrast and 3–4 representative screens on real flow copy;
  - the directions pass the at-a-glance check, the house-texture check and the scanning check;
  - the feel brief exists, and every style search used its terms rather than the industry name;
  - the pick is recorded; any linked screens were built after the shortlist, with no scripted engine;
  - each concept covers every core flow end to end;
  - the references have captured images and a mapping table;
  - nothing contradicts a PRD rule.
- **★ Gate:** *which direction and which concept?* The gate review page shows the feel brief, every
  direction's look sheet side by side (the pick marked, the recommendation first), links any linked
  screens, and shows the concepts side by side. Signed when Innocent has picked a direction and a concept.

### At-a-glance check (Innocent, 2026-10-20)
Directions chosen for the biggest difference in *construction* still read alike when everything a
glance takes in is the same: AEA's A1, A2 and A3 were all cool greys. In `DESIGN-DIRECTIONS.md`, give
each direction its value on five traits:
- **softness vs hardness:** radius, shadow or outline, how edges meet;
- **density:** spacing, rows per screen, size of type;
- **shape language:** pills, squares, cards, rows, rules;
- **palette temperature:** warm or cool neutrals, the accent's hue;
- **type:** display face, weight contrast.

Two directions that share three or more values are too close: change one before making its look
sheet. Then put the sheets side by side at thumbnail size; if two still look the same, they are.

### House-texture check (reject a direction that matches more than two)
The look Claude falls back to when nothing pulls it elsewhere. It is our own review-page style and
must not leak into product UI:
- a warm cream or beige canvas with a serif heading face;
- cards with a coloured left border, thin grey outlines, and identical 10–12px radii in an even grid;
- outlined pill "status badges" on everything;
- muted sage, teal or forest as the only accent, over grey-brown neutrals;
- system-ui or one "safe" sans everywhere, with no display face;
- flat surfaces with no texture, depth, imagery or motion;
- the layout skeleton of the previous project, recoloured.

### Scanning check (Innocent, 2026-10-18)
- **Left → right:** the eye moves across columns in a sentence that makes sense. For example, step
  → conversation → what we have so far. Each column's heading sits on the same baseline, and
  anything that updates on the right is visibly caused by something on the left (a linking
  highlight or motion).
- **Top → bottom:** each column reads in the order of the task, and the next action sits where that
  column ends.
- **Motion only for clarity:** animation is used to show *what to do next* (reveal the input, draw
  the eye to the chat box, show a field landing in the summary). It always respects
  `prefers-reduced-motion`.

## UX-3a · Shared contracts  (Joint track, starts right after UX-1)

**What it does, concretely.** The UX side says what each screen needs ("the approval screen must show
who approved, when, and that the lesson is frozen"). The System side says how, and whether, it can
promise that ("Approve pins the snapshot hash; a stale pin returns 409 and changes nothing"). Both
review the card. Innocent decides anything that changes what the product means ("who may reopen?").
Then the card is `agreed`, and only then may a ticket rely on it. Full detail:
`references/ui-contracts.md`.

- **In:** the draft CONs and `UXP-N` list from UX-1; screen needs as UX-2 and UX-3b sharpen them; the
  System track's spike results and §6 design as they arrive.
- **Who does what:**
  - **UX side (this session) owns needs:** which operations, fields, states, permissions, named errors
    and recovery a screen requires.
  - **System side owns support:** feasibility, guarantees, timing, and the errors it can promise.
  - **Both review each card**, named and dated per side. In a one-person project both reviews may be
    the same session, but they are recorded separately.
  - **Innocent decides product behaviour:** every `UXP-N` and any card question that changes meaning.
- **Claude:**
  - writes and maintains `docs/contracts/INTERFACE.md` (template `templates/INTERFACE.md`): one card
    per CON covering operations, fields, states, permissions, named errors, recovery, guarantees,
    timing, the screens and stories that need it, the backend owner, status and reviewers;
  - keeps `docs/contracts/interface.openapi.yaml` in step: each operation carries `x-con: CON-N`, and
    generated types, Prism mocks and contract checks all read this one file;
  - logs every change to an `agreed` card in `docs/contracts/CHANGES.md` (template `templates/CHANGES.md`)
    using the five-step change procedure, including semantic changes that leave the schema the same;
  - keeps behaviour and presentation apart: a presentation change (moving a summary into a sidebar) is
    not a contract change; a behavioural change (adding a reservation, changing what "approved" means) is.
- **Statuses:** `draft` (UX-1) → `proposed` (both sides have written their part) → `agreed` (both
  reviewed, every product-behaviour question decided) → `changing` (an open `CHG-N`).
- **Done when (per card):**
  - every aspect that applies is filled, or marked `n/a: why`;
  - every named error has a screen response, and every screen error has a code;
  - both reviews are recorded and every `UXP-N` it depends on has Innocent's decision;
  - its OpenAPI operations exist, lint, and mock (Prism starts on the file);
  - `trace_check.py --upto CON` passes for the screens it serves.
- **★ Gate (per card, not one big sign-off):** *is this promise right and supportable?* A card is
  `agreed` before anything relies on it. The review page shows the contract map (screen → CON →
  operation), each card's status and reviewers, and the open `UXP-N` decisions as decision requests.
- **Feeds:** §6 DO-4 internal contracts link to `CON-N` and add internal signatures only, never new
  external behaviour. §7 tickets cite the CONs they serve or use (zero-to-hero `ticket_readiness.py`
  reads the statuses).

## UX-3b · Structure  (after the UX-2 pick; per wave allowed)

- **In:** the chosen direction and concept; the CON cards as they stand.
- **Claude:**
  - **IA:** content hierarchy per screen, as primary / secondary / on demand. Say what must be
    visible without scrolling on a phone.
  - **Screen specs** (`SCR-N`), one card per screen:
    - its purpose;
    - its stories and flows;
    - its regions and content;
    - its components;
    - **every state:** default, empty, loading, partial, error, stale, success, disabled, plus any
      permission and recovery states its flows name;
    - its interactions;
    - its copy notes;
    - its accessibility notes;
    - **its contracts** (`CON-N`), with each CON's current status.
  - **Design direction:** already chosen at UX-2. Do **not** invent a new aesthetic here.
  - **`docs/design/design.md`** (the UI-2 template): the chosen direction made exact. Colours and theme
    (both modes) as **design tokens**, type scale, spacing, motion, and the component anatomy carried
    over from UX-2, each traced to its reference shots. The tokens are what the FW foundation wave needs.
  - A screen that needs something no CON offers sends a need to UX-3a; it never invents data.
- **Out:** `03-structure/IA.md`, `SCREEN_SPECS.md`, and `design.md`.
- **Done when (per screen):**
  - it has every state its flows can reach;
  - every data region names a CON;
  - `trace_check.py --upto CON` passes.
- **★ Gate:** *is the information organised correctly?* **Innocent may sign the specs one wave at a
  time** (the screens a ticket wave needs), recorded per screen in `SCREEN_SPECS.md`
  (`Signed: Innocent ✓ <date> (wave N)`). An unsigned screen never blocks backend work or another
  wave's screens. The review page shows annotated screen specs, a state matrix (screen × state) and a
  contract map (screen → CON → status).

## FW · Early frontend foundation wave  (UX track, alongside §5–§6)

Innocent approved this path on 2026-10-25. It lets presentation work start before the §6 gate.

- **Starts after:** the UX-2 pick **and** the design tokens in `design.md` **and** a readiness record at
  `docs/plans/foundation-wave.md` (template `templates/FOUNDATION_WAVE.md`).
- **Eligible:** design tokens, typography, basic accessible components (button, link, input, badge or
  status pill, banner, card, table, tabs, stepper, dialog shell), layout primitives (app shell,
  sidebar, page header, split panes).
- **Not eligible** (normal feature path instead): anything behaviour-dependent: permissions, autosave,
  resumability, booking or job state, data fetching, backend error recovery, real-time collaboration.
- **Acceptance** uses **presentation examples (`PE-N`)**, not invented backend worked pairs. Example:
  "the primary button meets 4.5:1 text contrast on the panel in light and dark; its focus ring is
  visible at 3:1; its disabled state says so in text."
- **Discipline:** the usual ticket and review rules (lanes, plan → implement → test → review, affected
  tests). UX-5a checks run on the component gallery (axe, visual against the look sheet and `design.md`).

## UX-4 · Focused interaction prototype  (optional)

**No longer the real frontend, and never a ticket prerequisite.** Through 1.14.1, UX-4 built the whole
frontend on mocks before tickets. Since v2 the frontend is built in §8 (`SKILL.md` rule 9).

- **When it is needed:** there is a **named interaction uncertainty** that a static screen can't settle
  and a wrong guess would be expensive. Write it as a question. Example: *"Does live co-editing plus a
  frozen Submit button confuse reviewers about whether their edits were included?"*
- **When it is n/a:** no such question exists. Record `UX-4: n/a — <reason>` on the checklist and move on.
- **Claude:**
  - builds the smallest thing that answers the question: the screens and states involved, nothing else;
  - runs it against Prism mocks of `docs/contracts/interface.openapi.yaml` where data is involved, or
    static HTML when not; in the frontend stack if the code will be kept, otherwise throwaway in
    `prototype/` (say which);
  - writes `04-prototype/PROTOTYPE_PLAN.md`: the question, what is clickable, what is faked and how,
    and what answer would change which artifact.
- **Done when:** the named question can be answered by clicking through it.
- **★ Gate:** *what is the answer to the named question?* Innocent clicks through it and answers. The
  answer goes back to its owner: a flow change to UX-1, a contract change to UX-3a (as a `CHG-N` if the
  card was agreed), an emphasis change to UX-3b.

## UX-5a · Verify during implementation  (§8, per frontend slice)

- **In:** each frontend slice as it is built against the Prism mock, plus all upstream artifacts.
- **Claude, per slice:**
  - **Traceability:** `trace_check.py` for the slice's screens (REQ → US → FLOW → SCR → CON → TEST).
  - **Behaviour:** Playwright tests per flow the slice serves, including the error branches and
    recovery paths, against the Prism mock.
  - **Accessibility:** `@axe-core/playwright` on every screen and state the slice adds.
  - **Visual:** plain screenshots at 1280 and 390 wide, light and dark, compared with `design.md` and the
    look sheet; `toHaveScreenshot` baselines are taken once the look is accepted.
  - A screen with no UI (an MCP server, an API) still needs a TEST for `trace_check`: a Playwright
    `request` test against the Prism mock — assert the unauthenticated refusal first, then send the
    session cookie named in the OpenAPI `securitySchemes`.
- **Pitfalls seen on the first full run (HouseAccount, 2026-10-19):**
  - run every Playwright command under a hard cap (`perl -e 'alarm 500; exec @ARGV' npx playwright test`);
  - an SVG shape with an `aria-label` and no role fails axe `aria-prohibited-attr`: give focusable
    shapes `role="button"`, drop the label on decorative ones;
  - a scrolling floating card fails `scrollable-region-focusable`: `tabIndex={0}` plus a focus ring;
  - text shown twice (a desktop card and a phone-only block): assert
    `getByText(…).locator("visible=true")` has count 1, not `toBeVisible()` on a strict locator;
  - Lighthouse on a hash-routed app behind sign-in: `navigation` mode on the sign-in screen only
    (navigation reloads and drops an in-memory session), then sign in and use `snapshot` mode per
    screen. Low SEO/llms.txt scores behind sign-in are expected.
- **Out:** the slice's rows in `05-verify/QA_REPORT.md` (UX-5a section), attached as evidence to the
  ticket. Every check is `PASS`, `FAIL`, `NOT_RUN` or `NEEDS_HUMAN_REVIEW`.
- **Gate:** none of its own; the evidence is part of each ticket's review.

## UX-5b · Final acceptance  (against the connected application)

- **In:** the connected application (frontend on the real backend), the UX-5a evidence.
- **Claude:**
  - re-runs the Playwright suite with Prism in **proxy** mode in front of the real backend, so any
    response that breaks a contract fails;
  - writes the full `05-verify/TRACEABILITY.md` (every P0 REQ → US → FLOW → SCR → CON → TEST);
  - runs a Chrome DevTools Lighthouse accessibility audit;
  - offers again every walkthrough task left `NEEDS_HUMAN_REVIEW`.
- **Human experience review:** Innocent, or a person he names, attempts each core task while Claude
  records what was observed. Claude never infers usability from passing tests.
- **Out:** `05-verify/QA_REPORT.md` (UX-5b section) with its evidence.
- **Loop rule:** a failure goes back to the phase that owns it:
  - a missing requirement → the PRD itself (it changes first and the zero-to-hero §4 gate reopens);
  - a wrong order of steps, a missing permission or recovery path → UX-1;
  - a broken or wrong promise → UX-3a, through the change procedure (`CHG-N`);
  - the wrong emphasis → UX-3b IA;
  - wrong styling → the frontend ticket that owns it (or FW for a shared component).
  That artifact changes first, and the work that cites it is marked `reconcile: CHG-N` or reopened. An
  old screenshot never stands in for a changed requirement.
- **★ Gate:** *what is accepted or revised?* Before §9/§10. The review page shows the QA table, the
  screenshots, the traceability matrix and the walkthrough record.
