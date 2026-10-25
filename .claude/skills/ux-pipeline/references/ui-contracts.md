# The shared interface spec — what each screen needs, and what the backend promises

Added by Innocent's requirement (2026-10-18): the UX process must always say what contracts the backend
has to honour for the experience to work. **Rewritten for pilot v2 (2026-10-25,
`zero-to-hero/proposals/2026-10-25-concurrent-frontend.md`, approved by Innocent):** the contracts are now
one canonical spec, agreed jointly by the UX and System tracks at UX-3a, with a change procedure.

## What it is, concretely

A contract (`CON-N`) is a promise the backend makes to a screen. Example: *the booking screen can ask for
open slots, hold one for at least 5 minutes, extend the hold, and book it exactly once; a double-booking
comes back as a named error the screen can explain.* If the backend can't keep that promise, the screen
is lying, however polished it looks.

**UX defines what the experience needs; system design establishes how those promises are supported.**
The behaviour is agreed before either side relies on it. Then three things read the same file: the
frontend's generated types, the Prism mock the frontend is built against in §8, and the contract checks
that later test the real backend.

## Where it lives: one spec per project, `docs/contracts/`

| File | What it holds | Template |
|---|---|---|
| `INTERFACE.md` | The behavioural CON cards, with status and reviewers | `templates/INTERFACE.md` |
| `interface.openapi.yaml` | The machine form of the same promises (OpenAPI 3.1). Each operation names its `CON-N` in `x-con` | — |
| `CHANGES.md` | The change log, one `CHG-N` per change to an `agreed` card | `templates/CHANGES.md` |

**Older projects** that have `docs/ux/03-structure/UI_CONTRACTS.md` and `ui-contracts.openapi.yaml` keep
them as a pointer to `docs/contracts/` (template `templates/UI_CONTRACTS.md`), or migrate them. There is
never a second live copy of a card.

## How a contract sharpens over time

| When | Contract form |
|---|---|
| §4 (optional) | A *contract implication* noted beside each UX gap raised in the PRD interview ("needs a resumable intake session") |
| UX-1 | Every flow step that reads or writes data names a draft `CON-N` (name + one line), written into `INTERFACE.md` as `draft`. Open behaviour questions are `UXP-N` |
| UX-3a (joint, from UX-1 on) | Full cards: UX side writes the needs, System side writes the support; both review; Innocent decides `UXP-N` → `agreed` |
| §6 Design | DO-4 internal component contracts **link** to `CON-N`. They add internal signatures, never new external behaviour, and never contradict a card |
| §7 Tickets | Every ticket names the CONs it serves (backend) or uses (frontend). A ticket is ready only when those CONs are `agreed` (zero-to-hero `ticket_readiness.py`). Every CON gets a contract check |
| §8 Build | The frontend runs against a Prism mock of `interface.openapi.yaml`; the backend passes contract checks against the same file; integration tickets join them |
| UX-5b | Playwright runs through Prism **proxy** in front of the real backend: a response that breaks a contract fails |

## The CON card (in `INTERFACE.md`)

```
### CON-4 · Hold and book a consultation slot
- Status: agreed · UX review: <session/name, date> · System review: <session/name, date>
- Screens: SCR-6 Booking, SCR-7 Confirmation        Flows: FLOW-3 (+ error branch 3b)  Stories: US-5
- Requirements: M-03, SOL-04, rule 7g          Backend owner: <component / ticket area>
- Operations (OpenAPI operationId): listSlots, holdSlot, extendHold, bookSlot
- Fields: reads slot id, start, end, office, mode (in-home / phone), status; writes slot id, enquiry id,
  Idempotency-Key header
- States the UI must be able to show: available · held (expires_at) · requested · confirmed · expired
- Permissions: own record or active scoped permission (7i); staff role for confirm; others get FORBIDDEN
- Errors (named, each with the screen's response): SLOT_TAKEN → offer the next slots (T-5);
  HOLD_EXPIRED → re-offer the slot, nothing lost (T-2); RETRY_SAFE → same key, same result
- Recovery: an expired hold keeps the entered details; a retry with the same key never double-books
- Guarantees: book is exactly-once per Idempotency-Key; "confirmed" only after staff confirm (7g)
- Timing: list p95 < [T]; a hold lasts ≥ 5 min; book p95 < [T]  (from the brief's performance table)
- Data class and where it may go: no PII in this contract | PII: name/DOB → never to the LLM (PD-2)
- Open questions: UXP-2 (may staff move a confirmed slot?) → decided by Innocent <date>
- Mock examples: 3 synthetic responses, incl. one per error
```

**Statuses:** `draft` (UX-1, name + one line) → `proposed` (both sides have written their part) →
`agreed` (both reviews recorded, every product-behaviour question decided) → `changing` (an open `CHG-N`;
only work citing this card waits).

**Who owns what.**
- **UX side owns needs:** which operations, fields, states, permissions, named errors and recovery a screen requires.
- **System side owns support:** feasibility, guarantees, timing, and which errors it can promise.
- **Both review.** Each review is named and dated. In a one-person project both reviews may be the same
  session, but they are recorded separately.
- **Innocent decides product behaviour:** any question that changes what the product means.

## Rules

1. **Promises, not tables.** A CON describes what the UI can rely on (fields, states, permissions, errors,
   recovery, guarantees, timing), not how the backend stores it.
2. **Every UI state that comes from data comes from a CON.** If a screen can show *expired*, some
   contract must be able to say *expired*.
3. **Errors are named and designed.** Each error has a code and the screen's response. A generic
   500 is a contract gap.
4. **Privacy travels with the field.** Each field carries its data class, and the card says where
   that data may and may not go.
5. **Honest status.** Nothing relies on a card before it is `agreed`.
6. **Behaviour vs presentation.** Moving a summary into a sidebar is presentation: change the screen
   spec, not the contract. Adding a reservation, or changing what "approved" means, is behaviour: it is a
   contract change, even if no field changes.

## The change procedure (any change to an `agreed` card)

Schema validation alone does not catch a behavioural change. Example: "Approve" keeps the same request
and response, but now also locks the lesson for other reviewers. The OpenAPI file is unchanged, yet every
screen that assumed others could still edit is now wrong. So every change is logged as a `CHG-N` with its
aspect, even when the OpenAPI file is unchanged.

1. **Identify** the changed promise: `CON-N`, the aspect (operation, field, state, permission, error,
   recovery, guarantee, timing) and whether it is **presentation-only** or **behavioural**.
2. **Review consequences:** both sides review; a change to product meaning goes to Innocent.
3. **Update the sources:** `INTERFACE.md`, the OpenAPI file, the DO-4 links, the screen specs.
4. **Mark** the affected design sections, tickets, code and evidence with `reconcile: CHG-N` until each is
   reconciled, and tick each one off in `CHANGES.md`.
5. **Unrelated work continues.** Only work citing the changed `CON-N` waits.

## The OpenAPI file

- **File:** `docs/contracts/interface.openapi.yaml`, OpenAPI 3.1. Each operation's `operationId` matches a
  CON card's operations, carries `x-con: CON-N`, and has `examples` drawn from the synthetic samples.
- **Why OpenAPI:** it is language-neutral, so it works while the stack is open. One file drives the mock
  server, request and response validation, generated types for the frontend, and contract checks.
- **Lint:** `npx @redocly/cli lint docs/contracts/interface.openapi.yaml`
- **Mock (frontend work in §8, and UX-4 if used):**
  `npx @stoplight/prism-cli mock -p 4010 docs/contracts/interface.openapi.yaml --errors`
  (`--errors` makes a request that violates the contract fail loudly).
- **Contract check (backend in §8, and UX-5b):**
  `npx @stoplight/prism-cli proxy docs/contracts/interface.openapi.yaml <backend-url> --errors`.

## Review questions before a card is `agreed`

- Can every state in the state matrix be produced by some contract response?
- Does every named error have a screen response, and does every screen error have a code?
- Does every permission rule have a screen for the person who lacks it?
- Does any field cross a privacy boundary that the PRD forbids?
- Is any promise impossible for the backend as currently imagined? Send it to §3 as a hard problem
  or to §5 as a spike. Don't paper over it in the UI.
- Is any `UXP-N` it depends on still undecided? Then it stays `proposed`.
