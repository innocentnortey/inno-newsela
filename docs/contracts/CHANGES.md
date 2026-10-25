# Contract changes — Newsela Lesson Studio

> **What this is:** the log of every change to a contract card in [`INTERFACE.md`](INTERFACE.md) once it is `agreed`,
> and the procedure that every change follows. **Date started:** 2026-10-25. **Process:** zero-to-hero 2.0.0, revision
> [`2026-10-25-concurrent-frontend.md`](../../../.claude/skills/zero-to-hero/proposals/2026-10-25-concurrent-frontend.md) §2.

## When a change needs a `CHG-N`

Any change to an `agreed` card gets a `CHG-N` row, **including a change that leaves the OpenAPI file the same**.

Example: CON-18 says Approve returns 409 `STALE_PIN` when the pinned hash differs. Suppose we decide Approve should also
refuse when the snapshot is older than 24 hours. The request and response shapes do not change, so schema validation
passes. But what "approved" means has changed. That is a behavioural change, and it is logged here. Schema checks alone
never catch it.

Cards still `draft` or `proposed` are edited in place without a `CHG-N`; their reviews simply start again.

## The procedure (five steps)

1. **Identify the changed promise.** Name the `CON-N` and the aspect: operation, field, state, permission, error,
   recovery, guarantee or timing. Say whether it is **presentation-only** (how something looks or where it sits, e.g.
   moving the checklist into a sidebar) or **behavioural** (what the product does or means, e.g. adding a reservation or
   changing who may reopen).
2. **Review the consequences.** Both sides review: the UX side (does every screen that needs this still get what it
   needs?) and the System side (can the backend keep the new promise, and what breaks?). A change to product meaning goes
   to Innocent, told as a story with options and an explicit decision line (rule `decision-requests-story-driven`).
3. **Update the sources.** In one change: the card in `INTERFACE.md` (status `changing` until step 4 is done, then back to
   `agreed`), `interface.openapi.yaml` (with `x-con` still pointing at the card), the §6 DO-4 links, and the screen specs
   that cite the card.
4. **Mark what must be reconciled.** Every design section, ticket, piece of code and piece of evidence that cites the
   changed `CON-N` gets the marker `reconcile: CHG-N`. The marker is removed when that item is reconciled. The row below
   lists them.
5. **Unrelated work continues.** Only work that cites the changed `CON-N` waits. Everything else carries on.

## Log

| CHG | Date | CON | Aspect | Kind | What changed | Decided by | Sources updated | Waiting to reconcile (`reconcile: CHG-N`) | Status |
|---|---|---|---|---|---|---|---|---|---|

*No changes yet. Every card is still `proposed`.*

## History

- 2026-10-25: the contracts were first drafted at UX-1 as one-line rows (CON-1…CON-24, all `draft`) in
  [`USER_FLOWS.md`](../ux/01-planning/USER_FLOWS.md), section "Draft contracts (UX-1)".
- 2026-10-25: moved here as full cards in `INTERFACE.md` (all `proposed`), with the OpenAPI draft
  `interface.openapi.yaml` 0.1.0, under the approved revision. This log starts empty; the move itself is not a `CHG`,
  because no card was `agreed` before it.
