// GEN-6 frozen tests (risk::security): S-29 against real Postgres, a real Hocuspocus server and real @hocuspocus/provider clients.
// Written before the implementation. The recheck runs every 1 s, so waits use `until(..., 8000, ...)`.
import { randomBytes } from "node:crypto";
import * as Y from "yjs";
import { Server } from "@hocuspocus/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { load_collab_settings } from "@ls/config/settings";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgSessionRepo } from "@ls/db/repos/sessions";
import { SYSTEM_ACTOR, scalar, wp1 } from "@ls/db/repos/lesson-docs.test-support";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, settings_for, type TestDb } from "@ls/db/testing/test-db";
import { create_logger } from "@ls/obs/logger";
import { wire_collab_server, type CollabServerWiring } from "./wiring/server.ts";
import { sha256 } from "./nl-80.fixtures.ts";

const ids = new PrefixedIdGenerator();
const clock = new SystemClock();
let t: TestDb;
let sessions: PgSessionRepo;
let store: PgLessonDocStore;
const tokens: Record<string, string> = {};
const USERS = [
  { id: "u-rev-1", role: "reviewer" },
  { id: "u-rev-2", role: "reviewer" },
  { id: "u-author-1", role: "author" },
  { id: "u-gone-1", role: "reviewer" },
  { id: "u-i3-1", role: "reviewer" },
  { id: "u-i5-1", role: "reviewer" },
] as const;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function until(cond: () => boolean, ms = 8000, what = "condition"): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error(`timeout waiting for ${what}`);
    await sleep(25);
  }
}
const b64 = (d: Y.Doc) => Buffer.from(Y.encodeStateVector(d)).toString("base64");
const count = async (table: string, col: string, v: string) =>
  Number(await scalar(t, `SELECT count(*)::int FROM ${table} WHERE ${col}=$1`, [v]));
// Hocuspocus' graceful close sends 4401 in its own close message and ends the transport with 1000, so the reason string is
// the observable marker (same finding as apps/web/e2e/integration/con-12/session-close-code.spec.ts).
const session_ended = (c: { code: number; reason: string }) => c.reason === "Session ended. Sign in again.";
const docname = (lesson: string) => `lesson:${lesson}`;

async function fresh_lesson(id: string): Promise<string> {
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "lesson", { id, state: "in_review", last_editor_id: null });
    await store.seed_initial(id, { ...wp1(), lesson_id: id }, SYSTEM_ACTOR, tx);
  });
  return id;
}

beforeAll(async () => {
  t = await create_test_db({ pool_max: 8 });
  sessions = new PgSessionRepo({ db: t.db, ids, clock });
  store = new PgLessonDocStore({
    db: t.db, ids, clock, checks: new PgCheckQueue({ db: t.db, ids, clock }), states: new PgLessonRepo({ db: t.db, ids, clock }),
    audit: new PgAuditLog({ db: t.db, ids, clock }),
  });
  await t.db.with_tx(async (tx) => {
    for (const u of USERS) {
      await insert_row(tx, "app_user", { id: u.id, name: `Synthetic ${u.id}`, email: `${u.id}.demo@example.org`, role: u.role, synthetic: true });
      tokens[u.id] = randomBytes(16).toString("hex");
      await sessions.create_session(u.id, sha256(tokens[u.id]!), new Date(Date.now() + 3_600_000), tx);
    }
  });
}, 60000);
afterAll(async () => {
  await t.drop();
});

interface Client {
  p: any;
  doc: Y.Doc;
  stateless: any[];
  closes: { code: number; reason: string }[];
  edit(text: string): void;
}
interface Harness {
  server: Server;
  wiring: CollabServerWiring;
  log: string[];
  connect(user_id: string, lesson: string): Promise<Client>;
  conns(lesson: string): any[];
  stop(): Promise<void>;
}

async function start(debounce = 200, max_debounce = 400): Promise<Harness> {
  const log: string[] = [];
  const logger = create_logger({ service: "collab", build_id: "test", write: (l) => void log.push(l) });
  const base = load_collab_settings({ DATABASE_URL: t.url, COLLAB_INTERNAL_TOKEN: "t-collab" });
  const settings = { ...base, shared: settings_for(t.url, 4), store_debounce_ms: debounce, store_max_debounce_ms: max_debounce };
  const server = new Server({ port: 0, quiet: true, stopOnSignals: false, extensions: [] });
  // No ports are passed: the production default_ports must supply the access lookup (that is what this file pins).
  const wiring = wire_collab_server({ settings, logger, db: t.db as never, ids, clock }, { hocuspocus: server.hocuspocus });
  await server.listen();
  const clients: Client[] = [];
  const spec = "@hocuspocus/provider";
  const lib: any = await import(/* @vite-ignore */ spec);
  return {
    server, wiring, log,
    conns: (lesson) => (server.hocuspocus.documents.get(docname(lesson)) as any)?.getConnections() ?? [],
    async connect(user_id: string, lesson: string) {
      const cookie = `${settings.session_cookie_name}=${tokens[user_id]}`;
      class CookieWS extends WebSocket {
        constructor(u: string | URL) { super(u, { headers: { cookie } } as never); }
      }
      const doc = new Y.Doc();
      const stateless: any[] = [];
      const closes: { code: number; reason: string }[] = [];
      let synced!: () => void;
      const ready = new Promise<void>((r) => (synced = r));
      const p = new lib.HocuspocusProvider({
        url: `ws://127.0.0.1:${server.address.port}`, name: docname(lesson), token: "cookie", document: doc, WebSocketPolyfill: CookieWS,
        onSynced: () => synced(),
        onStateless: ({ payload }: { payload: string }) => void stateless.push(JSON.parse(payload)),
        onClose: ({ event }: { event: { code: number; reason: string } }) => void closes.push({ code: event.code, reason: event.reason }),
      });
      await Promise.race([ready, sleep(8000).then(() => { throw new Error("client never synced"); })]);
      const c: Client = { p, doc, stateless, closes, edit: (text) => doc.getMap("front_matter").set("title", text) };
      clients.push(c);
      return c;
    },
    async stop() {
      for (const c of clients) c.p.destroy();
      await server.destroy();
      await wiring.close();
    },
  };
}
const of_type = (c: Client, type: string) => c.stateless.filter((m) => m.type === type);
const read_only_msg = (c: Client, state?: string) =>
  c.stateless.some((m) => m.type === "mode" && m.mode === "read_only" && (state === undefined || m.state === state));

describe("S-29 role recheck on open sockets [AC-1, AC-3]", () => {
  it("I-1 a demoted editor is limited at the next recheck and nothing it types afterwards is stored", async () => {
    const L = await fresh_lesson("G6.U4.L51");
    const h = await start();
    try {
      const a = await h.connect("u-rev-1", L);
      const b = await h.connect("u-rev-2", L);
      const server_doc = h.server.hocuspocus.documents.get(docname(L)) as Y.Doc;

      const docs0 = await count("lesson_doc", "lesson_id", L);
      a.edit("BEFORE-DEMOTION");
      await until(() => of_type(a, "stored").length > 0, 8000, "first edit stored");
      expect(await count("lesson_doc", "lesson_id", L)).toBe(docs0 + 1);

      await scalar(t, "UPDATE app_user SET role='author' WHERE id='u-rev-1' RETURNING 1");
      await until(() => read_only_msg(a), 8000, "mode read_only after demotion");
      expect(read_only_msg(a, "in_review")).toBe(true);

      const docs1 = await count("lesson_doc", "lesson_id", L);
      const audits1 = await count("audit_event", "target_id", L);
      const sv1 = b64(server_doc);
      const client_sv = b64(a.doc);
      a.edit("AFTER-DEMOTION");
      await until(() => of_type(a, "refused").length > 0, 8000, "refused after demotion");
      const m = of_type(a, "refused")[0];
      expect(m).toMatchObject({ type: "refused", code: "LESSON_LOCKED" });
      expect(typeof m.refused_from).toBe("string");
      expect(m.refused_from).toBe(client_sv);
      await sleep(900); // longer than the test debounce
      expect(server_doc.getMap("front_matter").get("title")).not.toBe("AFTER-DEMOTION");
      expect(await count("lesson_doc", "lesson_id", L)).toBe(docs1);
      expect(await count("audit_event", "target_id", L)).toBe(audits1);
      expect(b64(server_doc)).toBe(sv1);
      expect(a.closes.filter(session_ended)).toEqual([]); // limited, not closed

      // positive control: the other reviewer still writes
      // b already received the "stored" broadcast for a's first edit, so wait for b's OWN edit
      // to land: poll the row count up to the expected value (bounded), then assert it exactly.
      b.edit("STILL-A-REVIEWER");
      const stored_end = Date.now() + 8000;
      while ((await count("lesson_doc", "lesson_id", L)) < docs1 + 1) {
        if (Date.now() > stored_end) throw new Error("timeout waiting for u-rev-2 edit stored");
        await sleep(25);
      }
      await until(() => of_type(b, "stored").length > 1, 8000, "u-rev-2 own stored broadcast");
      expect(await count("lesson_doc", "lesson_id", L)).toBe(docs1 + 1);
      expect(of_type(b, "refused")).toEqual([]);
      expect(h.log.join("\n")).toContain("collab.role_downgraded");
      expect(h.log.join("\n")).not.toContain("demo@example.org");
    } finally {
      await h.stop();
      await scalar(t, "UPDATE app_user SET role='reviewer' WHERE id='u-rev-1' RETURNING 1");
    }
  }, 60000);

  it("I-2 a demoted user is not made writable again by a later set_mode editable", async () => {
    const L = await fresh_lesson("G6.U4.L52");
    await scalar(t, "UPDATE app_user SET role='reviewer' WHERE id='u-rev-2' RETURNING 1");
    const h = await start();
    try {
      const a = await h.connect("u-rev-2", L);
      await scalar(t, "UPDATE app_user SET role='author' WHERE id='u-rev-2' RETURNING 1");
      await until(() => read_only_msg(a), 8000, "mode read_only after demotion");
      h.wiring.acks.mode(L, { mode: "editable", state: "in_review" } as never);
      await sleep(300);
      const ctxs = h.conns(L).map((c: any) => c.context?.ctx);
      expect(ctxs).toHaveLength(1);
      expect(ctxs[0].read_only).toBe(true);
      expect(ctxs[0].user.role).toBe("author");
      const docs0 = await count("lesson_doc", "lesson_id", L);
      a.edit("AFTER-SET-MODE");
      await until(() => of_type(a, "refused").length > 0, 8000, "refused after set_mode");
      await sleep(900);
      expect(await count("lesson_doc", "lesson_id", L)).toBe(docs0);
      expect((h.server.hocuspocus.documents.get(docname(L)) as Y.Doc).getMap("front_matter").get("title")).not.toBe("AFTER-SET-MODE");
    } finally {
      await h.stop();
      await scalar(t, "UPDATE app_user SET role='reviewer' WHERE id='u-rev-2' RETURNING 1");
    }
  }, 60000);

  it("I-3 a locked lesson state downgrades a connected reviewer without any set_mode command", async () => {
    const L = await fresh_lesson("G6.U4.L53");
    const h = await start();
    try {
      const a = await h.connect("u-i3-1", L);
      await scalar(t, "UPDATE lesson SET state='submitted' WHERE id=$1 RETURNING 1", [L]);
      await until(() => read_only_msg(a, "submitted"), 8000, "mode read_only submitted");
      const docs0 = await count("lesson_doc", "lesson_id", L);
      a.edit("EDIT-WHILE-SUBMITTED");
      await until(() => of_type(a, "refused").length > 0, 8000, "refused");
      expect(of_type(a, "refused")[0]).toMatchObject({ code: "LESSON_LOCKED" });
      await sleep(900);
      expect(await count("lesson_doc", "lesson_id", L)).toBe(docs0);
      expect((h.server.hocuspocus.documents.get(docname(L)) as Y.Doc).getMap("front_matter").get("title")).not.toBe("EDIT-WHILE-SUBMITTED");
      expect(a.closes.filter(session_ended)).toEqual([]);
    } finally {
      await h.stop();
    }
  }, 60000);

  it("I-4 a socket whose user row was deleted is closed with the session-ended reason and nothing it types lands", async () => {
    const L = await fresh_lesson("G6.U4.L54");
    const h = await start();
    try {
      const a = await h.connect("u-gone-1", L);
      const docs0 = await count("lesson_doc", "lesson_id", L);
      await scalar(t, "DELETE FROM app_user WHERE id='u-gone-1' RETURNING 1").catch(async () => {
        // a foreign key from app_session keeps the row: remove the dependants first (sessions stay valid for the test's point otherwise)
        throw new Error("app_user row could not be deleted: adjust the seed so the user has no dependants other than the session");
      });
      await until(() => a.closes.some(session_ended), 8000, "session-ended close");
      expect(h.log.join("\n")).toContain("user_removed");
      a.edit("EDIT-AFTER-REMOVAL");
      await sleep(1200);
      expect(await count("lesson_doc", "lesson_id", L)).toBe(docs0);
      expect((h.server.hocuspocus.documents.get(docname(L)) as Y.Doc | undefined)?.getMap("front_matter").get("title")).not.toBe("EDIT-AFTER-REMOVAL");
    } finally {
      await h.stop();
    }
  }, 60000);

  it("I-5 [negative] sign-out still closes the socket with the new query path active (S-9 regression)", async () => {
    const L = await fresh_lesson("G6.U4.L55");
    const h = await start();
    try {
      const a = await h.connect("u-i5-1", L);
      await sessions.revoke(sha256(tokens["u-i5-1"]!) as never, new Date());
      await until(() => a.closes.some(session_ended), 8000, "session-ended close after sign-out");
    } finally {
      await h.stop();
    }
  }, 60000);
});

describe("S-29 repo queries are batched and exact [AC-2]", () => {
  it("I-6 roles_of and states_of return exactly the ids that exist, and an empty list returns an empty map without a query", async () => {
    const L = await fresh_lesson("G6.U4.L56");
    const roles = await (sessions as any).roles_of(["u-rev-2", "u-author-1", "u-nobody"]);
    expect(roles).toBeInstanceOf(Map);
    expect([...roles.keys()].sort()).toEqual(["u-author-1", "u-rev-2"]);
    expect(roles.get("u-author-1")).toBe("author");

    const lessons = new PgLessonRepo({ db: t.db, ids, clock });
    const states = await (lessons as any).states_of([L, "G6.U4.NOPE"]);
    expect(states).toBeInstanceOf(Map);
    expect([...states.keys()]).toEqual([L]);
    expect(states.get(L)).toBe("in_review");

    // empty input never touches the pool: a database that throws on any use proves it
    const exploding = { with_tx: async () => { throw new Error("pool touched"); } } as never;
    const s2 = new PgSessionRepo({ db: exploding, ids, clock });
    const l2 = new PgLessonRepo({ db: exploding, ids, clock });
    expect(await (s2 as any).roles_of([])).toEqual(new Map());
    expect(await (l2 as any).states_of([])).toEqual(new Map());
  }, 60000);
});
