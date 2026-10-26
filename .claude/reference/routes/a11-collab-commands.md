# Route: A11 collab commands (NL-105 internal command routes, NL-106 submit freeze)

As of main `5999d9b` (2026-10-26; HEAD, the NL-137 release SHA is not cut), reconciled by NL-140. Every ticket this route served is built; rows below say what exists. Status words: [routes/README](README.md). Owner of paths: [area map](../area-map.md)
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
| Command bodies | `apps/collab/src/commands/{apply-edit,set-mode}.ts` (NL-105), `lock-and-snapshot.ts` + `submit-gate.ts` + `live-doc.ts` (NL-106, Submit freeze) | built (NL-105, NL-106) |
| Server-side handler class | `CollabCommandHandler` in `commands/routes.ts` | built (NL-105) |
| Wiring | `apps/collab/src/wiring/commands.ts` `wire_collab_commands` (real tx, loader, rules, policy, issues); called from `apps/collab/src/main.ts` | built (NL-105, NL-106) |
| Collab building blocks | `apps/collab/src/frozen-docs.ts` `FrozenDocs`; `acks.ts` `AckBroadcaster`; `persistence.ts` `LessonPersistence.store`; `auth.ts`, `permissions.ts` | verified at merge (NL-80) |
| Checks used by the freeze | `packages/core/src/checks/context-loader.ts` (`CheckContextLoader`), `packages/core/src/checks/gates.ts` `submit_gate` | verified at merge (NL-38, NL-20) |

## Tests, fixtures and supported doubles

- `packages/core/src/testing/fake-collab-commands.ts` `FakeCollabCommands` (web-side double).
- `apps/collab/src/nl-80.fixtures.ts` (collab test fakes, incl. a `store` stub); `apps/collab/src/persistence.int.test.ts`
  shows a DB-backed collab test (`create_test_db({ pool_max: 8 })`).
- Vitest collects `apps/collab/src/**/*.test.ts` (root `vitest.workspace.ts`, project `workspaces`).

## Check before planning

- NL-105 then NL-106 (ordered): NL-105 owns the handler class and wiring; NL-106 added the Submit deps to `types.ts` and `wiring/commands.ts` (resolved).
- **S-9:** a revoked session keeps write rights until lock because the socket is not re-checked after connect. NL-105
  is named as its fix.
- Whether a `CHG-N` touched CON-12 or CON-18 since the tickets were cut.

## Stale when

- NL-105 merges (the handler and wiring become real); NL-106 merges (`lock-and-snapshot.ts`);
- the `CollabCommands` port changes; S-9 is closed.
