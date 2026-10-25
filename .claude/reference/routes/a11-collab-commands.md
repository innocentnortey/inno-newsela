# Route: A11 collab commands (NL-105 internal command routes, NL-106 submit freeze)

As of main `9951739` (2026-10-25). Status words: [routes/README](README.md). Owner of paths: [area map](../area-map.md)
row A11 (`apps/collab/**` except `main.ts`, `health.ts`).

## Responsibility and governing sources

The collab server accepts internal commands from the web server (apply an edit tagged by author, set a lesson's mode,
lock and snapshot on submit), so review actions and the editor's document stay one source of truth.

| What decides | Where |
|---|---|
| The command port and its errors | DO-4 `docs/design/component-contracts.md`, the `CollabCommands` port; DO-3 §3 names `CollabCommandHandler` as its server side |
| Behaviour seen by users | `INTERFACE.md` `CON-12` (co-editing), `CON-18` (submit/approve) |
| Freeze and gate rules | the ticket; `packages/core/src/checks/gates.ts` `submit_gate` |

## Entry points and integration points

| Thing | Path · symbol | Status |
|---|---|---|
| Port (shared with the web client) | `packages/core/src/ports/collab-commands.ts` `CollabCommands` (`lock_and_snapshot`, `apply_edit`, `set_mode`) | built (NL-12) |
| Web-side client | `apps/web/src/server/adapters/collab-commands.ts` `HttpCollabCommandClient` | verified at merge (NL-36) |
| Server dispatch | `apps/collab/src/commands/routes.ts` `is_internal_path`, `handle_internal` (dispatch only, 20 lines) | built (NL-07) |
| Command bodies | `apps/collab/src/commands/{apply-edit,set-mode}.ts` (FILLER NL-105), `lock-and-snapshot.ts` (FILLER NL-106): 2-line stubs | stub |
| Server-side handler class | `CollabCommandHandler` | **planned**: the name is in DO-3/DO-4 and the area map's port list, not in code |
| Wiring | `apps/collab/src/wiring/commands.ts` `wire_collab_commands` (stub, FILLER NL-105); called from `apps/collab/src/main.ts` | stub |
| Collab building blocks | `apps/collab/src/frozen-docs.ts` `FrozenDocs`; `acks.ts` `AckBroadcaster`; `persistence.ts` `LessonPersistence.store`; `auth.ts`, `permissions.ts` | verified at merge (NL-80) |
| Checks used by the freeze | `packages/core/src/checks/context-loader.ts` (`CheckContextLoader`), `packages/core/src/checks/gates.ts` `submit_gate` | verified at merge (NL-38, NL-20) |

## Tests, fixtures and supported doubles

- `packages/core/src/testing/fake-collab-commands.ts` `FakeCollabCommands` (web-side double).
- `apps/collab/src/nl-80.fixtures.ts` (collab test fakes, incl. a `store` stub); `apps/collab/src/persistence.int.test.ts`
  shows a DB-backed collab test (`create_test_db({ pool_max: 8 })`).
- Vitest collects `apps/collab/src/**/*.test.ts` (root `vitest.workspace.ts`, project `workspaces`).

## Check before planning

- NL-105 and NL-106 are **not** ordered (NL-106's *Blocked by* is NL-20, 21, 38, 42, 80), yet both fill files that
  `routes.ts` dispatches and `wiring/commands.ts` (FILLER NL-105) wires. Check the slice plan's collision map for who
  owns the handler class and the wiring line before assuming either; if neither plan owns them, raise it, don't block.
- **S-9:** a revoked session keeps write rights until lock because the socket is not re-checked after connect. NL-105
  is named as its fix.
- Whether a `CHG-N` touched CON-12 or CON-18 since the tickets were cut.

## Stale when

- NL-105 merges (the handler and wiring become real); NL-106 merges (`lock-and-snapshot.ts`);
- the `CollabCommands` port changes; S-9 is closed.
