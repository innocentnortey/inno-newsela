# ux-pipeline — pilot log

Append one dated entry per session (newest last). Record what worked, what didn't, and what to change before promotion into zero-to-hero §4b.

## 2026-10-18 · Pilot set up (Riverside)
- Built from Innocent's ChatGPT-sourced outline (`references/origin.md`), plus his addition: UI↔backend contracts (CON) in the ID chain, feeding §6 DO-4 and §7.
- Tool claims verified live before choosing: stitch-skills (Apache-2.0, "not an officially supported Google product", needs the Stitch MCP server + a Stitch API key); Prism (Apache-2.0, mock + proxy); mermaid-cli (MIT). Google's Stitch free-tier limits are not published on a page we could read.
- `trace_check.py` tested on a fixture with four planted breaks (undefined screen, uncovered requirement, orphan contract, untested screen): all four caught.
- First run: UX-1 on `inno-riverside-onboarding` (PRD v0.1, before PRD approval).
- Tooling smoke test: mmdc, Prism 5.15.11 and Redocly 2.64.1 all run from `npx` here. Mermaid's default HTML labels (`foreignObject`) are a print/scale problem for review pages → render with `htmlLabels:false`.
- UX-1 on Riverside produced 15 findings (UXA-1…15), each with its backend contract implication, and a 12-row provisional contract surface. The most useful catch: the brief needs *both* chat and a pre-filled form, and the PRD never says how they coexist (UXA-2) — the main question for UX-3 concepts.

## 2026-10-18 · Correction: the PRD phase is dropped (Innocent)
- Innocent: the PRD phase duplicates zero-to-hero — the checklist never opens §4b without an approved PRD. The pipeline is now **five phases** (UX-1 Planning … UX-5 Verify); the PRD is a prerequisite, not a phase. The UX gap check survives only as an optional §4 interview input (`templates/UX_GAPS.md`); Riverside's run of it moved to `docs/prd/2026-10-18-ux-gaps.md`. Folders renumbered (`01-planning` … `05-verify`).
- Lesson for the retro: when adopting an outside process, map each of its phases onto the gates we already have *before* building, and drop the ones that duplicate a gate.
- Riverside decisions: Innocent decided UXA-1/6/7/11/14/15 himself and delegated the rest ("whatever you think is best"). Recording **who** decided each (him vs a delegated default) kept the record defensible. Worth making a column in the `UX_GAPS.md` template.
- The visual-review staleness check fired correctly when the PRD moved to v0.2 — the page could not be presented until refreshed.
- 2026-10-18 · Stitch connected: key in the root `.env` (Innocent's choice over 1Password), user-scope MCP entry holds only `${STITCH_API_KEY}`. Gotcha: Stitch's MCP handshake and tool list work **without** a key, so "✔ Connected" proves nothing about auth — verify with an authenticated read (`list_projects`). Claude Code must be launched with the `.env` loaded, or tool calls go out with the literal `${STITCH_API_KEY}` text.
- 2026-10-18 · **Correction:** the `${STITCH_API_KEY}` header reference didn't work for Innocent. Sessions here are started by the Claude Code daemon from pre-warmed `--bg-spare` processes, so (1) a terminal's `source .env` never reaches them and (2) a spare pre-warmed before a server is registered doesn't list that server. Fixed with `headersHelper` → `.claude/scripts/env-mcp-headers.py` (reads the root `.env` at connect time). Proven: a headless session with no key in its environment called `list_projects` → OK, while the same call with no key → HTTP 401.

## 2026-10-18 · Second run: YourAI (light, all five phases in one session)
- Ran UX-1…UX-5 end to end in ~2.5 h under a next-morning deadline. Light mode held: one chosen concept + one recorded alternative, 5 screens, 6 CON, 12 Playwright checks.
- **Reference capture:** Chrome DevTools MCP was locked by another session's profile (`jobsearch`); `stealth-chrome` with `persistent:false` worked as a clean isolated browser. Dribbble lazy-loads thumbnails (GIF placeholders), so pull each shot's `og:image` by same-origin `fetch` in the page and build a contact sheet locally (`uv run --with pillow`). The stealth `evaluate` doesn't await promises: stash results on `window` and read them in a second call.
- **Prism as contract guard paid off:** it enforces the bearer scheme (401) and validates bodies, so prototype drift fails tests. `Prefer: code=…, example=…` makes every spec'd state reachable from a URL parameter; that doubles as the state switcher.
- **Real defects the screenshots caught:** duplicate input IDs between a hidden desktop column and a phone sheet (labels bound to hidden inputs); header wrapping on phones; a stateful global regex in a render path.
- **Harness lesson:** axe scanned mid-fade elements and reported blended-colour contrast failures. Wait for `document.getAnimations()` to settle before scanning; don't weaken the rule.
- **trace_check gotcha:** a prose note mentioning an unused story ID inside another story's block counts as a link. Keep retired IDs out of blocks.
- **Process gap to fix before promotion:** zero-to-hero's §4b checklist paths (`docs/prd/user-stories.md`, `docs/design/ui-design-reference.md`) differ from this skill's `docs/ux/` layout. Pick one.
- 2026-10-18 · Why Innocent's "brand new" session still had no Stitch: the daemon hands each new session its one pre-started spare (here pre-started 16:43:37, before Stitch was registered at 16:44). The first session after an MCP change is stale; the second is fresh. Evidence: `~/.claude/daemon.log` `claimed-spare` / `spare spawned host pid=` lines. No process was killed.

## 2026-10-18 · Riverside UX-1 Planning (started before the §4 PRD gate, Innocent's call)
- **Early start recorded as a skip** (checklist *Skips*: "§4b ux-pipeline started before the §4 PRD gate, against PRD v0.2 — drafts reopen if Stages 2–4 change the PRD"). The phases reference assumes an approved PRD. Worth a line in `phases.md` on what an early start must record.
- **Feeding UX-1 from Stages 2–3 worked well.** Stories cite worked pairs (WP-N), and stories and flows carry an **⚠ HP-N** flag when they rest on an open hard-problem card, with a sentence on what changes under the other option. That keeps unchosen design from reading as decided. Suggest adding `Evidence: WP-N · Hard problem: HP-N` to the `USER_STORIES` template (done by hand here).
- **Give each brief error branch its own FLOW ID** (bad upload, OCR failure, partial extraction, double-booking, LLM down) rather than a sub-branch inside the happy flow. The gate page can then list *brief edge case → flow* as a table, and the done-when check is visible.
- **mmdc 12:** `{"flowchart":{"htmlLabels":false}}` is ignored; the top-level `"htmlLabels":false` works. `journey` diagrams have no legible non-HTML mode, so draw them on the page from the Mermaid source. Render each diagram with `-I <unique id>` and `-t default` / `-t dark`, and switch them with CSS. Also prefix the template's `svg …` rules with `svg:not(.mmd)`, or the page restyles Mermaid's text. (`references/tooling.md` corrected.)
- **A wide LR sitemap shrinks to unreadable.** Use `flowchart TB` with subgraphs per surface.
- **Checker word-count warning:** two theme copies of every SVG double-count diagram text. On this page ~6,500 words came down to ~4,000 without SVG, a quarter of that being the required step-by-step text equivalents. Consider teaching the checker to skip SVG text.
- **Chrome DevTools MCP:** `evaluate_script` with `sourcePath` and `take_screenshot` with `filePath` both refuse paths outside the workspace roots, so pass scripts inline and save evidence inside the project. **Full-page screenshots wrap past ~16,000 px** (sections come out in the wrong order), so use viewport shots after `scrollIntoView` for long pages.
- A consistency script compared the draft-CON table's "used in" column against the CONs named in the flow step tables: they matched. Keep that check for UX-3.

## 2026-10-18 · Riverside UX-2 Concepts (first real Stitch use)
- **Stitch generation works, but the MCP is awkward.** Both `generate_screen_from_text` calls timed out at the tool, as its description warns. The first screen came back only as the project's `thumbnailScreenshot` (`get_project` → `downloadUrl`, 512×470 PNG). `list_screens` returned `{}` on all 8 calls, so there were no screen IDs: `get_screen` and `generate_variants` (which needs `selectedScreenIds`) could not be used. The second generation demonstrably ran (the project's `updateTime` moved), but it was unretrievable. **Workaround:** the thumbnail tracks only the first screen, so put each concept in its own project, or accept Claude wireframes as the source for variants. Recheck on the next run whether `list_screens` lags by minutes.
- **Stitch output must get a rules pass.** Unasked, screen 1 added "A registered care coordinator will call to confirm before anything is booked", a "here is our promise" box and a *Talk to Support* button, all against rule 7g / T-9. Record each violation beside the image (`stitch/PROMPTS.md`) and carry none of it over.
- **Stitch also generates a design system** (`designMd` on the project). Useful as a UX-3 starting point; record it as a proposal, not a decision.
- **Reference capture without submitting anything:**
  - GOV.UK Design System examples load directly at `…/<pattern>/default/index.html`, which is faster than clicking through the iframe pages.
  - Stripe Identity's public demo (`identity.stripedemos.com`) can be observed up to its consent screen; stopping there avoids the biometric step.
  - Calendly's sample account had no openings. Cal.com public pages show slots, and their URLs carry state (`?month=`, `?date=`).
  - Look for a page that actually has availability before capturing.
- **DevTools MCP check gotcha:** `naturalWidth` is 0 for `loading="lazy"` images below the fold, which reads as "broken". Force-load them before judging, and drop `lazy` on review pages so print and PDF include them.
- **Wireframes as generated SVG** (`wireframes.py` in the session tmp; output in `docs/ux/02-concepts/wireframes/`): give the inlined copies unique IDs and a class the page's `svg …` rules exclude, or the template restyles their text.
- **Claim-to-source caught a wrong count** ("7 polls" vs the 8 calls actually made). Counts of tool calls are claims too: tally them from the transcript, not from memory.

## 2026-10-18 · Riverside UX-3 Structure
- **Generate contract cards and the OpenAPI draft from one data structure.** One Python list built both `UI_CONTRACTS.md` and `ui-contracts.openapi.yaml`, so operation IDs, errors and examples cannot drift. Redocly passed with no warnings on the first lint once these were in place:
  - a `security` scheme, with `security: []` on public operations;
  - a license;
  - a 4xx response on every operation.

  Error examples went under named keys (`examples: {SLOT_TAKEN: …}`), so Prism's `Prefer: code=409, example=SLOT_TAKEN` reaches each designed error. That is the UX-4 state switcher for free.
- **Port 4010 was already taken** by another project's mock. Pick a free port and check with `lsof -nP -iTCP:<port> -sTCP:LISTEN`; never kill a process you didn't start. Bounded waits on Prism startup (`until grep "Prism is listening"`, 60 s cap).
- **The screen↔contract cross-check matters:** a script compares each spec's `Contracts:` line with each card's `Screens:` line (40 links, identical). My first version used a regex across sections and reported nonsense, so split by heading before matching.
- **Claim-to-source applies to measured results too.** The page's "checks pass" card cited runs that lived only in the session. They were recorded in `UI_CONTRACTS.md` (*Checks run*) before the page could cite them.
- **The UX-3 page worked best as:** annotated core screens (the UX-2 wireframe beside its states and contracts), the state matrix, a bipartite contract-map SVG highlighting the model boundary (only CON-4 sends text to the model), and a live token preview in both themes with contrast computed from the tokens. Truncate SVG labels at word boundaries.
- **Template gap:** `templates/IA.md` asks "visible without scrolling on a phone". For a desktop-first project, make the fold a parameter.

## 2026-10-18 · Riverside: the design direction was rejected, so Dribbble now comes first (Innocent)
- **What happened:** Innocent liked the whole UX-3 structure (specs, states, IA, contracts) but rejected `design.md`'s direction. I had written it from the `ui-*` rules plus Stitch's palette: warm institutional, sage and serif. His instruction: search **dribbble.com** in the Chrome DevTools MCP for designs related to the project, and work from those. Now a UX-3 step (`references/phases.md`), a tooling row, and a memory note (`design-direction-from-dribbble`).
- **Method that worked:**
  - 7 searches drawn from the domain and the core screens: "home care app", "healthcare web app", "patient intake", "onboarding web app", "caregiver dashboard", "appointment booking web", "AI assistant chat dashboard".
  - Extracted per card: id, URL, title, designer (the first non-`/shots`, non-`/signups`, non-`/pro` link in the `li.shot-thumbnail`), and the `alt` tags.
  - Downloaded the 400×300 thumbnails, built 6-column contact sheets and reviewed all 305 by eye. Then pulled 1200×900 versions of 16 candidates, kept 14 and grouped them into 3 named directions.
- **Gotchas:**
  - Only about the first 10 cards on a results page have a real `src`; the rest are lazy (`class="lazyload"`). Read `data-src`. The same URL with `resize=1200x900` gives a large version.
  - The DevTools MCP `evaluate_script` with `filePath` must write inside the workspace, so save JSON into the project (`docs/design/references/search/`).
  - Results skew heavily to mobile apps and clinic marketing sites. Add "web app" or "dashboard" to the query to get desktop products.
- **Make the comparison like for like:** render the *same* screen (SCR-5) in each direction's tokens and real fonts, embedding the OFL Google Fonts as base64 `@font-face`, which keeps the page standalone and passes the external-asset check. Stack light over dark at full width; side by side at 520px made the chat wrap absurdly.
- **CSS collision:** the shared `extra.css` already defines `.mock{max-width:520px}` from the Stage 2 page, so namespace page-specific classes (`.dmock`).
- **Honesty:** Dribbble shots are other designers' work. Credit the designer and URL beside every image, keep them as internal reference, and say so on the page.

## 2026-10-18 · Riverside: directions must differ in construction, not colour (Innocent)
- **Feedback:** the first Dribbble directions only changed colours and fonts. Innocent wanted the *texture* and the *way components are built* to follow the chosen references, and asked whether the wireframe was the cause.
- **Honest diagnosis:** partly. All three were rendered on one Concept A skeleton with identical component shapes and only tokens swapped. The wireframe fixed region placement, but I also let it fix construction, which nothing required.
- **Fix, now in `references/phases.md`:**
  - every direction gets a **component anatomy** table (canvas, steps, headline, conversation, bubbles, input, summary, booking, buttons), each row citing the shot it came from, plus a **wireframe impact** line saying which Concept A regions change form and which IA stays;
  - at least two core screens per direction are **built that way**.

  Riverside's three now differ structurally:
  - A uses a dot stepper, a device-like conversation card, white shadowed bubbles, a round send button, leaf and disc decoration, and Seon's tab stepper for booking;
  - B uses a grainy gradient backdrop, a floating window with an icon sidebar, an orb with a centred greeting, a big prompt box and gradient stat cards;
  - C uses a blurred editorial stage with an inset frame line, a serif transcript in a frosted panel instead of bubbles, an underline input, a ring stat and line-icon trust row, and glass day chips.
- **How to look closely:** convert 4–6 anchor shots to PNG (`ffmpeg -i x.webp x.png`) and read them at full size before writing the anatomy. The contact sheet is too small to see construction.
- **Gotchas:**
  - Generic class names (`.lede`, `.mock`) collide with the review template, so prefix mock classes per direction.
  - Decorative icons as CSS `mask` data-URIs avoid adding `<svg>` elements, which the page checker would require to carry `role="img"` and a title.
  - The DevTools contrast scan misreads `color-mix()` and gradient backgrounds, so compute blended-surface pairs from the colours themselves and record them in the Markdown.

## 2026-10-18 · Riverside: texture moves before the wireframe, and two clickable direction prototypes (Innocent)
- **Feedback:** construction-level directions were "a lot better". The remaining problem was "common Claude UI texture" (cream canvas, serif headings, outlined pills, sage accents, the review-page look) leaking into product screens. Innocent: if the wireframe causes it, the Dribbble step goes before the wireframe, so the wireframe takes the texture and the later design step is only colours. He also asked for two clickable prototypes, B and C, to choose from.
- **Process change (now in `references/phases.md`):**
  - UX-2 starts with Dribbble texture research and named directions (component anatomy per direction). Concepts and wireframes are drawn in that construction, not as a grey skeleton.
  - UX-3 `design.md` makes the chosen direction exact (colours, tokens, theme); it no longer invents an aesthetic.
  - A *house-texture check* rejects a direction that matches more than two house traits.
  - A *scanning check*: left→right the columns read as one sentence (where you are → do the task → what has been recorded), with column headings on one baseline; top→bottom each column follows the task and ends with its next action; motion only to show the next action.
  - When two directions are close, build two clickable direction prototypes (standalone HTML).
- **Pattern that worked across both prototypes:** the same three-column meaning on every screen (left: steps, centre: the task, right: what has been recorded and the one primary action at its foot). Numbered task steps continue across columns (1 day, 2 time on the left, 3 check and request on the right). The question being asked and its summary row carry the same number and an "Asking now" marker. Each answer flies from its bubble to its summary row, then the row pulses once.
- **Bugs caught by driving the page, not by reading the code:**
  - a grid container with a fixed height still grows when its implicit row is `auto`. The composer was pushed out of view once messages piled up. Set `grid-template-rows:minmax(0,1fr)` on every fixed-height grid in the chain;
  - `body` carried the same `data-screen` attribute used to switch sections, so the switcher hid the whole page on the second transition. Scope selectors to `section[data-screen]`;
  - margin collapse through `body` added a 24px page scroll. Use `body` padding;
  - an intro that hid the composer until the greeting finished contradicted "the chat box must be clearly displayed". The composer is now visible from about 0.5 s; the greeting fades into the thread.
  - In C, the headline inside the left column pushed the chat panel below the summary's top edge and left it too short to show the first question. A full-width header row with the two panels aligned beneath fixed both.
- **Gotcha:** setting only the URL hash on a `file://` page does not reload it; reload after changing the hash.

## 2026-10-18 · Riverside: check density at the person's real viewport, and suggestions are a product feature
- **Feedback:** Innocent approved UX-3 with Direction B, light first, on one condition: "make sure this sizing of the UI doesn't make things feel bunched up". His screenshot came from a 1440×790 viewport (a MacBook with browser chrome), not the 1280×800 I had been checking. At that height the answer box took about 40% of the chat column.
- **What fixed it:**
  - drop anything said twice: a hint line that repeated the placeholder, and a keyboard-shortcut line (now a tooltip);
  - make secondary actions quiet links;
  - merge the suggestions heading with its reason into one line;
  - let the window widen to 1440px;
  - add a `max-height` breakpoint that drops column subtitles below 760px.
  - Measured result: the conversation is 331px tall at 1440×790.
- **Rule for next time:** inspect at the person's actual working viewport as well as 1280×800, and ask for it (or read it off a screenshot) when unsure. Vertical density in a chat column is the first thing to fail.
- **Product learning:** Innocent wants suggested answers to adapt to everything known about the person receiving care. That is a PRD requirement, not styling. It went in as PD-8, with a story (US-30), a contract field (CON-4 `suggestions` with a reason line) and a hard-problem card (HP-5: who writes the wording). A suggestion puts words in the user's mouth, so the wording comes from a reviewed bank and each adapted set says why it appeared.

## 2026-10-18 · Riverside: keep generators and page builders in the repo from the start
- **What happened:** the contract generator and every review-page builder lived in the job's temp folder. When Innocent moved the UX-4 build to the VPS for parallelism, they had to be moved into the repo (`scripts/ux/`, `scripts/review-pages/`), their absolute paths made relative, and pre-rendered Mermaid SVGs copied along.
- **Rule:** any script that produces a tracked artifact (contracts, OpenAPI, review pages) lives in the project repo with relative paths from day one. Temp folders are for scratch output only.
- **Stamping trap:** `stamp_review_page.py` will happily re-stamp a page whose source changed without the page being rebuilt, and the check then passes. Always rebuild, then stamp. Never stamp alone to clear a STALE failure.

## 2026-10-19 · HouseAccount UX-1: light and dark Mermaid copies need distinct ids
- **Bug:** both theme names begin with "d" (`default`, `dark`). Deriving the mmdc `-I` id or the builder's `<title>` id from `theme[0]` therefore gave both copies the same id. Mermaid scopes its styles by SVG id, so the dark copy's stylesheet, later in the page, restyled the light copy. In light mode every flow drew as black boxes.
- **Fix:** render with explicit suffixes (`-I dNNlt` for default, `-I dNNdk` for dark), and build title ids with `L` / `K`. Check with `grep -o 'svg id="[^"]*"' page.html | sort | uniq -d` (it should print nothing), then look at the page with `data-theme="light"` on a dark-mode machine.
- **Also:** the zero-to-hero checker now requires a "story so far" section (fails on Stage 3 pages, warns elsewhere). Put it in the UX page builders from the start.

## 2026-10-19 · HouseAccount UX-4/5: Playwright 1.52 hangs on Node 24; use ≥ 1.64
- **Symptom:** `playwright test` and even `--list` hung forever before running any test, even a one-line spec with no imports. `--version` worked, and `DEBUG=pw:*` showed the client initialising and then nothing.
- **Fix:** `npm i -D @playwright/test@latest` (1.64.1 on 2026-10-19). After that, `--list` returned 22 tests at once. Node was v24.14.0. The tooling table's version pin should be raised.
- **Habit:** run every Playwright call under a hard cap (`perl -e 'alarm 40; exec @ARGV' npx playwright …`), never open-ended. I lost about 15 minutes to an uncapped run before Innocent asked what was happening.

## 2026-10-19 · HouseAccount UX-5: what the first full verify run caught
- **First full run: 11 of 50 failed, all real.** axe `aria-prohibited-attr` on SVG `<circle>`s that had an `aria-label` but no role; `scrollable-region-focusable` on scrolling floating cards; a phone-only hidden sentence that `toBeVisible` caught. Lesson: an SVG shape carrying a label needs a role (`button` if focusable); otherwise drop the label. Floating cards that scroll need `tabIndex=0` plus a focus ring.
- **For text that legitimately appears twice (desktop card and phone block),** assert `getByText(...).locator("visible=true")` has count 1, not `toBeVisible()` on a strict locator.
- **Screens with no UI (an MCP server) still need a TEST for `trace_check`.** A Playwright `request` test against the Prism mock works: assert the 401 without a session first, then send the cookie named by the OpenAPI `securitySchemes`.
- **Lighthouse on a hash-routed SPA behind sign-in:** run `navigation` mode only on the sign-in screen; sign in, then use `snapshot` mode per screen (navigation reloads and drops the in-memory session).
- **Review-page tables at 390 px:** stack rows as labelled blocks (`td::before { content: attr(data-label) }`), and keep IDs `white-space: nowrap`. Otherwise "FLOW-" and "2" split across lines.
- **Pillow** is not in any system or pyenv Python on this Mac. Run the page builders with `uv run --no-project --with pillow python …`.

## 2026-10-19 · Riverside: parallelising UX-4 on the VPS (claude-20)
- **Shape that worked:**
  - **Foundation first:** one agent builds the shell, a registry with all 24 screen stubs, the state panel, and `useOp`/`useMutation`.
  - **Then five screen groups in parallel**, each owning only its `Scr<N>.tsx` files and one `named-examples/<group>.json`.
  - **Shared plumbing stays with the foundation** (session fields, client hooks), so builders never touch shared files. They request primitives instead.
  - **One shared Prism and Vite**, owned by the orchestrator. Regeneration serialised with `flock` on a lock file.
- **What the builders found that the UX-3 contracts had missed (28 corrections):**
  - Request schemas without `additionalProperties:false` let every screen send undeclared fields. Prism said "0 violations" while the contract was wrong.
  - **Rule:** close request bodies at UX-3. Make the generator refuse undeclared response fields (`RES_ADDED`).
  - When an operation already defines a 422, Prism answers drift with that operation's first 422 example, so drift looks like a real error. Read the `sl-violations` header in the client and throw `CONTRACT_DRIFT`.
- **What reviews caught that the builders' own screenshots did not:**
  - **Safety behind the network:** the T-7 911 view appeared only after the mock reply succeeded.
  - **Synthetic fallback names:** "Priya" greeting a person arranging their own care.
  - **Invented status from fallback examples:** after-booking screens reachable before booking showed a made-up booking and wrote it into the session.
  - **Mock text overriding the session:** "Ruth's ID card" for every family.
  - **Rule:** every forced or fallback example is labelled and never written to session state. Grep mock data, not only code, for sample names.
- **Process change (Innocent, mid-run):** fan-out coding is now `fanout-planner` → `fanout-implementer` (`.claude/rules/fanout-plan-then-implement.md`). Implementers run on Sonnet, planners and reviewers on Opus.
  - Plans let the orchestrator catch collisions before code. Slice A's request "B must send `reason`" was folded into B's plan before either built.
  - **Split re-review fixes by file ownership too.** One sequential fix slice idled the other lanes.
- **Density:** an invalid `font: 600 13.5px/1.2 inherit` shorthand silently fell back to 15px regular on SCR-5. Fixing it to the reference build's sizes gave 5px of thread height back (332 → 337px at 1440×790).
- **Gotcha:** axe `scrollable-region-focusable` fires only where a column overflows at 1280×800, not at 390. A `useScrollRegion` hook adds `tabIndex=0` + `role=region` + a name only when the area overflows and holds nothing focusable.

## 2026-10-19 — VPS runs Python 3.10: review-page builders written on the Mac can fail to parse
`inno-riverside-onboarding/scripts/review-pages/build_ux1.py` used a backslash inside an f-string expression, which only Python 3.12+ allows. The VPS has 3.10.12, so the build failed while a following `stamp` still ran on the old page. Lessons: (1) chain build → stamp → check with `&&`, never `;`, so a failed build cannot be stamped; (2) a builder's file name (`build_ux1`) does not say which page it writes, so read its `written …` line before pairing it with a page; (3) after moving builders between machines, check each one parses under the local Python (`ast.parse` sweep).

## 2026-10-19 — Riverside UX-5 (first full run on this project)
- **Never edit app code while a Playwright run is going.** Vite full-reloads the page, which shows up as "Execution context was destroyed" or a missing live-validation message. The run looks flaky; the app is not. Sequence app-fix slices before test and baseline slices, and do the evidence run with nothing editing.
- **Take baselines after the fix slices.** Test planners find app defects; fix them first, or the baselines lock the defects in.
- **An unlayered element rule beats Tailwind utilities.** `p { text-wrap: pretty }` in `index.css` silently overrides `truncate` on a `<p>`, because `text-wrap` and `white-space` share one property. Measure computed styles; don't trust class names.
- **A "fits one line" rule can hide a rule-7 statement.** An ellipsis or a short-window `display: none` on subtitles cut the AI disclosure and other assurances. Give such subtitles an opt-out (`keepSub`) and test them for whole visibility at 1024, 1280, 1440, 390 and a short window.
- **Make the test register and the QA report generators, not hand-kept files.** The TEST-n numbering then follows the spec files, and the review page cross-checks counts. Hand-keep only the walkthrough (people's own words) and routed-back.
- **Reviewers catch "green but toothless".** Ask the planner for a failing-if-removed assertion for every fix, and ask the reviewer to name it.

## 2026-10-19 — Riverside, carrying Innocent's small UX-4 answers into the prototype

- **`&&` is not enough when the build is piped.** `build.py | tail -8 && stamp …` checks `tail`'s exit code, so a failed build still stamped the old page (third time this trap bit, in a new form). Run builds with `set -o pipefail`, or send the build log to a file and chain on the build itself.
- **Decided questions keep their story on the page.** Rendering an answered ask card as `data-status="decision"` with all four story parts, the options shown, the person's words and a "What we did" line keeps `check_review_page.py` passing and shows the decision trail. Read the answers from their one owner (the checklist gate line), never from a second copy in the builder.
- **Builders that pin counts break when a decision adds rows.** `build_ux4.py` required exactly UX4-C01…C28; the answers added C29 and C30. Pin "contiguous from C01 and at least N", and keep the card text at the number the person actually saw.
- **Re-baselining is the person's call when the look changed because of their decision.** The permission layer refused `--update-snapshots`, and the planners had said the same. Keep the before/after/diff images next to the evidence, record the expected differences in `visual-stability.json`, and let the QA report show the visual row as FAIL until the person says yes.
- **`--reporter=line` replaces the config's reporters.** The JSON results and run summary silently kept the previous run. For an evidence run, use the config's reporters (no `--reporter` flag).

## 2026-10-20 — UX-1 gate no longer waits for approval (policy change)
- Innocent: "for zero to hero ux, you can skip need approval on the flow diagram, you can still make the html though … i trust the flow that you've been building." UX-1's gate is now closed by Claude once *Done when* holds and `check_review_page.py` passes; the review page is still built and its path handed over, and the fork opens straight away. UX-2…UX-5 keep their ★ sign-offs. Changed in `references/phases.md`, `SKILL.md`, zero-to-hero 1.12.0 (`SKILL.md`, `ARTIFACT-MAP.md` §4b/§5, checklist template). Mac and VPS copies synced the same day.

## 2026-10-20 · AEA call center: UX-1 → UX-2 in one evening (inno-aea-callcenter)
- **Early start beside §4.** Innocent started the UX track while the Stage 4 interview ran in another session. UX-1 was
  drafted on PRD v0.2 with an "overlap, not a skip" note; the PRD then moved to 0.4 at the §4 gate, and UX-1 was reopened
  and re-closed the same night (three requirement changes reached screens). The pattern works if the overlap is written
  down up front and the other session is told which files each side owns.
- **A generator that re-stamps hashes hides staleness.** The first UX-1 page generator hard-coded its content and only
  recomputed `review-source` hashes, so a stale page passed `check_review_page.py`. A peer session re-stamped it too. Fix
  that worked: the generator parses tables and Mermaid from the Markdown, compares every hand-drawn SVG flow with its
  Mermaid, snapshots the sources, and refuses to build over a changed source until `--accept-changes` (after reading the
  diff). Keep generators in the project (`docs/artifacts/_build/`), not the job temp folder.
- **Live research changed a safety flow.** A utility's "don't use your phone" line showed that an optional contact offer
  right after a gas-safety card invites indoor typing. Resolution: the card keeps the KB's words exactly, and the offer
  becomes one quiet line for "once you're outside". Don't add an "I'm outside" tap (still phone use) or advice the KB lacks.
- **Behaviour research also corrects order of steps.** A real booking widget demanding contact details before any time
  led to "windows and standard fee first, identity code before the write". The prototype agent had overcorrected to
  "no code at all", which broke the PRD's identity rule; prototypes must be read against the flows, not only the research.
- **Dribbble at scale:** same-origin `fetch` + `DOMParser` batches many searches in one call; verify tabular figures with
  fontTools before naming a font; DevTools snapshot `filePath` must be inside the workspace; ServiceTitan's scheduler
  iframe won't render outside its host page.
- **Watch 24-hour times** in "dispatch" textures: US homeowners read 12-hour times.
- **Build every direction you put up (2026-10-20, later).** Only A1 and A2 got clickable prototypes; Innocent found them
  "very similar" and chose the unbuilt A3 as "nicer on the eyes". Directions picked for maximum *construction* difference
  still read alike when palette temperature, density and shape language match. Build all 2–3, and vary those at-a-glance
  traits too.

## 2026-10-20 (late) · AEA: a fourth direction for "soft on the eyes"
- **Brief:** "styles that are utility professionally but soft on the eyes", after A1/A2 read alike. Searching
  utility, bank, insurance and support-inbox shots ("utility dashboard", "insurance app", "customer portal soft")
  gave better "professional but calm" references than the dispatch terms did.
- **Check the temperature first.** A1, A2 and A3 had all been cool greys, which is part of why they read alike. A4
  moved to a warm-neutral ground with cool accents. Name each direction's palette temperature in its section.
- **Scale:** one same-origin `fetch` + `DOMParser` call returned 48 cards for each of the 14 queries
  (`li.shot-thumbnail`, read `data-src`). Excluding shots already used left 645, reviewed as 18 contact sheets.
- **Fonts:** Urbanist has no `tnum`. Atkinson Hyperlegible Next has `tnum`, but its default digits are
  proportional, so set `tabular-nums`. Its tabular digits match Atkinson Hyperlegible Mono's width (632 units).
- **IDs:** a requested source ID (S-187) was already taken. Check the register's highest ID before writing a row.

## 2026-10-20 (policy change) · Look sheets for every direction before any prototype
- **What happened (AEA call center, UX-2):** three Dribbble directions were researched (A1–A3) but only A1 and A2 got
  full clickable prototypes. Innocent found them "very similar", picked the unbuilt A3 as "nicer on the eyes", then
  asked for an A4 ("utility professional but soft on the eyes"). The prototype hours went to directions he didn't
  want, and the one he liked had never been shown properly.
- **His instruction:** "what i wish was that you did screenshots or fast light mockups before showing me so i can see
  the colors then you can build the full full protoype", and "that direction i just gave you should be embeded in our
  zero to hero ux root".
- **Change:** UX-2 is now Dribbble research → a **look sheet for every direction** (credited references, light + dark
  swatches with computed contrast, 3–4 static mockups of the core screens on real flow copy, no interactivity; minutes
  each) → Innocent picks from the sheets or asks for another direction → **only then** the clickable prototype, for
  the pick (or two finalists) → concepts and wireframes. Directions must also differ **at a glance** (softness,
  density, shape language, palette temperature, type), not only in construction; every direction put to him gets a
  sheet, and an unbuilt direction is never shown next to built ones.
- **Why it works:** the A4 sheet (`inno-aea-callcenter/docs/artifacts/_build/a4-look/build_a4_look.py`) showed the
  colours, surfaces and real copy on four screens without a JS engine; a choice that took two prototypes and a miss
  now takes a few static pages.
- **Changed:** `references/phases.md` (UX-2 steps, the new *At-a-glance check*, Out, Done when, ★ gate; light-mode
  note), `SKILL.md` (description, phase table, status line, rule 6, files and layout), `references/tooling.md`
  (look sheets first, prototype after the pick), new `templates/LOOK_SHEET.md` and `templates/look_sheet_generator.py`;
  zero-to-hero 1.13.0 (`SKILL.md`, `ARTIFACT-MAP.md` §4b, checklist template). Mac only so far; the VPS copies need
  the same files.

## 2026-10-20 · AEA A5: a direction built from one shot Innocent pointed at
- **What happened:** after A1–A4 he disliked the colours and pointed at one Dribbble shot (Kirridesk). A5 was built from that shot: sample its real hex values first (`uv run --with pillow`, most-common colour in small boxes; darkest pixels for text), then fix only what fails WCAG. The shot's green carried white text at 2.49:1 and its grey captions ~3.7:1, so both were darkened at the same hue and the sheet says so.
- **Dribbble detail:** a shot's `og:image` can equal one of its attachments, and extra `.webp` attachments are often the studio's promo slides, not product UI; look before keeping. The shot page's "More by" cards are lazy (empty until scrolled); fetching the designer's profile (`/fikristudio`) by same-origin `fetch` + `DOMParser` returns 24 cards directly.
- **Generator:** the look-sheet build now fails (`sys.exit(1)`) if any text pair is under 4.5:1 or a UI edge under 3:1; see `inno-aea-callcenter/docs/artifacts/_build/a5-look/build_a5_look.py`. Strike-through on a tile must sit on an inner `<s>`, or it bleeds into the "Taken" word.

## 2026-10-25 (policy change) · Feel brief before search; more sources; linked-screen prototypes (Innocent, Newsela)
- **Problem 1, the search terms.** Searching by industry ("HVAC", "medical") returns what that industry ships today, which is
  often dated. Innocent: "most ui's in those industries are ugly because theyre behind… i always lean towards a modern look".
  The concept: what an experience must *feel like* (from its users and business) differs from how the industry currently
  *draws* it. Fix: UX-2 step 0, a **feel brief** (who and in what state, feel pairs, interaction shape, analogous products
  outside the industry, what to avoid). Style searches combine pattern + feel + analogous domain and never the industry
  name (design thinking calls this *analogous inspiration*).
- **Problem 2, one source.** Dribbble alone was "a bit limited". Added Mobbin and Refero (real shipped product screens,
  mostly paid: use only with Innocent's account), Page Flows (flows) and marketing-only galleries, in `tooling.md`.
- **Problem 3, prototype cost.** He wants to see several directions in use. The direction prototype is now linked static
  screens (no scripted engine), under an hour each, for up to 3 shortlisted directions. Look sheets still come first.
- **First run:** Newsela UX-2.

- **2026-10-25, later:** Innocent: "when you're making me choose i want 4 options to choose from". UX-2 now always presents **4 directions**, each with a look sheet, derived from the feel brief plus the project context. The shortlist for linked-screen prototypes stays at up to 3.

## 2026-10-25 (policy change, pilot v2) · Frontend alongside system design, one shared contract (Innocent, Newsela)
- **What happened:** after Newsela's UX-2, Innocent approved a process revision for Newsela and the shared skills: "This
  is an approved process change, not just a proposal or a Newsela-specific skip." Source:
  `zero-to-hero/proposals/2026-10-25-concurrent-frontend.md` (zero-to-hero 2.0.0).
- **Why:** through 1.14.1 the UX track had to finish a full clickable prototype (UX-4) and verify it (UX-5) before the
  frontend could be ticketed, and §8 was "backend plus plumbing". That prototype cost the most tokens of any stage
  (Riverside: 24 screens), arrived late, and couldn't start until the look was chosen, while the System track designed
  against contracts the UX track owned alone.
- **What changed in this skill:**
  - UX-1 now also lists states, permissions, recovery paths, draft capability needs, and open behaviour questions as
    `UXP-N`, routed to UX-3a.
  - UX-2 keeps the feel brief, 4 directions and a look sheet for each; linked screens are **optional**, never a full app.
  - New **UX-3a shared contracts** (Joint track, from right after UX-1): one canonical spec in `docs/contracts/`
    (`INTERFACE.md` behavioural CON cards with `draft → proposed → agreed / changing`, `interface.openapi.yaml`,
    `CHANGES.md` with a five-step change procedure that also catches behavioural changes with an unchanged schema).
    UX owns needs, System owns support, both review, Innocent decides product behaviour.
  - **UX-3b structure** after the pick, signable per wave. New **FW foundation wave** for presentation-only components.
  - **UX-4** is an optional focused prototype for a named uncertainty; never a ticket prerequisite. The frontend is
    built in §8 against Prism mocks of the agreed contract (old rule 9 "the prototype is the real frontend" removed).
  - **UX-5** splits into 5a (checks per slice during §8) and 5b (final acceptance against the connected app ★).
- **Files:** `SKILL.md`, `references/phases.md`, `references/ui-contracts.md`, `references/tooling.md`,
  `references/origin.md` (history line); new `templates/INTERFACE.md`, `CHANGES.md`, `FOUNDATION_WAVE.md`; updated
  `UI_CONTRACTS.md` (now a pointer), `QA_REPORT.md`, `SCREEN_SPECS.md`, `USER_FLOWS.md`, `IA.md`, `LOOK_SHEET.md`,
  the look-sheet generator's lede; `scripts/trace_check.py` reads `docs/contracts/` (falls back to the old path; same
  results as before on Riverside, Newsela and HouseAccount). Mac only so far; the VPS copy needs the same files.
