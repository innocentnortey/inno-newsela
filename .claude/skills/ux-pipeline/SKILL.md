---
name: ux-pipeline
description: PILOT v2 (2026-10-25). The gated UX/UI process for a zero-to-hero project — turns an approved PRD into user stories, journeys, flows, states, permissions and a sitemap; a feel brief, live reference research and a static look sheet for each of 4 design directions; one shared interface spec agreed jointly with the System track (behavioural CON cards + OpenAPI + a change log); information architecture, screen specs with every state and design tokens; an optional focused prototype only for a named interaction uncertainty; and verified evidence during the build plus a final acceptance against the connected application. The frontend itself is built in §8 against mocks of the agreed contract. Use when a project reaches zero-to-hero §4b (UX/UI), when Innocent says "ux pipeline", "ux/ui process", "user flows", "wireframes", "screen specs", "UI contracts", "interface spec" or "prototype", or when checking whether a UI is traceable to its requirements.
---

# UX pipeline (pilot v2)

**What it does, concretely.** You give it an approved PRD. It hands back, one gate at a time:
- who does what on which screen, in which states, with which permissions and how they recover from errors
  (stories, journeys, flows, sitemap), plus a visible list of behaviour questions still open (`UXP-N`);
- what the screens could look like: a feel brief, references captured live, and a static look sheet for
  each of 4 directions so he can see the colours before anything is built;
- **one interface spec agreed with the System track** (`docs/contracts/`): what each screen needs from the
  backend and what the backend promises, as behavioural CON cards, an OpenAPI file and a change log;
- exactly what each screen shows in each state (IA, screen specs, `design.md` tokens), signed per wave;
- evidence that the built frontend works: traceability, accessibility, visual and behavioural checks per
  slice during §8, then Innocent's own acceptance walkthrough of the connected application.

The frontend is **built in §8**, against Prism mocks of the agreed contract, while the backend is built
alongside it. A prototype (UX-4) is built only when there is a named interaction question to answer.

**How it works.** IDs chain every requirement to the test that proves it: **REQ → US → FLOW → SCR → CON →
TEST**. A phase is done when its definition of done holds and its gate is signed, not when its files
exist. A later finding goes back to the phase that owns the mistake (a hidden priority is an IA fix, not a
CSS fix). A changed contract follows the change procedure in `references/ui-contracts.md`: only work that
cites the changed CON waits.

**Status: PILOT v2, 2026-10-25.** Started 2026-10-18 on `inno-riverside-onboarding` at Innocent's
request, adapted from a ChatGPT-researched outline he supplied (`references/origin.md`). Innocent set the
process; Claude chose the tooling. Record what worked and what didn't in `learnings.md`.

**Revision note, v2 (2026-10-25).** Innocent approved this as a process change during Newsela, after UX-2:
"This is an approved process change, not just a proposal or a Newsela-specific skip." The source is
`zero-to-hero/proposals/2026-10-25-concurrent-frontend.md` (zero-to-hero 2.0.0). What changed, in plain
words:
- The full clickable prototype is gone as a stage. Through 1.14.1 the UX track had to finish one (UX-4) and
  verify it (UX-5) before the frontend could be ticketed. It cost the most tokens of any stage (Riverside:
  24 screens), arrived late, and blocked frontend work until the look was chosen.
- Contracts are now **shared**. The UX side states what the screens need; the System side states what it
  can support; both review each card; Innocent decides product behaviour. This starts right after UX-1
  (UX-3a), alongside spikes and design.
- Structure (UX-3b) follows the direction pick and can be signed one wave of screens at a time.
- UX-4 is an optional, focused prototype for one named uncertainty. UX-5 splits into checks during the
  build (5a) and a final acceptance (5b).

**Earlier notes (history).** Revised 2026-10-20 (UX-2 order): look sheets for every direction come before
any clickable prototype, and only the picked direction got one (Innocent, AEA call center). Revised
2026-10-25 earlier the same day: feel brief, 4 directions, more sources, linked-screen prototypes for a
shortlist. v2 keeps all of that except that linked screens are now optional.

## Where it sits in zero-to-hero

**The PRD is a prerequisite, not a phase.** Zero-to-hero §1–§4 own it, and the checklist only opens §4b
once the §4 gate (*PRD approved*) is ticked. A UX gap check (`templates/UX_GAPS.md`) may feed the §4 PRD
interview, with the backend contract implication of each gap noted.

| Phase | Track | Starts after | Gate |
|---|---|---|---|
| UX-1 Planning (**the fork**) | — | §4 PRD approved | **Claude closes it, no sign-off** (2026-10-20): checks pass + review page built. Stories, flows, states, permissions, recovery paths, sitemap, draft CONs, open `UXP-N` list |
| UX-2 Visual direction ★ | UX | UX-1 | Innocent picks a direction. Feel brief → research across sources → **4 directions** that differ at a glance → a look sheet for each → representative screens. Linked screens **optional** |
| UX-3a Shared contracts ★ | **Joint** | UX-1 (alongside §5–§6) | Each CON `agreed` before anything relies on it; Innocent decides product-behaviour questions |
| UX-3b Structure ★ | UX | UX-2 pick | Innocent signs the screen specs for a wave (per wave is allowed). IA, `SCREEN_SPECS.md` with every state, `design.md` tokens |
| FW Foundation wave | UX | UX-2 pick + tokens + readiness record | Per-ticket review. Tokens, type, basic accessible components, layout primitives; nothing behaviour-dependent |
| UX-4 Focused prototype (optional) | UX | a named interaction uncertainty | Innocent judges the named question, or `n/a — <reason>` recorded. **Never a ticket prerequisite** |
| UX-5a Verify during the build | §8 | each frontend slice | Evidence per slice: traceability, axe, visual and behavioural checks |
| UX-5b Final acceptance ★ | — | §8, connected application | Innocent's walkthrough; before §9/§10 |

**Three tracks after the fork.** The UX track runs UX-2 → UX-3b → FW. The System track runs §5 spikes →
§6 design (all its safeguards kept). The Joint track is UX-3a: the shared contract agreement, which both
consume. §6 DO-4 internal contracts link to the CON cards and never contradict them. Tickets are ready
**per ticket**, not per track (zero-to-hero `scripts/ticket_readiness.py`): a frontend feature ticket
needs the §6 gate, its signed `SCR-N` and every CON it uses `agreed`; it never needs a prototype.

## Files

| File | Use |
|---|---|
| `references/phases.md` | Each phase: inputs, Claude's work, artifacts, definition of done, the gate and its review page |
| `references/ui-contracts.md` | The shared interface spec (`docs/contracts/`): CON card, statuses, ownership, OpenAPI, mocks, the change procedure |
| `references/tooling.md` | Chosen tools, why, setup, data rules, and what was deliberately not chosen |
| `references/origin.md` | The outline this pilot came from, and where we departed from it |
| `templates/*.md` | One template per artifact (copy into `docs/ux/<phase>/` or `docs/contracts/`); `UX_GAPS.md` is the optional §4 input |
| `templates/INTERFACE.md` · `CHANGES.md` | UX-3a: the CON cards and the `CHG-N` change log, in `docs/contracts/` |
| `templates/FOUNDATION_WAVE.md` | The FW readiness record, `docs/plans/foundation-wave.md` |
| `templates/LOOK_SHEET.md` + `templates/look_sheet_generator.py` | UX-2's look sheet: what it holds and its checks, plus a starter generator (copy to `docs/artifacts/_build/<direction>-look/`). Worked example: `inno-aea-callcenter/docs/artifacts/_build/a4-look/build_a4_look.py` |
| `scripts/trace_check.py` | Checks the REQ → US → FLOW → SCR → CON → TEST chain across `docs/ux/` and `docs/contracts/`; exit 1 on a break |
| `learnings.md` | Pilot log, one dated entry per session |

## Artifact layout in a project

```
docs/ux/
├── 01-planning/USER_STORIES.md · USER_FLOWS.md · SITEMAP.md   (incl. the open UXP-N list)
├── 02-concepts/FEEL_BRIEF.md · REFERENCES.md · CONCEPTS.md · references/ · wireframes/
├── 03-structure/IA.md · SCREEN_SPECS.md   (UI_CONTRACTS.md only as a pointer in older projects)
├── 04-prototype/PROTOTYPE_PLAN.md        optional: only when UX-4 runs for a named uncertainty
└── 05-verify/TRACEABILITY.md · QA_REPORT.md · screenshots/
docs/contracts/                           the one canonical interface spec (UX-3a, joint)
├── INTERFACE.md                          behavioural CON cards with status and reviewers
├── interface.openapi.yaml                machine form: generated types, Prism mocks, contract checks
└── CHANGES.md                            CHG-N change log
docs/design/design.md                     the design doc (UI-2 template) with tokens, written at UX-3b
docs/plans/foundation-wave.md             FW readiness record
docs/artifacts/YYYY-MM-DD-ux-<phase>.html  one visual review page per gate
docs/artifacts/YYYY-MM-DD-<direction>-look-sheet.html  UX-2, one per direction (generator in docs/artifacts/_build/)
```

## Rules that always hold

1. **Markdown first, page second.** Each gate's visual review page follows zero-to-hero
   `references/visual-review-pages.md` and passes `check_review_page.py`.
2. **Status words are honest.** Use the five statuses (fact · decision · proposal · unknown ·
   awaiting). A concept is a proposal until chosen; a mock is not a backend; a CON is not `agreed` until
   both sides have reviewed it.
3. **Every screen names its contracts.** A screen spec with data but no CON is incomplete; a CON that
   no screen uses is scope creep.
4. **Synthetic data only**, everywhere, including prompts sent to design tools.
5. **Never invent user-test results.** Automated checks are evidence about the build, not about
   people. Only a walkthrough someone actually did counts as usability evidence.
6. **Texture comes from references found by feel, not from habit or from the industry's current screens.**
   Write the feel brief first; search by feel, pattern and analogous product, never by the industry's name
   (2026-10-25). Run the house-texture check in `references/phases.md` on every direction; the review-page
   look is never product UI. **Look before you build:** every direction shown to Innocent gets a look
   sheet, and directions differ at a glance (softness, density, shape, palette temperature, type). Linked
   screens may help him choose; they are static and never become a full application.
7. **The `ui-*` rules govern craft** (`.claude/rules/ui-*.md`, indexed by `modern-ui-principles`);
   a project's own design system wins.
8. **No tickets or backend code** before the zero-to-hero gates allow it; readiness is per ticket.
9. **The frontend is built in §8 against mocks of the agreed contract.** Prism serves
   `docs/contracts/interface.openapi.yaml`, types are generated from it, and the backend is built alongside.
   UX-4 exists only for a named interaction uncertainty, and nothing waits for it.
10. **Behaviour and presentation are different changes.** Moving a summary into a sidebar is presentation;
    changing what "approved" means is behaviour. A behavioural change to an `agreed` CON is a `CHG-N`, even
    when the OpenAPI file does not change.
