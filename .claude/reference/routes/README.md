# Area routes — what a planner reads first for one area

A route is a short, linked page for one area: what it is for, which sources govern it, where its code and tests
already are, and what must be checked live before planning. It routes; it does not copy code, contracts or ticket
status. The [area map](../area-map.md) says **who owns which paths**; a route says **how to work in them**.

**Example.** A planner gets NL-66 (SCR-11 Resolve). The dispatch names `routes/a14-web-ui-screens.md`. In one read the
planner learns that `ResolveDialog` is still an NL-24 shell, that `respondWithError` and `signInAs` already exist, that a
new e2e folder must be listed in the `mock` project's `testMatch`, and that the Resolve and Clear-flag buttons already
exist (NL-64's `IssueOpenerButtons`) while mounting the dialog is still the SLOT in `workspace-screen.tsx`. Without the route, the W4 screen planners found these facts by grep: a median of 17 search calls each.

## Status words (as in the router)

| Word | Means |
|---|---|
| **built** | present in code at the route's *As of* commit |
| **verified at merge** | built by a ticket listed in `docs/plans/merged.txt`, so its affected tests passed the batch gate |
| **planned** | a ticket or design names it; not in code at the *As of* commit |

A route never says whether a ticket is open, in flight or merged. That lives in GitLab 2346 and `docs/plans/merged.txt`;
each route lists the checks to make there.

## Routes

| Route | Serves (upcoming at `9951739`) |
|---|---|
| [`a14-web-ui-screens.md`](a14-web-ui-screens.md) | NL-65, 66, 67, 69, 70, 71 (planned at `b5034cf`, being built), NL-72, 73–76 (not yet planned) |
| [`integration-real-stack.md`](integration-real-stack.md) | NL-93–99, NL-100–104, NL-113–117 (pattern set by NL-90, merged) |
| [`a11-collab-commands.md`](a11-collab-commands.md) | NL-105, NL-106 |
| [`backend-w4-leftovers.md`](backend-w4-leftovers.md) | NL-87 (spike import), NL-88 (guidance save), NL-89 (judge), NL-91 (coverage) |
| [`shared-conventions.md`](shared-conventions.md) | every build ticket: errors, ids, settings, test DB, test globs, devlog and context upkeep |

## Upkeep (who changes a route, and when)

- **Explorers and planners** report a missing or wrong route fact in their reply (`Route gaps:` one line each, with the
  path they had to find). They do not edit routes.
- **Implementers** report durable facts they created or changed inside their owned area (`Route facts:` one line each:
  new export, new helper, a name that differs from the contract). They do not edit routes.
- **The integration owner** (the batch merge step) reconciles routes and the area map once per batch, after the merges,
  from those lines. One writer, so no merge conflicts on these files.
- A route's *Stale when* list names the changes that invalidate it; whoever makes such a change updates the route's
  *As of* line or marks the fact *re-check*.
