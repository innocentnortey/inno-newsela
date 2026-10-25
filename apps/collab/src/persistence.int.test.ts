// NL-80 frozen tests: AC-3, AC-4, AC-5, AC-6, AC-9, AC-10 (table half), AC-12 (capture). Real Postgres (scripts/test-db.sh up)
// and real @hocuspocus/provider clients against the real Hocuspocus server. Written before the implementation.
import { randomBytes } from "node:crypto";
import * as Y from "yjs";
import { Server } from "@hocuspocus/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { load_collab_settings } from "@ls/config/settings";
import { PgAuditLog } from "@ls/db/repos/audit";
import { PgCheckQueue } from "@ls/db/repos/check-queue";
import { PgLessonDocStore } from "@ls/db/repos/lesson-docs";
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgSessionRepo } from "@ls/db/repos/sessions";
import { FailingAudit, SYSTEM_ACTOR, WP1_LESSON_ID, rows, scalar, wp1 } from "@ls/db/repos/lesson-docs.test-support";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, settings_for, type TestDb } from "@ls/db/testing/test-db";
import type { StoredLesson } from "@ls/schema/lesson";
import { content_hash, state_vector_of } from "@ls/ydoc/hash";
import { lesson_to_ydoc, ydoc_to_lesson } from "@ls/ydoc/convert";
import { create_logger } from "@ls/obs/logger";
import { AckBroadcaster } from "./acks.ts";
import { FrozenDocs } from "./frozen-docs.ts";
import { LessonPersistence } from "./persistence.ts";
import { wire_collab_server, type CollabServerWiring } from "./wiring/server.ts";
import { SENTENCE, sha256 } from "./nl-80.fixtures.ts";

const DOC = `lesson:${WP1_LESSON_ID}`;
const ids = new PrefixedIdGenerator();
const clock = new SystemClock();
let t: TestDb;
const tokens: Record<string, string> = {};
const USERS = [
  { id: "u-rev-1", role: "reviewer" },
  { id: "u-rev-2", role: "reviewer" },
  { id: "u-author-1", role: "author" },
  { id: "u-appr-1", role: "approver" },
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
const count = async (table: string, col: string, v = WP1_LESSON_ID) =>
  Number(await scalar(t, `SELECT count(*)::int FROM ${table} WHERE ${col}=$1`, [v]));

beforeAll(async () => {
  t = await create_test_db({ pool_max: 8 });
  const repo = new PgSessionRepo({ db: t.db, ids, clock });
  const store = new PgLessonDocStore({
    db: t.db, ids, clock, checks: new PgCheckQueue({ db: t.db, ids, clock }), states: new PgLessonRepo({ db: t.db, ids, clock }),
    audit: new PgAuditLog({ db: t.db, ids, clock }),
  });
  await t.db.with_tx(async (tx) => {
    for (const u of USERS) {
      await insert_row(tx, "app_user", { id: u.id, name: `Synthetic ${u.id}`, email: `${u.id}.demo@example.org`, role: u.role, synthetic: true });
      tokens[u.id] = randomBytes(16).toString("hex");
      await repo.create_session(u.id, sha256(tokens[u.id]!), new Date(Date.now() + 3_600_000), tx);
    }
    await insert_row(tx, "lesson", { id: WP1_LESSON_ID, state: "in_review", last_editor_id: null });
    await store.seed_initial(WP1_LESSON_ID, wp1(), SYSTEM_ACTOR, tx);
  });
}, 60000);
afterAll(async () => {
  await t.drop();
});

interface Client {
  p: any;
  doc: Y.Doc;
  stateless: any[];
  edit(text: string): void;
}
interface Harness {
  server: Server;
  wiring: CollabServerWiring;
  log: string[];
  connect(user_id: string): Promise<Client>;
  stop(): Promise<void>;
}

async function start(debounce = 200, max_debounce = 400): Promise<Harness> {
  const log: string[] = [];
  const logger = create_logger({ service: "collab", build_id: "test", write: (l) => void log.push(l) });
  const base = load_collab_settings({ DATABASE_URL: t.url, COLLAB_INTERNAL_TOKEN: "t-collab" });
  const settings = { ...base, shared: settings_for(t.url, 4), store_debounce_ms: debounce, store_max_debounce_ms: max_debounce };
  const server = new Server({ port: 0, quiet: true, stopOnSignals: false, extensions: [] });
  const wiring = wire_collab_server({ settings, logger, db: t.db as never, ids, clock }, { hocuspocus: server.hocuspocus });
  await server.listen();
  const clients: Client[] = [];
  const spec = "@hocuspocus/provider";
  const lib: any = await import(/* @vite-ignore */ spec);
  return {
    server, wiring, log,
    async connect(user_id: string) {
      const cookie = `${settings.session_cookie_name}=${tokens[user_id]}`;
      class CookieWS extends WebSocket {
        constructor(u: string | URL) { super(u, { headers: { cookie } } as never); }
      }
      const doc = new Y.Doc();
      const stateless: any[] = [];
      let synced!: () => void;
      const ready = new Promise<void>((r) => (synced = r));
      const p = new lib.HocuspocusProvider({
        url: `ws://127.0.0.1:${server.address.port}`, name: DOC, token: "cookie", document: doc, WebSocketPolyfill: CookieWS,
        onSynced: () => synced(),
        onStateless: ({ payload }: { payload: string }) => void stateless.push(JSON.parse(payload)),
      });
      await Promise.race([ready, sleep(8000).then(() => { throw new Error("client never synced"); })]);
      const c: Client = { p, doc, stateless, edit: (text) => doc.getMap("front_matter").set("title", text) };
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

describe("frozen_update_refused_not_applied [failure/refusal, AC-3]", () => {
  it("a frozen document refuses the reviewer's update before it is applied; only that socket is told", async () => {
    const h = await start();
    try {
      const a = await h.connect("u-rev-1");
      const b = await h.connect("u-rev-2");
      const server_doc = h.server.hocuspocus.documents.get(DOC) as Y.Doc;
      const sv_before = Buffer.from(Y.encodeStateVector(server_doc)).toString("base64");
      const docs_before = await count("lesson_doc", "lesson_id");
      h.wiring.frozen.freeze(WP1_LESSON_ID);
      const client_sv = b64(a.doc);
      a.edit("SHOULD-NOT-LAND");
      await until(() => of_type(a, "refused").length > 0, 8000, "refused message");
      const m = of_type(a, "refused")[0];
      expect(m).toMatchObject({ type: "refused", code: "LESSON_LOCKED" });
      expect(m.refused_from).toBe(client_sv);
      expect(typeof m.message).toBe("string");
      await sleep(900); // longer than the test debounce: nothing may be stored
      expect(Buffer.from(Y.encodeStateVector(server_doc)).toString("base64")).toBe(sv_before);
      expect(server_doc.getMap("front_matter").get("title")).not.toBe("SHOULD-NOT-LAND");
      expect(await count("lesson_doc", "lesson_id")).toBe(docs_before);
      expect(of_type(b, "refused")).toEqual([]);
      expect(b.doc.getMap("front_matter").get("title")).not.toBe("SHOULD-NOT-LAND");
    } finally {
      await h.stop();
    }
  }, 30000);
});

describe("read_only_connection_update_refused [failure/refusal, AC-4]", () => {
  it("an author connection's update is refused LESSON_LOCKED and the co-editor receives nothing", async () => {
    const h = await start();
    try {
      const rev = await h.connect("u-rev-1");
      const author = await h.connect("u-author-1");
      const docs_before = await count("lesson_doc", "lesson_id");
      author.edit("AUTHOR-SHOULD-NOT-LAND");
      await until(() => of_type(author, "refused").length > 0, 8000, "refused message");
      expect(of_type(author, "refused")[0]).toMatchObject({ type: "refused", code: "LESSON_LOCKED" });
      await sleep(900);
      expect(of_type(rev, "refused")).toEqual([]);
      expect(rev.doc.getMap("front_matter").get("title")).not.toBe("AUTHOR-SHOULD-NOT-LAND");
      expect(await count("lesson_doc", "lesson_id")).toBe(docs_before);
    } finally {
      await h.stop();
    }
  }, 30000);

  it("[invariant] an approver is read-only too, and an unauthenticated socket never syncs", async () => {
    const h = await start();
    try {
      const appr = await h.connect("u-appr-1");
      appr.edit("APPROVER-SHOULD-NOT-LAND");
      await until(() => of_type(appr, "refused").length > 0, 8000, "refused message");
      expect(of_type(appr, "mode")[0]).toMatchObject({ mode: "read_only", state: "in_review" });
      tokens["u-nobody"] = "unknown-token";
      await expect(h.connect("u-nobody")).rejects.toThrow();
    } finally {
      await h.stop();
    }
  }, 30000);
});

describe("test_store_capture [invariant, AC-5, AC-12]", () => {
  it("20 edits by two clients inside 2 s give one debounced store, one row, one check_job, one stored each; then a frozen write is refused and writes nothing", async () => {
    const h = await start(2000, 4000);
    try {
      const a = await h.connect("u-rev-1");
      const b = await h.connect("u-rev-2");
      const docs_before = await count("lesson_doc", "lesson_id");
      const jobs_before = await count("check_job", "lesson_id");
      const t0 = Date.now();
      for (let i = 0; i < 20; i++) {
        (i % 2 === 0 ? a : b).edit(`${wp1().title} ${SENTENCE} edit ${i}`);
        await sleep(50);
      }
      expect(Date.now() - t0).toBeLessThan(2000);
      await until(() => of_type(a, "stored").length > 0 && of_type(b, "stored").length > 0, 9000, "stored on both clients");
      const elapsed = Date.now() - t0;
      expect(elapsed).toBeGreaterThanOrEqual(1900); // debounced, not per edit
      expect(elapsed).toBeLessThanOrEqual(4000 + 1500); // never later than the max debounce (plus slack)
      await sleep(2500); // no later second store
      expect(await count("lesson_doc", "lesson_id")).toBe(docs_before + 1);
      expect(of_type(a, "stored")).toHaveLength(1);
      expect(of_type(b, "stored")).toHaveLength(1);
      const sa = of_type(a, "stored")[0];
      expect(sa.content_hash).toBe(of_type(b, "stored")[0].content_hash);
      const [row] = await rows(t, "SELECT seq, content_hash, state_vector FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq DESC LIMIT 1", [WP1_LESSON_ID]);
      expect(row!["content_hash"]).toBe(sa.content_hash);
      expect(Buffer.from(row!["state_vector"] as Buffer).toString("base64")).toBe(sa.state_vector);
      expect(Number(await scalar(t, "SELECT count(*)::int FROM check_job WHERE lesson_id=$1 AND content_hash=$2", [WP1_LESSON_ID, sa.content_hash]))).toBe(1);
      expect(await count("check_job", "lesson_id")).toBeGreaterThanOrEqual(jobs_before);

      // capture half: freeze, keep typing
      const docs_mid = await count("lesson_doc", "lesson_id");
      const audits_mid = await count("audit_event", "target_id");
      h.log.length = 0;
      h.wiring.frozen.freeze(WP1_LESSON_ID);
      a.edit("TYPED-AFTER-FREEZE");
      await until(() => of_type(a, "refused").length > 0, 8000, "refused after freeze");
      expect(of_type(a, "refused")[0]).toMatchObject({ code: "LESSON_LOCKED" });
      await sleep(2600);
      expect(await count("lesson_doc", "lesson_id")).toBe(docs_mid);
      expect(await count("audit_event", "target_id")).toBe(audits_mid);
      const refused_lines = h.log.filter((l) => l.includes("collab.write_refused"));
      expect(refused_lines).toHaveLength(1);
      expect(JSON.parse(refused_lines[0]!)).toMatchObject({ event: "collab.write_refused", lesson_id: WP1_LESSON_ID });
    } finally {
      await h.stop();
    }
  }, 60000);
});

describe("last_editor_and_roundtrip_hash [invariant, AC-6]", () => {
  it("the stored row's last editor is the last storing user; after a restart load returns it and re-storing it is unchanged", async () => {
    const h = await start();
    const a = await h.connect("u-rev-1");
    const b = await h.connect("u-rev-2");
    a.edit(`${wp1().title} first by one`);
    await until(() => of_type(a, "stored").length >= 1, 8000, "first stored");
    b.edit(`${wp1().title} second by two`);
    await until(() => of_type(b, "stored").length >= 2, 8000, "second stored");
    expect(await scalar(t, "SELECT last_editor_id FROM lesson WHERE id=$1", [WP1_LESSON_ID])).toBe("u-rev-2");
    expect(await scalar(t, "SELECT stored_by FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq DESC LIMIT 1", [WP1_LESSON_ID])).toBe("u-rev-2");
    await h.stop();

    const h2 = await start();
    try {
      const [latest] = await rows(t, "SELECT ydoc_bytes, content_hash, seq FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq DESC LIMIT 1", [WP1_LESSON_ID]);
      const loaded = await h2.wiring.persistence.load(DOC);
      expect(Buffer.from(loaded.ydoc_bytes)).toEqual(latest!["ydoc_bytes"]);
      expect(await h2.wiring.persistence.store(DOC, loaded.ydoc_bytes, null, null)).toBeNull();
      expect(content_hash(ydoc_to_lesson(loaded.ydoc_bytes, 1))).toBe(latest!["content_hash"]);
    } finally {
      await h2.stop();
    }
  }, 60000);
});

describe("store_tx_p95_and_atomicity [invariant, AC-9]", () => {
  function parts(audit_wrap?: (a: PgAuditLog) => any) {
    const deps = { db: t.db, ids, clock };
    const audit = new PgAuditLog(deps);
    const states = new PgLessonRepo(deps);
    const doc_store = new PgLessonDocStore({ ...deps, checks: new PgCheckQueue(deps), states, audit: audit_wrap ? audit_wrap(audit) : audit });
    const acks = new AckBroadcaster({ sockets_of: () => [], find: () => undefined });
    const stored = vi.spyOn(acks, "stored");
    const logger = create_logger({ service: "collab", build_id: "test", write: () => {} });
    const base = load_collab_settings({ DATABASE_URL: t.url, COLLAB_INTERNAL_TOKEN: "t-collab" });
    const p = new LessonPersistence(doc_store, new PgLessonDocReader({ db: t.db }), new FrozenDocs(), acks, logger, base);
    return { p, stored };
  }
  const big = (): StoredLesson => {
    const l = wp1();
    return { ...l, sections: l.sections.map((s) => ({ ...s, content: { ...s.content, content: Array.from({ length: 47 }, () => s.content.content).flat() } })) } as unknown as StoredLesson;
  };
  const next_edit = (doc: Y.Doc, i: number): Uint8Array => {
    doc.getMap("front_matter").set("title", `big ${i}`);
    return Y.encodeStateAsUpdate(doc);
  };

  it("p95 of 50 stores of a 47x lesson is at most 500 ms", async () => {
    const { p } = parts();
    const doc = new Y.Doc();
    Y.applyUpdate(doc, lesson_to_ydoc(big()));
    const times: number[] = [];
    for (let i = 0; i < 50; i++) {
      const bytes = next_edit(doc, i);
      const t0 = performance.now();
      const ack = await p.store(DOC, bytes, "u-rev-1", null);
      times.push(performance.now() - t0);
      expect(ack, `store ${i}`).not.toBeNull();
    }
    times.sort((x, y) => x - y);
    const p95 = times[Math.ceil(times.length * 0.95) - 1]!;
    expect(p95).toBeLessThanOrEqual(500);
  }, 120000);

  it("[failure] a failing audit write leaves no partial lesson_doc / check_job / audit_event rows and sends no stored message", async () => {
    const { p, stored } = parts((a) => new FailingAudit(a));
    const before = [await count("lesson_doc", "lesson_id"), await count("check_job", "lesson_id"), await count("audit_event", "target_id")];
    const doc = new Y.Doc();
    Y.applyUpdate(doc, lesson_to_ydoc(wp1()));
    doc.getMap("front_matter").set("title", "atomicity probe");
    await expect(p.store(DOC, Y.encodeStateAsUpdate(doc), "u-rev-1", null)).rejects.toThrow();
    const after = [await count("lesson_doc", "lesson_id"), await count("check_job", "lesson_id"), await count("audit_event", "target_id")];
    expect(after).toEqual(before);
    expect(stored).not.toHaveBeenCalled();
    expect(state_vector_of(Y.encodeStateAsUpdate(doc)).length).toBeGreaterThan(0);
  }, 30000);
});

describe("no_sentence_outside_lesson_doc_tables [negative, AC-10]", () => {
  it("after an edit and a refusal, the distinctive sentence is in lesson_doc only", async () => {
    const h = await start();
    try {
      const a = await h.connect("u-rev-1");
      const author = await h.connect("u-author-1");
      a.edit(`${SENTENCE} stored sentence`);
      await until(() => of_type(a, "stored").length > 0, 8000, "stored");
      author.edit(`${SENTENCE} refused sentence`);
      await until(() => of_type(author, "refused").length > 0, 8000, "refused");
      expect(JSON.stringify(of_type(a, "refused"))).not.toContain(SENTENCE);
      expect(JSON.stringify(a.stateless)).not.toContain(SENTENCE);
      expect(h.log.join("\n")).not.toContain(SENTENCE);
      const tables = (await rows(t, "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'"))
        .map((r) => r["table_name"] as string);
      const hits: string[] = [];
      for (const name of tables) {
        if (name === "lesson_doc") continue;
        const n = Number(await scalar(t, `SELECT count(*)::int FROM "${name}" x WHERE x::text LIKE $1`, [`%${SENTENCE}%`]));
        if (n > 0) hits.push(name);
      }
      expect(hits).toEqual([]);
      expect(Number(await scalar(t, "SELECT count(*)::int FROM lesson_doc WHERE derived_json::text LIKE $1", [`%${SENTENCE}%`]))).toBeGreaterThan(0);
    } finally {
      await h.stop();
    }
  }, 30000);
});
