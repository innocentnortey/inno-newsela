# GEN-6 plan: collab hardening from the seam audit (S-29 role recheck, plus three Lows)

Wave dir `2026-10-26-w10`. Lane `lane::build-loop`. **`risk::security`: YES** (authorization on an open socket): the test-writer freezes the tests in section 5 first, the manifest is `docs/plans/frozen-tests/GEN-6.manifest.json`, and `security-privacy-agent` reads this diff at the wave merge. **NEEDS-DECISION: no.**
Commands run from `/home/linuxuser/workspaces/inno-newsela` ("root"). Implementer: Sonnet, one worktree, affected tests only. Own random `E2E_PORT` if any web run is needed (none is planned), kill only your own processes, never `npm ci` (`bash scripts/link-node-modules.sh` if modules are missing), test DB only `scripts/test-db.sh up` (127.0.0.1:55440), never `down`. Another agent runs a 200-user load on this machine: no loops, no repeated runs, affected specs once. Disk ~6G: only your worktree; delete any `test-results` or `.next` you create. Never touch `docs/source/restricted` or provider keys.

## 1. What is wrong, in plain words

A socket authenticates once. Its `SocketContext` keeps `user.role`, `lesson_state` and `read_only` from that moment. The S-9 sweep (`apps/collab/src/session-recheck.ts`, every 1 s, one batched `live_hashes` query) closes a socket only when its session was signed out, revoked or expired. Example: a reviewer is demoted to author in `app_user`; their session is still live, so the sweep keeps them; `ctx.read_only` is still false, so `WriteGuard.on_update` still allows their edits and they are stored. The same hole exists if the user row is deleted, or if the lesson row has moved to a locked state but the `set_mode` command from the web never arrived.

A second, quieter bug rides on the first: `AckBroadcaster.mode()` (`acks.ts`) recomputes `read_only` from `ctx.user.role`. With a stale `reviewer` role, a later `set_mode editable` (for example after a reopen) would flip a demoted user back to writable. Refreshing `ctx.user.role` fixes that too.

## 2. Facts found on main (copied from code, 2026-10-26, main c46f4ef)

- `session-recheck.ts` (86 lines): `RecheckTarget { ctx: SocketContext | undefined; close(): void }`; `type LiveHashes = (hashes: string[], now: Date) => Promise<Set<string>>`; `class SessionRecheck { constructor(live_hashes, clock, logger); tick(get_targets): Promise<boolean>; sweep(targets): Promise<number> }`; `FAILURES_BEFORE_CLOSE = 3`, `SESSION_ENDED_CODE = 4401`, `SESSION_ENDED_REASON`. `sweep` returns the number of sockets closed; it returns 0 early when no target has `session_hash`; on a lookup failure it counts `failures`, and at 3 closes every socket carrying a session.
- `permissions.ts`: `SocketContext { socket_id; user: AppUserRow; lesson_id; lesson_state: LessonStateName; read_only; session_hash? }`. `WriteGuard.on_update` allows iff `!frozen && !ctx.read_only`.
- `acks.ts`: `AckBroadcaster.mode_to(socket_id, {mode, state})` sends the stateless `{"type":"mode",...}` to one socket, flags untouched. `mode(lesson_id, msg)` sets flags from `is_editable(state, ctx.user.role)`.
- `@ls/core/lifecycle/lesson-machine`: `is_editable(state, role)` is `role === "reviewer" && EDITABLE_STATES.includes(state)`.
- `wiring/server.ts`: `ServerPorts { sessions; states; doc_store; doc_reader; live_hashes? }`; `default_ports(d)` builds `PgSessionRepo`, `PgLessonRepo` on one lazy `PgDatabase`; the recheck timer (1000 ms, `unref`) builds targets from `live.documents` connections as `{ctx: c.context?.ctx, close: () => c.close({code: SESSION_ENDED_CODE, reason: SESSION_ENDED_REASON})}`; `LiveConnection` already has `readOnly: boolean`; `beforeHandleMessage` already refuses with `LESSON_LOCKED` when `ctx.read_only` and sets `connection.readOnly = true`.
- `packages/db/src/repos/sessions.ts`: `PgSessionRepo.live_hashes(token_hashes, now)` is `SELECT token_hash FROM app_session WHERE token_hash = ANY($1::text[]) AND revoked_at IS NULL AND expires_at > $2` (it does not join `app_user`). `app_user(id text, role text, ...)` has no active flag and no allow-list column: "removed from the allow list" can only mean the user row is gone or the role is no longer one that may edit. `SessionRepo` (core port) is faked by frozen `nl-80.fixtures.ts`, so do not add a required method to that interface.
- `packages/db/src/repos/lessons.ts`: `PgLessonRepo` has a private `read(sql, values)` helper (`with_tx` + query) and `get(lesson_id)`; `lesson.id` and `lesson.state` are text.
- `main.ts` line 40-ish: `void wire_collab_commands(deps, sw, ref)`. **`wire_collab_commands` is synchronous and returns `CollabCommandWiring { handler }`; it is not async.** So the seam audit's "a throw is an unhandled rejection" is not quite right: a sync throw already rejects `build_collab_runtime` and reaches the `.catch` that prints `collab failed to start` and exits 1. The real defects are (a) the returned wiring is discarded with `void`, so nothing can close its pool, and (b) if it throws, `sw` (the server wiring: recheck timer and its own pool) is left running. Fix both; no `await` is needed or meaningful.
- `wiring/commands.ts`: builds `new PgDatabase(..., Math.min(4, pg_pool_max), 2000, "collab")` as `db`; nothing closes it; `CollabCommandWiring` has only `handler`. `install_command_handler(handler | null)` is in `commands/routes.ts`.
- `main.ts` drain: `install_drain({ close: async () => { await server.destroy(); await sw.close().catch(...); health_db close } })`.
- `deps.ts`: `db: unbuilt("NL-36")` Proxy stub. A search of `apps/collab/src` shows no production read of `deps.db` / `d.db`; `wiring/server.ts` carries a comment that it is "an unbuilt stand-in". Frozen tests (`wiring/commands.test.ts`, `apply-edit.int.test.ts`, `con-12/helpers.ts`, `persistence.int.test.ts`) build `CollabDeps` object literals that include `db: ... as never`, so the **field must stay in the type** (as optional) or those frozen files stop typechecking.
- Frozen already (do not edit): `nl-80.fixtures.ts`, `permissions.test.ts`, `frozen-docs.test.ts` (NL-80 manifest), `wiring/commands.test.ts` and friends (NL-105 manifest), `apps/web/e2e/integration/con-12/*` (NL-101). Existing `session-recheck.test.ts`, `main.test.ts`, `wiring/server.test.ts` must keep passing unchanged.
- Int-test pattern to copy: `apps/collab/src/persistence.int.test.ts` (real Postgres via `create_test_db`, real `Server` + `wire_collab_server`, real `@hocuspocus/provider` with a cookie `WebSocket` subclass, `insert_row`, `PgSessionRepo.create_session`, `count()` helper, `of_type(client, "refused")`).

## 3. Design (all decisions made)

### 3.1 What the recheck now checks, per socket, once per sweep

After the existing session check (unchanged, same batching, same fail-closed), for every socket whose session is still live, compare **current** facts with the socket's context:

1. Current role of `ctx.user.user_id` from `app_user`.
2. Current state of `ctx.lesson_id` from `lesson`.

Decision table (editable now = `is_editable(db_state, current_role)`):

| Situation | Action |
|---|---|
| user row missing (deleted/removed) | close with code 4401 and the existing reason, log `reason: "user_removed"` |
| lesson row missing | treat as not editable: downgrade if the socket is writable |
| role changed (any direction) | set `ctx.user = { ...ctx.user, role: current }` so `AckBroadcaster.mode()` uses the truth |
| not editable now and `ctx.read_only === false` | **downgrade**: `ctx.read_only = true`, `ctx.lesson_state = db_state`, connection `readOnly = true`, send `{"type":"mode","mode":"read_only","state":db_state}` to that socket; log `collab.role_downgraded` (lesson id, `from`, `to`, `reason: "role" or "state"`; never an email or name) |
| editable now but the socket is read-only | leave read-only. **Never upgrade in the recheck.** A raised role takes effect on reconnect, or through `set_mode` (which now sees the refreshed role) |
| already read-only | no message, no log (no repeat sends every second) |

Why downgrade and not close: SP-2 option A says a lock never closes the socket (the client keeps reading and sees the "refused" path). A demoted user may still read the lesson. Removal of the user or the session is different: they get closed.

The in-memory `FrozenDocs` flag is deliberately not consulted. A freeze is transient during Submit (`lock_and_snapshot`); if the recheck downgraded on it and the transition rolled back, the socket would stay read-only. `WriteGuard.on_update` already enforces the freeze on every update.

### 3.2 Batching and cost

One extra `Promise.all` of two queries per sweep, constant in the number of sockets (not per socket): `app_user WHERE id = ANY($1)` and `lesson WHERE id = ANY($1)`. Both are skipped when no socket's session is live. `tick` still never overlaps itself. Result: 3 small indexed reads per second per collab process in total.

### 3.3 Fail-closed discipline for the new lookup

Separate counter `access_failures` (so a healthy session lookup cannot mask a failing access lookup, and the reverse). A failed access lookup leaves sockets untouched and logs `collab.access_recheck_failed` with `consecutive`. At `FAILURES_BEFORE_CLOSE` (3) consecutive failures, every **still-writable** socket (live session, `ctx.read_only === false`) is closed with 4401 and `reason: "unverified_access"`. Read-only sockets are left open (they cannot write, closing them gains nothing). A successful lookup resets the counter. If `downgrade` is missing or throws, the socket is closed instead (fail closed).

### 3.4 Where the lookup comes from

`ServerPorts` gets an optional `current_access?: CurrentAccess` (same pattern as `live_hashes?`). `default_ports` supplies it from two new read-only methods on concrete repos (not on core interfaces, so frozen fakes still compile):

- `PgSessionRepo.roles_of(user_ids: UserId[]): Promise<Map<UserId, RoleName>>`
- `PgLessonRepo.states_of(lesson_ids: LessonId[]): Promise<Map<LessonId, LessonStateName>>`

If `ports.current_access` is absent (a unit test passing its own ports), the access check is skipped and behaviour equals today's S-9. Production always goes through `default_ports`, so it is always on there; a test pins that (section 5, T-12).

## 4. Production changes (exact)

### 4.1 `packages/db/src/repos/sessions.ts`
Add to `PgSessionRepo` (below `live_hashes`):
```ts
/** Current role of each user id: one query for any number of ids (collab S-29 sweep). Absent id = no such user. */
async roles_of(user_ids: UserId[]): Promise<Map<UserId, RoleName>> {
  if (user_ids.length === 0) return new Map();
  return this.db.with_tx(async (tx) => {
    const { rows } = await (tx as DbTx).query<{ id: string; role: RoleName }>(
      "SELECT id, role FROM app_user WHERE id = ANY($1::text[])", [user_ids]);
    return new Map(rows.map((r) => [r.id as UserId, r.role]));
  });
}
```

### 4.2 `packages/db/src/repos/lessons.ts`
Add to `PgLessonRepo` (near `get`), using the private `read` helper:
```ts
/** Current state of each lesson id: one query for any number of ids (collab S-29 sweep). Absent id = no such lesson. */
async states_of(lesson_ids: LessonId[]): Promise<Map<LessonId, LessonStateName>> {
  if (lesson_ids.length === 0) return new Map();
  const rows = await this.read<{ id: string; state: LessonStateName }>(
    "SELECT id, state FROM lesson WHERE id = ANY($1::text[])", [lesson_ids]);
  return new Map(rows.map((r) => [r.id as LessonId, r.state]));
}
```
(Match the file's existing `Row` typing for `read<R extends Row>`; adjust the generic to compile.)

### 4.3 `apps/collab/src/session-recheck.ts`
- New exports:
```ts
export interface AccessSnapshot { roles: Map<UserId, RoleName>; states: Map<LessonId, LessonStateName> }
export type CurrentAccess = (user_ids: UserId[], lesson_ids: LessonId[]) => Promise<AccessSnapshot>;
export interface Downgrade { role: RoleName | null; state: LessonStateName; reason: "role" | "state" }
```
- `RecheckTarget` gains `downgrade?(d: Downgrade): void`.
- Constructor gains an optional 4th parameter `private readonly current_access?: CurrentAccess` (the 3-arg form used by `session-recheck.test.ts` keeps working).
- `sweep`: keep the session part exactly as is. After it, if `current_access` is set and `live !== null`, collect targets with a `ctx` whose session hash is in `live` and that were not just closed; if none, return. Call `current_access` once with the distinct user ids and distinct lesson ids; apply the table in 3.1 and the counter in 3.3. Keep the return value as the **total number of sockets closed** (session closes plus access closes). Add a `downgraded` count to the returned log line only (do not change the return type).
- Import `is_editable` from `@ls/core/lifecycle/lesson-machine` (collab already imports it elsewhere). No new dependency.
- Never log a cookie, token, hash, email or name.

### 4.4 `apps/collab/src/wiring/server.ts`
- `ServerPorts.current_access?: CurrentAccess`.
- `default_ports`: add
```ts
current_access: async (u, l) => {
  const [roles, st] = await Promise.all([session_repo.roles_of(u), states.states_of(l)]);
  return { roles, states: st };
},
```
(`states` is the `PgLessonRepo` already built there; keep its concrete type, not the `LessonStateRepo` port.)
- Recheck wiring: pass `ports.current_access` as the 4th constructor argument; each target also gets
```ts
downgrade: (dg) => { c.readOnly = true; acks.mode_to(c.socketId, { mode: "read_only", state: dg.state }); },
```
(`acks` is in scope in `wire_collab_server`.)
- Keep `SESSION_RECHECK_MS = 1000`.

### 4.5 Lows
1. `apps/collab/src/wiring/commands.ts`: `CollabCommandWiring` becomes `{ handler; close(): Promise<void> }`. `close` does `install_command_handler(null)` then `await db.close()`; safe to call twice (swallow nothing silently: let a second `PgDatabase.close()` behave as it does; the test pins that calling it twice does not throw, adjust with a `closed` flag if it does).
2. `apps/collab/src/main.ts`: replace `void wire_collab_commands(...)` with
```ts
let cmds: CollabCommandWiring;
try {
  cmds = wire_collab_commands(deps, sw, ref);
} catch (e) {
  await sw.close().catch(() => undefined);
  throw e; // startup fails loudly: the entry point's .catch prints the error name and exits 1
}
```
placed before `await server.listen()` as today. In the drain `close`, after `await sw.close()...` add `await cmds.close().catch(() => undefined);`. Drop the stale comment "mounting is NL-80 / NL-105". Do **not** add `await`: the function is synchronous (see section 2).
3. `apps/collab/src/deps.ts`: delete the `unbuilt` helper and the `db:` line. `apps/collab/src/deps-types.ts`: change `db: TxRunner;` to `db?: TxRunner;` (keeps the frozen literals compiling). Remove the unused `TxRunner` re-export only if nothing imports it (`grep -rn "TxRunner" apps/collab`); leave it otherwise.

### 4.6 Context upkeep (same change, `lane::direct`-style edits inside this ticket)
- `docs/plans/seam-followups.md`: S-29 row status becomes `done: GEN-6 (...)`, one sentence. Add a one-line row only if a new gap appears.
- `.claude/reference/area-map.md` collab row (line ~50): extend the `session-recheck.ts` clause: "GEN-6 built the role/lesson-state recheck (downgrade to read-only, close on user removal), `PgSessionRepo.roles_of`, `PgLessonRepo.states_of`; `CollabCommandWiring.close`".
- One dev-log entry in the run file the ticket's run uses (Changed, Why, Checked, Remaining). Update `.claude/state/resume.md` only if the orchestrator asks.
- No CHG: the `mode` stateless message and close code 4401 already exist in the CON-12 channel.

## 5. Tests to freeze first (test-writer, `risk::security`)

All three files are new. Do not edit any existing test. They must fail for the right reason before the implementation (missing `current_access`, `roles_of`, `states_of`, `close`, still-present `db`), and the suite must still collect. Test data is synthetic (`Synthetic u-rev-1` style, `*.demo@example.org`), as in `persistence.int.test.ts`.

### 5.1 `apps/collab/src/access-recheck.test.ts` (unit, fakes, no database; imports `SessionRecheck`, `FAILURES_BEFORE_CLOSE`, `SESSION_ENDED_CODE` and the fixtures `capture_logger`, `clock`, `sha256`, `user` from `nl-80.fixtures.ts`)
Helpers: `ctx(token, role, lesson, state, read_only)` builds a `SocketContext` with `session_hash = sha256(token)` and `user = user(role, id)`; `target(ctx)` returns `{ctx, close: vi.fn(), downgrade: vi.fn()}`; `access(roles, states)` returns a `CurrentAccess`; `live_all` returns every hash.

- T-1 `demoted_reviewer_is_downgraded_not_closed`: socket ctx role `reviewer`, state `in_review`, writable; access says role `author`, state `in_review`. After `sweep`: `downgrade` called once with `{role:"author", state:"in_review", reason:"role"}`; `close` not called; `ctx.read_only === true`; `ctx.user.role === "author"`; sweep returns 0.
- T-2 `approver_demoted_to_author_is_also_downgraded`: same with `approver`→`author` where the socket was somehow writable (ctx.read_only false) — pins that the check is "is editable now", not "was reviewer".
- T-3 `removed_user_is_closed`: role map lacks the user id: `close` called once, `downgrade` not called, sweep returns 1, log line carries `reason: "user_removed"`.
- T-4 `locked_lesson_state_downgrades_even_with_reviewer_role`: access says role `reviewer`, state `submitted` (the `set_mode` never arrived): downgrade with `reason:"state"`, `ctx.lesson_state === "submitted"`.
- T-5 `missing_lesson_row_downgrades`: states map lacks the lesson: downgrade (not close).
- T-6 `unchanged_reviewer_in_review_is_left_alone`: no downgrade, no close, `ctx.read_only` false.
- T-7 `[negative] raised_role_never_upgrades_in_recheck`: socket read-only as `author`, access says `reviewer` + `in_review`: `ctx.read_only` stays true, `downgrade` not called, `ctx.user.role === "reviewer"` (refreshed).
- T-8 `already_read_only_socket_is_not_messaged_again`: read-only socket, role still non-editing: `downgrade` and `close` not called across three sweeps.
- T-9 `access_lookup_is_batched`: 5 sockets over 2 users and 3 lessons, plus one with `ctx` undefined: the access function is called exactly once per sweep, with 2 distinct user ids and 3 distinct lesson ids; the session lookup is still called exactly once.
- T-10 `[negative] access_lookup_failure_fails_closed_on_third`: access function throws; sweeps 1 and 2: nothing closed or downgraded; sweep 3: the writable socket is closed, a read-only socket is not; a successful sweep in between resets the count (mirror the structure of the existing session-failure test); the session counter and the access counter are independent (3 session failures still close everything as today).
- T-11 `[negative] downgrade_that_throws_falls_back_to_close` and `a_close_that_throws_does_not_stop_the_others`.
- T-12 `dead_session_wins`: a socket whose session is not live is closed once and is not passed to the access lookup (its user id is absent from the lookup arguments).
- T-13 `without_current_access_behaviour_is_the_s9_sweep`: a 3-arg `SessionRecheck` never calls `downgrade`.

### 5.2 `apps/collab/src/access-recheck.int.test.ts` (real Postgres, real Hocuspocus, real provider; copy the harness of `persistence.int.test.ts`, `start()`, `connect()`, `of_type`, `count`, `until`)
Seed in `beforeAll`: users `u-rev-1`, `u-rev-2` (reviewer), `u-author-1`, `u-gone-1` (reviewer) each with a live session; WP-1 lesson `in_review` via `store.seed_initial`. Each test seeds what it mutates and restores nothing it does not own; use a fresh lesson id per test where state changes (`insert_row(tx, "lesson", {id: ..., state: "in_review"})` + `seed_initial`) so tests do not interfere. The recheck runs every 1 s, so waits use `until(..., 8000, ...)`.

- I-1 `demoted_editor_next_recheck_limits_it_and_nothing_is_stored` (the headline): connect `u-rev-1` and `u-rev-2`; `u-rev-1` writes "BEFORE-DEMOTION" and it is stored (wait past the debounce, `lesson_doc` count rises by 1). Then `UPDATE app_user SET role='author' WHERE id='u-rev-1'`. Wait until `u-rev-1` receives a stateless `{type:"mode", mode:"read_only"}`. Record `lesson_doc` count and `audit_event` count and the server doc's state vector. `u-rev-1` edits "AFTER-DEMOTION": wait for a `refused` message with code `LESSON_LOCKED` and a string `refused_from`; sleep past the debounce (900 ms with debounce 200); assert the server doc title is not "AFTER-DEMOTION", `lesson_doc` and `audit_event` counts unchanged, state vector unchanged. Positive control: `u-rev-2` (still reviewer) edits and that edit is stored (count +1), and `u-rev-2` received no `refused`. The demoted socket is still open (read-only), not closed.
- I-2 `demoted_user_is_not_resurrected_by_a_later_set_mode_editable`: after I-1's demotion state, call `wiring.acks.mode(lessonId, {mode:"editable", state:"in_review"})`: the demoted socket's `ctx.read_only` stays true (read through `h.server.hocuspocus.documents.get(DOC).getConnections()`), its further edit is refused, and nothing is stored.
- I-3 `locked_state_without_a_set_mode_command_downgrades`: connected reviewer on a fresh `in_review` lesson; `UPDATE lesson SET state='submitted'`; next recheck sends `mode read_only` with `state:"submitted"`; its edit is refused; nothing stored.
- I-4 `removed_user_socket_is_closed_with_4401`: connect `u-gone-1`; `DELETE FROM app_user WHERE id='u-gone-1'` (sessions stay); the provider observes a close with code 4401 within 8 s (use the `onClose` / `onDisconnect` event, or a raw `WebSocket` from `session-close-code.spec.ts` if the provider hides the code; assert the socket is no longer open and no write after it lands).
- I-5 `[negative] sign-out_still_closes` (regression for S-9): revoke the session (`PgSessionRepo.revoke`), socket closes. Keeps the old behaviour pinned with the new query path active.
- I-6 `queries_are_batched_and_exact` (repo level, no server): `roles_of([a,b,missing])` returns a map with exactly a and b; `roles_of([])` returns an empty map without touching the pool (assert via a counting wrapper or by closing the pool first); `states_of` likewise.

### 5.3 `apps/collab/src/gen6-lows.test.ts` (unit; uses `vi.mock` so nothing needs a database)
- L-1 `commands_wiring_close_closes_the_pool_and_uninstalls_the_handler`: `wire_collab_commands(deps, sw, {hocuspocus: null}, fakes)` returns an object with a function `close`; after `await w.close()` the installed command handler is gone (a call through the routes returns the not-installed response/404 path used by `routes.test.ts`, or assert via `install_command_handler` spy); calling `close()` a second time does not throw.
- L-2 `startup_fails_loudly_and_cleans_up_when_commands_wiring_throws`: `vi.mock("./wiring/commands.ts", () => ({ wire_collab_commands: () => { throw new Error("BOOM-GEN6"); } }))`; spy on the real `wire_collab_server` result's `close` (wrap `importActual`); `await expect(build_collab_runtime(settings, {port: 0, health_db: FAKE_DB, log_write: () => {}, exit: vi.fn(), signal_host: ...})).rejects.toThrow("BOOM-GEN6")`; the spy shows `sw.close` was called once and the process did not start listening (no `process.start` log line).
- L-3 `drain_closes_the_commands_pool`: with `wire_collab_commands` mocked to return `{handler: {} as never, close: spy}`, build the runtime, trigger drain through the captured `SIGTERM` handler (pattern in `main.test.ts`), `await rt.stop()`, expect `spy` called once and after `server.destroy` ordering is not required.
- L-4 `collab_deps_no_longer_carry_a_db_stub`: `build_collab_deps(settings(), logger)` has no own `db` property (`"db" in deps === false`), and `clock`, `ids`, `logger`, `settings` are present. A compile-time line `const _t: CollabDeps = { settings, logger, db: undefined as never, ids, clock };` pins that frozen literals still typecheck.

### 5.4 Manifest
`docs/plans/frozen-tests/GEN-6.manifest.json`, same shape as `NL-101.manifest.json`:
```json
{
  "ticket": "GEN-6",
  "risk": "security",
  "frozen": { "<path>": "<sha256>", ... the three files above ... },
  "criteria": {
    "AC-1": ["apps/collab/src/access-recheck.test.ts", "apps/collab/src/access-recheck.int.test.ts"],
    "AC-2": ["apps/collab/src/access-recheck.test.ts"],
    "AC-3": ["apps/collab/src/access-recheck.int.test.ts"],
    "AC-4": ["apps/collab/src/gen6-lows.test.ts"]
  },
  "not_frozen": [
    "apps/collab/src/session-recheck.ts", "apps/collab/src/wiring/**", "apps/collab/src/main.ts",
    "apps/collab/src/deps.ts", "apps/collab/src/deps-types.ts",
    "packages/db/src/repos/sessions.ts", "packages/db/src/repos/lessons.ts"
  ]
}
```
Acceptance criteria the manifest maps (write them into the issue/ticket text if the orchestrator wants them there): AC-1 a demoted or role-changed editor cannot store a write after the next recheck; AC-2 the new lookup is batched and fails closed after 3 failures; AC-3 user removal closes the socket and a locked lesson state downgrades it without a `set_mode`; AC-4 the three Lows. The implementer edits none of the frozen files; the tamper check compares the hashes.

## 6. Order, owned files, collisions

Order for the implementer: 4.1 and 4.2 (db methods) then 4.3 (recheck) then 4.4 (wiring) then 4.5 (Lows) then 4.6 (docs). Run the unit file after 4.3, the int file after 4.4, the Lows file after 4.5.

Owned (may edit): `apps/collab/src/session-recheck.ts`, `apps/collab/src/wiring/server.ts`, `apps/collab/src/wiring/commands.ts`, `apps/collab/src/main.ts`, `apps/collab/src/deps.ts`, `apps/collab/src/deps-types.ts`, `packages/db/src/repos/sessions.ts` (add one method only), `packages/db/src/repos/lessons.ts` (add one method only), the three docs in 4.6.
Read-only: everything else, in particular `acks.ts`, `permissions.ts`, `auth.ts`, the frozen tests and `nl-80.fixtures.ts`.
Collisions: GEN-3 touched `packages/db` issues/lessons repos and is merged; GEN-4 and GEN-5 are not in `apps/collab/src/{session-recheck,main,deps,wiring}` (GEN-5 is explicitly web-only). `lessons.ts` is a shared file: add only `states_of`; do not reorder or reformat.

## 7. Checks (affected only; run cheapest first, once each)

1. `scripts/test-db.sh up` (never `down`).
2. `npx eslint apps/collab packages/db/src/repos/sessions.ts packages/db/src/repos/lessons.ts` and `npx prettier --check` on the files you touched, if the repo uses it.
3. `npm run typecheck --workspace @ls/collab` and `npm run typecheck --workspace @ls/db`; the root `tsc -p tsconfig.json` once before the final commit (frozen literals with `db:` must still compile).
4. `npx vitest run apps/collab/src/access-recheck.test.ts apps/collab/src/gen6-lows.test.ts apps/collab/src/session-recheck.test.ts apps/collab/src/main.test.ts apps/collab/src/wiring apps/collab/src/drain.test.ts`
5. `npx vitest run apps/collab/src/access-recheck.int.test.ts apps/collab/src/persistence.int.test.ts` (real Postgres; once; the second file proves the existing socket behaviour is unchanged).
6. Tamper check: hashes of the three frozen files equal the manifest.
Not run: the full suite (no shared fixture, config or dependency changes), Playwright `con-12` specs (the owner of those specs is NL-101; the int file here covers the same socket path, and the wave merge runs the affected web specs if the orchestrator's affected-test list includes `apps/collab`).

## 8. Open items / assumptions (none blocks)

- Assumption (recorded): "removed from the allow list" has no schema meaning today (no active flag); it is covered as "user row deleted" (close) and "role no longer allowed to edit" (downgrade). If a user-disable column is added later, `roles_of` is the one place to teach it.
- Assumption: a role raised while connected does not make the socket writable until reconnect or the next `set_mode`; this errs on the safe side and is pinned by T-7.
- Seam-audit correction for the orchestrator: finding 5 describes `void wire_collab_commands(...)` as an unhandled rejection; the function is synchronous so it is not. The fix in 4.5 item 2 still closes the real gaps (discarded wiring, leaked `sw` on a failed start).
- Cost: the sweep adds two indexed reads per second per collab process; with the 200-user load running elsewhere, run the int file once.
