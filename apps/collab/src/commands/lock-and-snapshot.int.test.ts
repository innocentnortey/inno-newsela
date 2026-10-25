 
// NL-106 frozen tests (risk::security): AC-1 .. AC-11 plus the plan's four extra cases. Real Postgres (scripts/test-db.sh up),
// a real Hocuspocus server, real @hocuspocus/provider clients and the real /internal routes. The check rules and the context
// loader are the controlled stubs in nl-106.fixtures.ts. Written before the implementation: until it lands the body still
// answers COLLAB_UNAVAILABLE, and every test below asserts a success or a specific refusal first, so each is red for that reason.
import { randomBytes } from "node:crypto";
import * as Y from "yjs";
import { Server } from "@hocuspocus/server";
import Decimal from "decimal.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { load_collab_settings } from "@ls/config/settings";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgIssueRepo } from "@ls/db/repos/issue-repo";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgSessionRepo } from "@ls/db/repos/sessions";
import { SYSTEM_ACTOR, rows, scalar } from "@ls/db/repos/lesson-docs.test-support";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, settings_for, type TestDb } from "@ls/db/testing/test-db";
import { create_logger } from "@ls/obs/logger";
import type { StoredLesson } from "@ls/schema/lesson";
import { sha256 } from "../nl-80.fixtures.ts";
import { wire_collab_server, type CollabServerWiring } from "../wiring/server.ts";
import { wire_collab_commands } from "../wiring/commands.ts";
import { install_command_handler, type CollabCommandHandler } from "./routes.ts";
import {
  FakeStandards, actor, bearer, edit_body, http_harness, lesson_with_slot, rid, type Http,
} from "./nl-105.fixtures.ts";
import {
  Controls, KEY_MARKER, SUBMIT_MARKER, big_lesson, gate, lesson_with_marker, loader_for, p95, rules_for, spy, sv_ahead_of,
} from "./nl-106.fixtures.ts";

const ids = new PrefixedIdGenerator();
const clock = new SystemClock();
let t: TestDb;
const tokens: Record<string, string> = {};
const USERS = ["u-rev-1", "u-rev-2", "u-rev-3"];
let n = 0;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function until(cond: () => boolean | Promise<boolean>, ms = 8000, what = "condition"): Promise<void> {
  const end = Date.now() + ms;
  while (!(await cond())) {
    if (Date.now() > end) throw new Error(`timeout waiting for ${what}`);
    await sleep(15);
  }
}

beforeAll(async () => {
  t = await create_test_db({ pool_max: 10 });
  const repo = new PgSessionRepo({ db: t.db, ids, clock });
  await t.db.with_tx(async (tx) => {
    for (const id of USERS) {
      await insert_row(tx, "app_user", { id, name: `Synthetic ${id}`, email: `${id}.demo@example.org`, role: "reviewer", synthetic: true });
      tokens[id] = randomBytes(16).toString("hex");
      await repo.create_session(id, sha256(tokens[id]!), new Date(Date.now() + 3_600_000), tx);
    }
  });
}, 60000);
afterAll(async () => {
  await t.drop();
});

/** The real repo with switches: the snapshot transaction can be made to fail after the checks (AC-8). */
class SpyStates extends PgLessonRepo {
  fail_event = false;
  reached_event = false;
  override async append_review_event(e: any, tx: any) {
    this.reached_event = true;
    if (this.fail_event) throw new Error("INJECTED-TX-FAILURE");
    return super.append_review_event(e, tx);
  }
}

interface H {
  server: Server;
  wiring: CollabServerWiring;
  handler: CollabCommandHandler;
  http: Http;
  log: string[];
  c: Controls;
  states: SpyStates;
  tx_ms: number[];
  stop(): Promise<void>;
}
async function start(debounce = 600_000): Promise<H> {
  const log: string[] = [];
  const logger = create_logger({ service: "collab", build_id: "test", write: (l) => void log.push(l) });
  const base = load_collab_settings({ DATABASE_URL: t.url, COLLAB_INTERNAL_TOKEN: "t-collab" });
  const settings = { ...base, shared: settings_for(t.url, 4), store_debounce_ms: debounce, store_max_debounce_ms: debounce * 2 };
  const server = new Server({ port: 0, quiet: true, stopOnSignals: false, extensions: [] });
  const d = { settings, logger, db: t.db as never, ids, clock };
  const wiring = wire_collab_server(d, { hocuspocus: server.hocuspocus });
  await server.listen();
  const deps = { db: t.db, ids, clock };
  const states = new SpyStates(deps);
  const store = new PgLessonDocStore({ ...deps, checks: new PgCheckQueue(deps), states, audit: new PgAuditLog(deps) });
  const c = new Controls();
  const tx_ms: number[] = [];
  const tx = {
    async with_tx(fn: any, lock?: any) {
      const t0 = performance.now();
      try {
        return await (t.db as any).with_tx(fn, lock);
      } finally {
        tx_ms.push(performance.now() - t0);
      }
    },
  };
  // Not typed as Partial<CollabCommandHandlerDeps>: loader/rules/policy/issues are the members NL-106 adds.
  const given = {
    store, reader: new PgLessonDocReader({ db: t.db }), states, versions: states, standards: new FakeStandards(), tx,
    loader: loader_for(c), rules: rules_for(c), policy: CHECK_POLICY, issues: new PgIssueRepo(deps),
  };
  const w = wire_collab_commands(d, wiring, { hocuspocus: server.hocuspocus }, given as never);
  const http = await http_harness(logger);
  return {
    server, wiring, handler: w.handler, http, log, c, states, tx_ms,
    async stop() {
      install_command_handler(null);
      await http.close();
      await server.destroy();
      await wiring.close();
    },
  };
}

async function new_lesson(state = "in_review", make: (id: string) => StoredLesson = lesson_with_slot): Promise<string> {
  const id = `G6.U4.L${400 + ++n}`;
  const store = new PgLessonDocStore({
    db: t.db, ids, clock, checks: new PgCheckQueue({ db: t.db, ids, clock }), states: new PgLessonRepo({ db: t.db, ids, clock }), audit: new PgAuditLog({ db: t.db, ids, clock }),
  });
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "lesson", { id, state, last_editor_id: null });
    await store.seed_initial(id, make(id), SYSTEM_ACTOR, tx);
    // REFREEZE NOTE (NL-106 implementer): write_snapshot descends from a generated version, so a real lesson needs one.
    await new PgLessonRepo({ db: t.db, ids, clock }).write_generated_version(
      {
        lesson_id: id, unit_id: "G6.U4", kind: "generated", lesson: make(id), draft: {} as never, content_hash: "a".repeat(64),
        provenance: {
          outline_row_hash: "a".repeat(64), prompt_version_id: "pv1", model: "m", parameters: {}, schema_version: 1, example_set_id: null,
          run_id: null as never, model_call_ids: [], cost_usd: new Decimal("0"), ai_assisted_spans: 0, derived_from_version_id: null,
        },
        idempotency_key: "k-" + id,
      },
      tx,
    );
  });
  return id;
}
const doc_name = (id: string) => `lesson:${id}`;
const count = async (table: string, col?: string, v?: string) =>
  Number(await scalar(t, col === undefined ? `SELECT count(*)::int FROM ${table}` : `SELECT count(*)::int FROM ${table} WHERE ${col}=$1`, v === undefined ? [] : [v]));
// REFREEZE NOTE: the harness lesson owns one generated version (write_snapshot descends from it); snapshots are what the tests count.
const versions_of = async (id: string) => Number(await scalar(t, "SELECT count(*)::int FROM lesson_version WHERE lesson_id=$1 AND kind<>'generated'", [id]));
const events_of = (id: string) => count("review_event", "lesson_id", id);
const state_of = async (id: string) => String(await scalar(t, "SELECT state FROM lesson WHERE id=$1", [id]));
const docs_of = (id: string) => count("lesson_doc", "lesson_id", id);
async function latest_row(id: string) {
  const [r] = await rows(t, "SELECT seq, ydoc_bytes, content_hash, state_vector, request_id FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq DESC LIMIT 1", [id]);
  return r!;
}
const stored_sv = async (id: string) => Buffer.from((await latest_row(id))["state_vector"] as Buffer).toString("base64");
const cmd = (id: string, sv: string, rn = 1, user = "u-rev-1") => ({ lesson_id: id, actor: actor(user), client_state_vector: sv, request_id: rid(rn) }) as never;
/** Counts that must not move on any refusal. */
const rows_of = async (id: string) => [await versions_of(id), await events_of(id), await state_of(id)];

async function submit_ok(h: H, id: string, rn = 1) {
  return h.handler.lock_and_snapshot(cmd(id, await stored_sv(id), rn));
}
async function code_of(p: Promise<unknown>): Promise<string | undefined> {
  try {
    await p;
    return "RESOLVED";
  } catch (e: any) {
    return e?.code ?? e?.message;
  }
}

// ---- socket clients -------------------------------------------------------------------------------------

interface Client { p: any; doc: Y.Doc; stateless: any[]; typed: string[]; stop(): void }
const of_type = (c: Client, type: string) => c.stateless.filter((m) => m.type === type);
const b64 = (d: Y.Doc) => Buffer.from(Y.encodeStateVector(d)).toString("base64");
async function connect(h: H, id: string, user: string, doc: Y.Doc = new Y.Doc()): Promise<Client> {
  const spec = "@hocuspocus/provider";
  const lib: any = await import(/* @vite-ignore */ spec);
  const cookie = `${load_collab_settings({ DATABASE_URL: t.url, COLLAB_INTERNAL_TOKEN: "t-collab" }).session_cookie_name}=${tokens[user]}`;
  class CookieWS extends WebSocket {
    constructor(u: string | URL) { super(u, { headers: { cookie } } as never); }
  }
  const stateless: any[] = [];
  let synced!: () => void;
  const ready = new Promise<void>((r) => (synced = r));
  const p = new lib.HocuspocusProvider({
    url: `ws://127.0.0.1:${h.server.address.port}`, name: doc_name(id), token: "cookie", document: doc, WebSocketPolyfill: CookieWS,
    onSynced: () => synced(),
    onStateless: ({ payload }: { payload: string }) => void stateless.push(JSON.parse(payload)),
  });
  await Promise.race([ready, sleep(8000).then(() => { throw new Error("client never synced"); })]);
  const c: Client = { p, doc, stateless, typed: [], stop: () => p.destroy() };
  return c;
}
/** One keystroke = one unique key in a scratch map, so each can be found in (or absent from) the stored bytes. */
function type_into(c: Client, tag: string, every_ms = 4): () => void {
  let k = 0;
  const timer = setInterval(() => {
    const key = `${tag}-${k++}`;
    c.typed.push(key);
    c.doc.getMap("typed").set(key, k);
  }, every_ms);
  return () => clearInterval(timer);
}
const keys_in = (bytes: Buffer): Set<string> => {
  const d = new Y.Doc();
  Y.applyUpdate(d, new Uint8Array(bytes));
  return new Set(d.getMap("typed").keys());
};

/** Holds the call inside persistence.store until released; `entered` is true once the call reached it. */
function hold_store(h: H) {
  const g = gate();
  const st = { entered: false };
  const orig = h.wiring.persistence.store.bind(h.wiring.persistence);
  (h.wiring.persistence as any).store = async (...a: any[]) => {
    st.entered = true;
    await g.open;
    return (orig as any)(...a);
  };
  return { ...st, st, release: g.release };
}
/** Starts the Submit and reports whether it already ended (a refusal) so waiting loops fail fast with the real reason. */
function run_submit(h: H, c: any) {
  const o: { settled: any } = { settled: null };
  const p = h.handler.lock_and_snapshot(c).then((v) => (o.settled = { ok: v }), (e) => (o.settled = { err: e }));
  return { o, p };
}

// ---- AC-1 -----------------------------------------------------------------------------------------------

describe("submit_success_one_tx [invariant, AC-1]", () => {
  it("returns the SnapshotResult, writes one submit version whose hash equals the stored row, one review_event, state submitted, and broadcasts read_only only after commit", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      const sock = await connect(h, id, "u-rev-2");
      const sv = await stored_sv(id);
      const probes: Promise<unknown>[] = [];
      const mode_args: any[] = [];
      const orig_mode = h.wiring.acks.mode.bind(h.wiring.acks);
      (h.wiring.acks as any).mode = (lid: string, msg: any) => {
        mode_args.push([lid, msg]);
        // a query started now runs on its own connection: it sees only committed data
        probes.push(rows(t, "SELECT (SELECT state FROM lesson WHERE id=$1) AS state, (SELECT count(*)::int FROM review_event WHERE lesson_id=$1) AS ev, (SELECT count(*)::int FROM lesson_version WHERE lesson_id=$1 AND kind='submit') AS v", [lid]));
        return orig_mode(lid, msg);
      };
      const res = await h.handler.lock_and_snapshot(cmd(id, sv, 11));
      expect(res).toMatchObject({ lesson_id: id, from_state: "in_review", to_state: "submitted" });
      expect(typeof res.version_number).toBe("number");
      const [ver] = await rows(t, "SELECT id, kind, content_hash, number FROM lesson_version WHERE lesson_id=$1 AND kind='submit'", [id]);
      expect(await versions_of(id)).toBe(1);
      expect(ver).toMatchObject({ kind: "submit", number: res.version_number });
      const doc = await latest_row(id);
      expect(ver!["content_hash"]).toBe(doc["content_hash"]);
      expect(res.content_hash).toBe(doc["content_hash"]);
      expect(res.state_vector).toBe(Buffer.from(doc["state_vector"] as Buffer).toString("base64"));
      expect(res.version_id).toBe(ver!["id"]);
      expect(await state_of(id)).toBe("submitted");
      const ev = await rows(t, "SELECT id, from_state, to_state, actor_id, version_id, content_hash, note FROM review_event WHERE lesson_id=$1", [id]);
      expect(ev).toHaveLength(1);
      expect(ev[0]).toMatchObject({ id: res.review_event_id, from_state: "in_review", to_state: "submitted", actor_id: "u-rev-1", version_id: ver!["id"], note: null });
      // message ordering: one read_only broadcast, issued when the commit was already visible
      expect(mode_args).toEqual([[id, { mode: "read_only", state: "submitted" }]]);
      const seen: any = (await Promise.all(probes))[0];
      expect(seen[0]).toMatchObject({ state: "submitted", ev: 1, v: 1 });
      await until(() => of_type(sock, "mode").some((m) => m.mode === "read_only" && m.state === "submitted"), 8000, "read_only mode message on the socket");
      sock.stop();
    } finally {
      await h.stop();
    }
  }, 60000);
});

// ---- AC-2 and the apply_edit race -----------------------------------------------------------------------

describe("freeze_first_then_store [invariant, AC-2]", () => {
  it("freeze precedes every store, snapshot, state and event call; an in-flight socket update is refused from its prior vector and persisted nowhere", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      const log: string[] = [];
      spy(h.wiring.frozen, ["freeze", "unfreeze"], log, "frozen");
      spy(h.wiring.persistence, ["store"], log, "persistence");
      spy(h.states, ["write_snapshot", "set_state", "append_review_event"], log, "db");
      const a = await connect(h, id, "u-rev-1");
      const sv = await stored_sv(id);
      const hold = hold_store(h);
      const { o, p } = run_submit(h, cmd(id, sv, 21));
      await until(() => hold.st.entered || o.settled !== null, 8000, "call to reach persistence.store");
      expect(o.settled, "the call ended before reaching store").toBeNull();
      expect(h.wiring.frozen.is_frozen(id)).toBe(true);
      // a keystroke sent between the call's arrival and its store
      const prior = b64(a.doc);
      a.doc.getMap("typed").set("in-flight", 1);
      await until(() => of_type(a, "refused").length > 0, 8000, "refused message");
      expect(of_type(a, "refused")[0]).toMatchObject({ type: "refused", code: "LESSON_LOCKED", refused_from: prior });
      hold.release();
      await p;
      expect(o.settled?.ok, "submit must succeed").toBeDefined();
      expect(log[0]).toBe("frozen.freeze");
      for (const later of ["persistence.store", "db.write_snapshot", "db.set_state", "db.append_review_event"]) {
        expect(log.indexOf(later), later).toBeGreaterThan(0);
      }
      expect(log).not.toContain("frozen.unfreeze");
      await sleep(300);
      expect(keys_in((await latest_row(id))["ydoc_bytes"] as Buffer).has("in-flight")).toBe(false);
      a.stop();
    } finally {
      await h.stop();
    }
  }, 60000);

  it("apply_edit_after_freeze_is_refused [regression]: a freeze that lands while the direct connection opens still refuses the edit and applies nothing", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      // plain case: frozen before the call
      h.wiring.frozen.seed(id, "in_review");
      h.wiring.frozen.freeze(id);
      expect(await code_of(h.handler.apply_edit(edit_body({ request_id: rid(31) }, id) as never))).toBe("LESSON_LOCKED");
      h.wiring.frozen.unfreeze(id);
      // race: the freeze lands between the early check and the transaction
      const hp: any = h.server.hocuspocus;
      const orig = hp.openDirectConnection.bind(hp);
      hp.openDirectConnection = async (...a: any[]) => {
        const conn = await orig(...a);
        h.wiring.frozen.freeze(id);
        return conn;
      };
      const before = [await docs_of(id), await count("audit_event")];
      const code = await code_of(h.handler.apply_edit(edit_body({ request_id: rid(32) }, id) as never));
      expect(code).toBe("LESSON_LOCKED");
      expect([await docs_of(id), await count("audit_event")]).toEqual(before);
    } finally {
      await h.stop();
    }
  }, 60000);
});

// ---- AC-3 -----------------------------------------------------------------------------------------------

describe("sp2_twenty_trials_zero_edits_after_lock [invariant, AC-3]", () => {
  it("20 trials with 3 typing clients: no row after the lock, every missing keystroke's typist was told, nothing returns on reconnect", async () => {
    const h = await start(150);
    const table: string[] = [];
    try {
      for (let trial = 1; trial <= 20; trial++) {
        const id = await new_lesson();
        const sv0 = await stored_sv(id);
        const clients = [await connect(h, id, "u-rev-1"), await connect(h, id, "u-rev-2"), await connect(h, id, "u-rev-3")];
        const stops = clients.map((c, i) => type_into(c, `c${i}`));
        await sleep(120);
        await h.handler.lock_and_snapshot(cmd(id, sv0, 100 + trial));
        const at_return = await latest_row(id);
        const snapshot_keys = keys_in(at_return["ydoc_bytes"] as Buffer);
        await sleep(400); // keep typing after the lock
        stops.forEach((s) => s());
        await sleep(450); // longer than the 150 ms debounce: a stranded update would be stored now
        const after = await latest_row(id);
        expect(after["seq"], `trial ${trial}: a row was written after the lock`).toBe(at_return["seq"]);
        let sent = 0, in_snapshot = 0, refused = 0;
        for (const c of clients) {
          const missing = c.typed.filter((k) => !snapshot_keys.has(k));
          sent += c.typed.length;
          in_snapshot += c.typed.length - missing.length;
          refused += of_type(c, "refused").length;
          if (missing.length > 0) expect(of_type(c, "refused").length, `trial ${trial}: typist not told`).toBeGreaterThan(0);
          for (const m of of_type(c, "refused")) expect(m.code).toBe("LESSON_LOCKED");
        }
        expect(refused, `trial ${trial}: nothing was refused although typing continued`).toBeGreaterThan(0);
        // reconnect with the typist's own document (it still holds the refused edits): nothing may come back
        clients[0]!.stop();
        const again = await connect(h, id, "u-rev-1", clients[0]!.doc);
        await sleep(450);
        const later = await latest_row(id);
        expect(later["seq"]).toBe(at_return["seq"]);
        expect(keys_in(later["ydoc_bytes"] as Buffer)).toEqual(snapshot_keys);
        again.stop();
        clients.slice(1).forEach((c) => c.stop());
        table.push(`trial ${trial}: sent=${sent} in_snapshot=${in_snapshot} refused_msgs=${refused} rows_after_lock=0 returned_on_reconnect=0`);
      }
      console.log(table.join("\n"));
      expect(table).toHaveLength(20);
    } finally {
      await h.stop();
    }
  }, 600000);

  it("socket_connecting_mid_submit_is_read_only [invariant]: the document stays loaded and a socket that connects between freeze and commit is read-only", async () => {
    const h = await start(150);
    try {
      const id = await new_lesson();
      const sv = await stored_sv(id);
      const hold = hold_store(h);
      const { o, p } = run_submit(h, cmd(id, sv, 41));
      await until(() => hold.st.entered || o.settled !== null, 8000, "call to reach persistence.store");
      expect(o.settled, "the call ended before reaching store").toBeNull();
      expect((h.server.hocuspocus as any).documents.has(doc_name(id))).toBe(true);
      const late = await connect(h, id, "u-rev-2");
      await until(() => of_type(late, "mode").length > 0, 8000, "mode message for the late socket");
      expect(of_type(late, "mode")[0]).toMatchObject({ mode: "read_only" });
      late.doc.getMap("typed").set("late-key", 1);
      await until(() => of_type(late, "refused").length > 0, 8000, "refused for the late socket");
      hold.release();
      await p;
      expect(o.settled?.ok, "submit must succeed").toBeDefined();
      await sleep(450);
      expect(keys_in((await latest_row(id))["ydoc_bytes"] as Buffer).has("late-key")).toBe(false);
      late.stop();
    } finally {
      await h.stop();
    }
  }, 60000);
});

// ---- AC-4, AC-5, AC-6 -----------------------------------------------------------------------------------

describe("not_stored_unfreezes [failure/refusal, AC-4]", () => {
  it("a client vector ahead of the stored one gives 409 NOT_STORED, unfreezes, writes no version or event, and a reviewer write then succeeds", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      const ahead = sv_ahead_of(new Uint8Array((await latest_row(id))["ydoc_bytes"] as Buffer));
      const before = await rows_of(id);
      const res = await h.http.post(id, "lock-and-snapshot", { lesson_id: id, actor: actor(), client_state_vector: ahead, request_id: rid(51) }, bearer());
      expect(res.status).toBe(409);
      expect(res.json.error.code).toBe("NOT_STORED");
      expect(await rows_of(id)).toEqual(before);
      expect(before).toEqual([0, 0, "in_review"]);
      expect(h.wiring.frozen.is_frozen(id)).toBe(false);
      const w = await h.handler.apply_edit(edit_body({ request_id: rid(52) }, id) as never);
      expect(w.lesson_id).toBe(id);
    } finally {
      await h.stop();
    }
  }, 60000);
});

describe("gate_order_and_unfreeze [failure/refusal, AC-5]", () => {
  it("SUGGESTION_PENDING first, then BLOCKED listing both levels, then CONFIRMATION_OPEN; each unfreezes and writes no version or event", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      const before = await rows_of(id);
      h.c.blocking = true;
      h.c.confirmation = true;
      h.c.pending = 1;
      const sv = await stored_sv(id);
      const first = await h.http.post(id, "lock-and-snapshot", { lesson_id: id, actor: actor(), client_state_vector: sv, request_id: rid(61) }, bearer());
      expect([first.status, first.json.error.code]).toEqual([422, "SUGGESTION_PENDING"]);
      expect(h.wiring.frozen.is_frozen(id)).toBe(false);

      h.c.pending = 0;
      const second = await h.http.post(id, "lock-and-snapshot", { lesson_id: id, actor: actor(), client_state_vector: sv, request_id: rid(62) }, bearer());
      expect([second.status, second.json.error.code]).toEqual([422, "BLOCKED"]);
      const levels = (second.json.error.details.issues as any[]).map((i) => i.level).sort();
      expect(levels).toEqual(["blocking", "confirmation"]);
      expect(h.wiring.frozen.is_frozen(id)).toBe(false);

      h.c.blocking = false;
      const third = await h.http.post(id, "lock-and-snapshot", { lesson_id: id, actor: actor(), client_state_vector: sv, request_id: rid(63) }, bearer());
      expect([third.status, third.json.error.code]).toEqual([422, "CONFIRMATION_OPEN"]);
      expect(h.wiring.frozen.is_frozen(id)).toBe(false);
      expect(await rows_of(id)).toEqual(before);
      expect(before).toEqual([0, 0, "in_review"]);
    } finally {
      await h.stop();
    }
  }, 60000);
});

describe("resolution_carries_to_stored_row_rerun [invariant, AC-6]", () => {
  const resolve_row = (id: string, kind: string, address: string) =>
    t.db.with_tx((tx) =>
      insert_row(tx, "issue", {
        lesson_id: id, content_hash: "0".repeat(64), level: "blocking", kind, message: "earlier", address, code: null,
        resolved_by: "u-rev-1", resolution_reason: "reviewed", resolved_at: new Date().toISOString(), cleared_by: null,
      }),
    );

  it("a recorded resolution on an earlier hash lets the same finding through; an unresolvable safety_flag_open resolution does not", async () => {
    const h = await start();
    try {
      h.c.blocking = true;
      const id = await new_lesson();
      expect(await code_of(submit_ok(h, id, 71))).toBe("BLOCKED");
      await resolve_row(id, "quote_placeholder_open", "literacy_lab");
      const res = await submit_ok(h, id, 72);
      expect(res.to_state).toBe("submitted");
      expect(await versions_of(id)).toBe(1);

      h.c.blocking = false;
      h.c.safety = true;
      const id2 = await new_lesson();
      await resolve_row(id2, "safety_flag_open", "launch");
      expect(await code_of(submit_ok(h, id2, 73))).toBe("BLOCKED");
      expect(await rows_of(id2)).toEqual([0, 0, "in_review"]);
    } finally {
      await h.stop();
    }
  }, 60000);
});

// ---- AC-7 and the release rules -------------------------------------------------------------------------

describe("concurrent_submit_single_winner [failure/refusal, AC-7]", () => {
  it("two concurrent calls give one success and one LESSON_LOCKED or INVALID_TRANSITION; a later call is INVALID_TRANSITION; one submit version", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      const sv = await stored_sv(id);
      const out = await Promise.allSettled([h.handler.lock_and_snapshot(cmd(id, sv, 81)), h.handler.lock_and_snapshot(cmd(id, sv, 82, "u-rev-2"))]);
      expect(out.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const lost = out.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(["LESSON_LOCKED", "INVALID_TRANSITION"]).toContain((lost.reason as any).code);
      expect(await versions_of(id)).toBe(1);
      expect(await events_of(id)).toBe(1);
      expect(await code_of(h.handler.lock_and_snapshot(cmd(id, sv, 83)))).toBe("INVALID_TRANSITION");
      expect(await versions_of(id)).toBe(1);
    } finally {
      await h.stop();
    }
  }, 60000);

  it("never_unfreezes_a_freeze_it_did_not_take [invariant]: a lesson frozen by set_mode read_only is refused LESSON_LOCKED and stays frozen", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      const sv = await stored_sv(id);
      await h.handler.set_mode({ lesson_id: id, mode: "read_only", state: "in_review", request_id: rid(84) } as never);
      expect(await code_of(h.handler.lock_and_snapshot(cmd(id, sv, 85)))).toBe("LESSON_LOCKED");
      expect(h.wiring.frozen.is_frozen(id)).toBe(true);
      expect(await rows_of(id)).toEqual([0, 0, "in_review"]);
    } finally {
      await h.stop();
    }
  }, 60000);

  it("release_keeps_frozen_when_state_not_editable [invariant]: if the lesson became non-editable during the call, a failure leaves it frozen", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      const ahead = sv_ahead_of(new Uint8Array((await latest_row(id))["ydoc_bytes"] as Buffer));
      const hold = hold_store(h);
      const { o, p } = run_submit(h, cmd(id, ahead, 86));
      await until(() => hold.st.entered || o.settled !== null, 8000, "call to reach persistence.store");
      expect(o.settled, "the call ended before reaching store").toBeNull();
      await t.db.with_tx((tx) => (tx as any).query("UPDATE lesson SET state='approved' WHERE id=$1", [id]));
      hold.release();
      await p;
      expect(o.settled?.err?.code).toBe("NOT_STORED");
      expect(h.wiring.frozen.is_frozen(id)).toBe(true);
    } finally {
      await h.stop();
    }
  }, 60000);
});

// ---- AC-8 -----------------------------------------------------------------------------------------------

describe("tx_failure_rolls_back_and_unfreezes [failure/refusal, AC-8]", () => {
  it("an error injected in the snapshot transaction leaves state, versions and events unchanged, unfreezes, and sends no read_only broadcast", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      const modes: unknown[] = [];
      spy(h.wiring.acks, ["mode"], modes as string[], "acks");
      h.states.fail_event = true;
      const sv = await stored_sv(id);
      await expect(h.handler.lock_and_snapshot(cmd(id, sv, 91))).rejects.toThrow("INJECTED-TX-FAILURE");
      expect(h.states.reached_event).toBe(true);
      expect(await rows_of(id)).toEqual([0, 0, "in_review"]);
      expect(h.wiring.frozen.is_frozen(id)).toBe(false);
      expect(modes).toEqual([]);
    } finally {
      await h.stop();
    }
  }, 60000);
});

// ---- AC-9 -----------------------------------------------------------------------------------------------

describe("submit_latency_p95 [invariant, AC-9]", () => {
  it("30 Submits on a large document: call p95 under 2000 ms, snapshot transaction p95 at most 500 ms", async () => {
    const h = await start();
    try {
      const call_ms: number[] = [];
      const tx_run: number[] = [];
      for (let i = 0; i < 30; i++) {
        const id = await new_lesson("in_review", big_lesson);
        const sv = await stored_sv(id);
        h.tx_ms.length = 0;
        const t0 = performance.now();
        await h.handler.lock_and_snapshot(cmd(id, sv, 200 + i));
        call_ms.push(performance.now() - t0);
        expect(h.tx_ms.length, "the snapshot transaction ran").toBeGreaterThan(0);
        tx_run.push(Math.max(...h.tx_ms));
      }
      const tx = tx_run;
      console.log(`submit p95 call=${p95(call_ms).toFixed(0)} ms, snapshot tx p95=${p95(tx).toFixed(0)} ms (30 runs)`);
      expect(call_ms).toHaveLength(30);
      expect(p95(call_ms)).toBeLessThan(2000);
      expect(p95(tx)).toBeLessThanOrEqual(500);
    } finally {
      await h.stop();
    }
  }, 300000);
});

// ---- AC-10 ----------------------------------------------------------------------------------------------

describe("no_text_or_key_in_logs [negative, AC-10]", () => {
  it("neither the lesson marker nor the provider-key marker appears in logs, review_event.note, results or error bodies", async () => {
    const saved = process.env["ANTHROPIC_API_KEY"];
    process.env["ANTHROPIC_API_KEY"] = KEY_MARKER;
    const h = await start();
    try {
      const seen: string[] = [];
      const id = await new_lesson("in_review", lesson_with_marker);
      const sv = await stored_sv(id);
      // refusals first (gate and NOT_STORED), then the success
      h.c.blocking = true;
      const blocked = await h.http.post(id, "lock-and-snapshot", { lesson_id: id, actor: actor(), client_state_vector: sv, request_id: rid(101) }, bearer());
      expect(blocked.json.error.code).toBe("BLOCKED");
      seen.push(blocked.text);
      h.c.blocking = false;
      const ahead = sv_ahead_of(new Uint8Array((await latest_row(id))["ydoc_bytes"] as Buffer));
      const ns = await h.http.post(id, "lock-and-snapshot", { lesson_id: id, actor: actor(), client_state_vector: ahead, request_id: rid(102) }, bearer());
      expect(ns.json.error.code).toBe("NOT_STORED");
      seen.push(ns.text);
      const ok = await h.http.post(id, "lock-and-snapshot", { lesson_id: id, actor: actor(), client_state_vector: sv, request_id: rid(103) }, bearer());
      expect(ok.status).toBe(200);
      seen.push(ok.text);
      const notes = await rows(t, "SELECT note FROM review_event WHERE lesson_id=$1", [id]);
      expect(notes).toHaveLength(1);
      seen.push(JSON.stringify(notes));
      const all = [...seen, ...h.log].join("\n");
      expect(h.log.length).toBeGreaterThan(0);
      expect(all).not.toContain(SUBMIT_MARKER);
      expect(all).not.toContain(KEY_MARKER);
      expect(all).not.toContain("t-collab");
    } finally {
      if (saved === undefined) delete process.env["ANTHROPIC_API_KEY"];
      else process.env["ANTHROPIC_API_KEY"] = saved;
      await h.stop();
    }
  }, 60000);
});

// ---- AC-11 ----------------------------------------------------------------------------------------------

describe("test_internal_command_capture_submit [capture, AC-11]", () => {
  it("over the real route with the token: the lesson_doc store, the snapshot's review_event and version carry the request_id; no token writes nothing", async () => {
    const h = await start();
    const closers: (() => Promise<void>)[] = [];
    try {
      const id = await new_lesson();
      const sv = await stored_sv(id);
      // an edit that only lives in the document, so Submit has something to store
      const hp: any = h.server.hocuspocus;
      const conn = await hp.openDirectConnection(doc_name(id), {});
      closers.push(() => conn.disconnect());
      await conn.transact((d: Y.Doc) => void d.getMap("typed").set("unstored", 1));
      const docs_before = await docs_of(id);
      const body = { lesson_id: id, actor: actor(), client_state_vector: sv, request_id: rid(111) };
      const before = await rows_of(id);

      const denied = await h.http.post(id, "lock-and-snapshot", body);
      expect(denied.status).toBe(401);
      expect(await rows_of(id)).toEqual(before);

      const res = await h.http.post(id, "lock-and-snapshot", body, bearer());
      expect(res.status).toBe(200);
      expect(res.json).toMatchObject({ lesson_id: id, to_state: "submitted" });
      expect(await docs_of(id)).toBe(docs_before + 1);
      expect((await latest_row(id))["request_id"]).toBe(rid(111));
      const ev = await rows(t, "SELECT version_id, request_id FROM review_event WHERE lesson_id=$1", [id]);
      expect(ev).toHaveLength(1);
      expect(ev[0]!["request_id"]).toBe(rid(111));
      expect(await scalar(t, "SELECT kind FROM lesson_version WHERE id=$1", [ev[0]!["version_id"]])).toBe("submit");
      expect(h.log.some((l) => l.includes(rid(111)))).toBe(true);
    } finally {
      for (const c of closers) await c();
      await h.stop();
    }
  }, 60000);
});

describe("test_store_capture_post_submit [capture, AC-11]", () => {
  it("after Submit a reviewer socket's update is answered refused, writes no lesson_doc or audit_event row, and logs one collab.write_refused line", async () => {
    const h = await start(200);
    try {
      const id = await new_lesson();
      const sock = await connect(h, id, "u-rev-1");
      await h.handler.lock_and_snapshot(cmd(id, await stored_sv(id), 121));
      await until(() => of_type(sock, "mode").some((m) => m.state === "submitted"), 8000, "submitted mode message");
      const docs = await docs_of(id);
      const audits = await count("audit_event", "target_id", id);
      h.log.length = 0;
      sock.doc.getMap("typed").set("after-submit", 1);
      await until(() => of_type(sock, "refused").length > 0, 8000, "refused after submit");
      expect(of_type(sock, "refused")[0]).toMatchObject({ code: "LESSON_LOCKED" });
      await sleep(600);
      expect(await docs_of(id)).toBe(docs);
      expect(await count("audit_event", "target_id", id)).toBe(audits);
      const lines = h.log.filter((l) => l.includes("collab.write_refused"));
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0]!)).toMatchObject({ event: "collab.write_refused", lesson_id: id });
      sock.stop();
    } finally {
      await h.stop();
    }
  }, 60000);
});
