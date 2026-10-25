# Revision 2026-10-25 — frontend alongside system design, joined by one shared contract (zero-to-hero 2.0.0)

**Status: APPROVED** by Innocent, 2026-10-25 (Newsela, after UX-2): "I want you to implement the following revision in
both Newsela's workflow and our shared zero-to-hero and ux-pipeline skills. This is an approved process change, not
just a proposal or a Newsela-specific skip." This file is the single source the edits to zero-to-hero, ux-pipeline,
to-tickets, system-design-readiness, the workspace rule `new-project-zero-to-hero` and the guard hook follow. It
supersedes `2026-10-19-parallel-tracks.md` where they differ (that file stays as history).

## Why (the story)

Through 1.14.1, the UX track had to finish a complete frontend prototype (UX-4) and its verification (UX-5) before
the frontend could be ticketed, and §8 was "backend plus plumbing" because the prototype *was* the frontend. In
practice a full prototype on mocks cost the most tokens of any stage (Riverside: 24 screens), arrived late, and
could not start until the visual direction was chosen, while the System track designed against draft contracts
that the UX track owned alone. The goal now: **useful frontend work runs alongside system design, without a complete
prototype before tickets, and without UX, contracts, system design and tickets drifting apart.**

## 1. Stage structure

| Stage | What it does now | Starts after | Gate |
|---|---|---|---|
| 0–4 | Unchanged | — | unchanged |
| **4b UX-1** (the fork) | Stories, flows, **states, permissions, recovery paths**, sitemap, draft capability needs (draft CONs). **Unresolved behavioural decisions are listed visibly** (e.g. `UXP-N`) and routed to UX-3a. | §4 PRD approved | Claude-closed (unchanged) |
| **UX-2 Visual direction** ★ | Feel brief, research, a look sheet per direction (4 directions), representative screens. Lightweight linked screens **may** help a choice; they are never a mandatory application. | UX-1 | Innocent picks a direction |
| **UX-3a Shared contracts** ★ (joint) | The behavioural contract agreement between the UX and System tracks (§2 below). **Starts immediately after UX-1**, alongside §5–§6. | UX-1 | Each contract `agreed` before anything relies on it; Innocent decides product-behaviour questions |
| **UX-3b Structure** ★ | Information architecture, screen specs with every state, design tokens and `design.md` in the chosen direction. | UX-2 pick | Innocent signs the specs for the screens in a wave (per wave is allowed) |
| **FW Early frontend foundation wave** | Tokens, typography, basic accessible components, layout primitives (§4). | UX-2 pick + design tokens; readiness record | Per-ticket review as usual |
| **§5 Spikes, §6 Design** | Unchanged, run alongside UX-2/UX-3. §6 consumes the agreed contracts (DO-4 links to them). **The overall §6 gate still comes before ordinary feature implementation.** | UX-1 | unchanged, all safeguards kept |
| **§7 Tickets** ★ | Frontend, backend **and** integration tickets, through the existing four passes; a product-wide slice plan and coverage audit; specs one wave at a time; **per-ticket readiness** (§3). | §6 gate (feature tickets); see §3 | four passes, as before |
| **§8 Build** | Frontend **and** backend. Frontend works against mocks generated from the agreed interface spec while the backend is built; integration tickets join them. UX-5a verification runs during the build. | ready tickets | as before + UX-5a evidence |
| **UX-4 Focused interaction prototype** (optional) | Only for a **named interaction uncertainty** (e.g. "does live co-editing plus a frozen Submit confuse reviewers?"). Records `n/a — <reason>` when there is none. **Never a prerequisite for tickets.** | when the uncertainty is named | Innocent judges the named question, or `n/a` recorded |
| **UX-5 Verify** | **UX-5a** verification during implementation (per slice: traceability, accessibility, visual and behavioural checks) and **UX-5b final acceptance** against the connected application (human review). | §8 | UX-5b ★ before §9/§10 |
| §9, §10 | Unchanged | — | unchanged |

```
0 ─► 1 ─► 2★ ─► 3★ ─► 4★ ─► 4b UX-1 (fork)
                              ├─ UX track:     UX-2 direction★ ─► UX-3b screens + tokens★ ─► FW foundation wave
                              ├─ Joint:        UX-3a shared contracts★ (UX needs ↔ System support), one interface spec
                              └─ System track: 5 Spikes ─► 6 Design★ (all safeguards)
                                                     ▼  per-ticket readiness (§3)
                              7 Tickets★ (frontend · backend · integration; four passes) ─► 8 Build (FE + BE, UX-5a)
                              ─► UX-5b final acceptance★ ─► 9 Experiment★ ─► 10 Ship
                              UX-4 = optional, any time a named interaction uncertainty needs it
```

## 2. The shared contract agreement (UX-3a)

**UX defines what the experience needs; system design establishes how those promises are supported.** The relevant
behaviour is agreed before either side relies on it.

- **One canonical interface specification** per project, `docs/contracts/`:
  - `INTERFACE.md` — the behavioural contract cards (`CON-N`). Each card covers, where relevant: operation(s),
    fields, states, permissions, named errors, recovery, guarantees (what is promised, e.g. "Approve pins the
    snapshot hash; a stale pin returns 409 and changes nothing"), timing (e.g. "checks re-run within 5 s of a store"),
    the screens and stories that need it, the backend owner, and a **status**: `draft` → `proposed` → `agreed`
    (or `changing`, see the change procedure). Product behaviour is kept distinct from presentation: moving a summary
    into a sidebar is presentation; adding a reservation or changing what "approved" means is behaviour.
  - `interface.openapi.yaml` — the machine form of the same promises. **Generated types, mocks (Prism) and contract
    checks all consume this one file.** Its operations name their `CON-N`.
  - `CHANGES.md` — the change log (`CHG-N`).
- **Ownership and review:** the UX side owns *needs* (which operations, fields, states, errors a screen requires);
  the System side owns *support* (feasibility, guarantees, timing, errors it can promise). A card becomes `agreed`
  when both sides have reviewed it (named reviewer per side, dated) and every product-behaviour question in it has
  Innocent's decision. In a one-person project both reviews may be the same session, but they are recorded separately.
- **Internal component contracts (§6 DO-4)** link to `CON-N` and never duplicate or contradict its promises; DO-4
  adds internal signatures, not new external behaviour.
- **Old layout:** projects that already have `docs/ux/03-structure/UI_CONTRACTS.md` keep it as a pointer to
  `docs/contracts/` (or migrate it).

**Change procedure** (for any change to an `agreed` card, including semantic changes that leave the schema the same):
1. **Identify** the changed promise: `CON-N`, the aspect (operation, field, state, permission, error, recovery,
   guarantee, timing) and whether it is **presentation-only** or **behavioural**.
2. **Review consequences:** both sides review; a change to product meaning goes to Innocent.
3. **Update the sources:** `INTERFACE.md`, the OpenAPI file, DO-4 links, screen specs.
4. **Mark** affected design sections, tickets, code and evidence with `reconcile: CHG-N` until each is reconciled.
5. **Unrelated work continues.** Only work citing the changed `CON-N` waits.

Schema validation alone does not catch a behavioural change; that is why every change is logged as a `CHG-N` with its
aspect, even when the OpenAPI file is unchanged.

## 3. Ticket readiness (per ticket, not per track)

| Ticket kind | Ready when | Does **not** need |
|---|---|---|
| **Backend feature** | §6 gate ticked **and** every `CON-N` it serves is `agreed` | UX-3b, UX-4, UX-5 |
| **Frontend feature** | §6 gate ticked **and** its screen spec (`SCR-N`) is signed **and** every `CON-N` it uses is `agreed` | a UX-4 prototype; UX-5 acceptance |
| **Integration** | *Planned* any time with explicit dependencies; *executed* when the frontend and backend tickets it joins are merged against the same agreed `CON-N` | — |
| **Foundation (FW)** | UX-2 direction picked **and** design tokens written **and** the foundation readiness record exists (§4) | §6 gate (it is presentation-only) |
| `lane::direct` / `lane::human` / `lane::spike` | as before (`ticket-lanes`) | — |

- A **product-wide slice plan** (7a) and **coverage audit** (7c) stay; implementation tickets are **specified one wave
  at a time** (7b). An incomplete screen spec for one feature never blocks otherwise-ready backend work.
- **Kept §6 safeguards:** the foundation questions (`system-design-questioning`), the design-outputs register
  (`design_outputs.py --gate tickets`), the code-design review (`metz-code-design-agent`), the signature-completeness
  check (`signature_check.py`), the other mechanical checks, the spec dry run, the coverage requirements sweep, and
  context-system maintenance (`check_context.py`, area map).
- **Checker:** `zero-to-hero/scripts/ticket_readiness.py` evaluates a ticket's readiness from the project's evidence
  (checklist gates, `docs/contracts/INTERFACE.md` statuses, screen-spec sign-offs, the foundation readiness record)
  and exits 1 with the missing conditions. Its tests hold the representative cases (§6).

## 4. The early frontend foundation wave (FW)

Allowed **after the UX-2 direction is picked and the design tokens exist**, while §5–§6 continue. Innocent approved
introducing this path (2026-10-25).

- **Readiness record** `docs/plans/foundation-wave.md` must state: the frontend **stack** (and the decision it comes
  from), the **owned files** (paths only this wave touches), the **bounded scope**, **dependencies**, the **ticket
  specs** (one per ticket, same format as §7b), and the **review requirements** (code review, accessibility check,
  visual check against the look sheet / `design.md`).
- **Eligible:** design tokens, typography, basic accessible components (button, link, input, badge/status pill,
  banner, card, table, tabs, stepper, dialog shell), layout primitives (app shell, sidebar, page header, split
  panes). **Not eligible** (normal feature path): anything behaviour-dependent — permissions, autosave,
  resumability, booking or job state, data fetching, backend error recovery, real-time collaboration.
- **Discipline:** the usual ticket and review rules apply (lanes, plan → implement → test → review, affected tests).
- **Acceptance examples** for presentation work are **presentation examples (`PE-N`)**, not invented backend worked
  pairs: e.g. "the primary button meets 4.5:1 text contrast on the panel in light and dark; its focus ring is
  visible at 3:1; its disabled state says so in text", "a status pill shows text and shape for every state", "the
  component gallery has 0 serious axe violations", "the gallery at 1280 px matches the look sheet's palette and
  radius tokens".

## 5. Checklist headings (the guard hook reads them)

Two-track checklists mark sections with `UX track` / `System track`. From 2.0.0 a third marker, **`Joint track`**,
marks the shared-contract section. The hook reports one current gate per marked track and, after the fork, says that
§7 readiness is **per ticket** (`ticket_readiness.py`) instead of "both tracks closed". Checklists from 1.x keep their
old reporting.

Template order after §4: `4b · UX-1 (fork)` → `UX-2 · Visual direction ★ — UX track` → `UX-3a · Shared contracts ★ —
Joint track` → `UX-3b · Screens and tokens ★ — UX track` → `FW · Early frontend foundation wave — UX track` →
`5 · Spikes — System track` → `6 · Design — System track` → `7 · Tickets ★` → `8 · Build` (with UX-5a items) →
`UX-4 · Focused interaction prototype (optional)` → `UX-5b · Final acceptance ★` → `9` → `10`.

## 6. Representative validation cases

1. **Allowed early foundation ticket:** FW-1 "design tokens and typography" — UX-2 picked, `design.md` tokens written,
   readiness record present, §6 *not* ticked → **ready**.
2. **Feature ticket blocked by unresolved behaviour:** a frontend ticket for SCR-14 (approval review) whose `CON-18`
   is still `proposed` because "who may reopen" (UXP-4) is undecided → **not ready**, reason names `CON-18`.
3. **Ready frontend ticket with no full prototype:** a frontend ticket for SCR-4 (validation report) — §6 ticked,
   SCR-4 signed, `CON-3`/`CON-4` agreed, no UX-4, no UX-5 → **ready**.
4. **Foundation ticket reaching into behaviour:** FW ticket listing "autosave" in scope → **not ready**
   (out of foundation scope).
5. **Backend ticket before §6:** → **not ready**, reason "§6 gate".
6. **Integration ticket:** plannable, executable only when its frontend and backend tickets are merged.

## History

- 1.5.0–1.14.1: two tracks joined at tickets; full prototype (UX-4) as the real frontend; §8 backend plus plumbing;
  since 1.14.0 backend tickets after UX-3 contracts + §6, frontend-serving ticket after UX-4, UI integration after UX-5.
- 2.0.0 (this file): joint contracts from UX-1, per-ticket readiness, FE + BE in §8, optional focused UX-4, UX-5 split.
