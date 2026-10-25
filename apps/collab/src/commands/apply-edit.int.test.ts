// NL-105 frozen tests: AC-4 .. AC-10 and AC-13 (capture). Real Postgres (scripts/test-db.sh up) and a real Hocuspocus
// server; the routes are the real handle_internal behind a bare node http server. Candidate versions and standards
// text come from fakes. Written before the implementation.
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
import { PgLessonDocReader } from "@ls/db/repos/lesson-doc-reads";
import { PgLessonRepo } from "@ls/db/repos/lessons";
import { PgSessionRepo } from "@ls/db/repos/sessions";
import { SYSTEM_ACTOR, rows, scalar } from "@ls/db/repos/lesson-docs.test-support";
import { insert_row } from "@ls/db/testing/insert-row";
import { create_test_db, settings_for, type TestDb } from "@ls/db/testing/test-db";
import { SCHEMA_VERSION } from "@ls/editor-schema/schema";
import { create_logger } from "@ls/obs/logger";
import type { StoredLesson } from "@ls/schema/lesson";
import { ydoc_to_lesson } from "@ls/ydoc/convert";
import { sha256 } from "../nl-80.fixtures.ts";
import { wire_collab_server, type CollabServerWiring } from "../wiring/server.ts";
import { wire_collab_commands } from "../wiring/commands.ts";
import { install_command_handler, type CollabCommandHandler } from "./routes.ts";
import {
  CANDIDATE_ID, FakeStandards, FakeVersions, LIVE_TEXT, SLOT, actor, bearer, candidate_of, edit_body, http_harness, lesson_with_slot, rid, type Http,
} from "./nl-105.fixtures.ts";

const ids = new PrefixedIdGenerator();
const clock = new SystemClock();
let t: TestDb;
const tokens: Record<string, string> = {};
const USERS = ["u-rev-1", "u-rev-2"];
let n = 0;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
async function until(cond: () => boolean | Promise<boolean>, ms = 8000, what = "condition"): Promise<void> {
  const end = Date.now() + ms;
  while (!(await cond())) {
    if (Date.now() > end) throw new Error(`timeout waiting for ${what}`);
    await sleep(25);
  }
}

beforeAll(async () => {
  t = await create_test_db({ pool_max: 8 });
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

interface H {
  server: Server;
  wiring: CollabServerWiring;
  handler: CollabCommandHandler;
  http: Http;
  log: string[];
  stop(): Promise<void>;
}
async function start(debounce = 600_000, with_commands = true): Promise<H> {
  const log: string[] = [];
  const logger = create_logger({ service: "collab", build_id: "test", write: (l) => void log.push(l) });
  const base = load_collab_settings({ DATABASE_URL: t.url, COLLAB_INTERNAL_TOKEN: "t-collab" });
  const settings = { ...base, shared: settings_for(t.url, 4), store_debounce_ms: debounce, store_max_debounce_ms: debounce * 2 };
  const server = new Server({ port: 0, quiet: true, stopOnSignals: false, extensions: [] });
  const d = { settings, logger, db: t.db as never, ids, clock };
  const wiring = wire_collab_server(d, { hocuspocus: server.hocuspocus });
  await server.listen();
  const deps = { db: t.db, ids, clock };
  const states = new PgLessonRepo(deps);
  const store = new PgLessonDocStore({ ...deps, checks: new PgCheckQueue(deps), states, audit: new PgAuditLog(deps) });
  const versions = new FakeVersions(new Map([[CANDIDATE_ID, candidate_of("*")]]));
  const w = with_commands
    ? wire_collab_commands(d, wiring, { hocuspocus: server.hocuspocus }, {
        store, reader: new PgLessonDocReader({ db: t.db }), states, versions: versions as never, standards: new FakeStandards() as never, tx: t.db as never,
      })
    : null;
  const http = await http_harness(logger);
  return {
    server, wiring, handler: w?.handler as CollabCommandHandler, http, log,
    async stop() {
      if (with_commands) install_command_handler(null);
      await http.close();
      await server.destroy();
      await wiring.close();
    },
  };
}

async function new_lesson(state = "in_review"): Promise<string> {
  const id = `G6.U4.L${200 + ++n}`;
  const store = new PgLessonDocStore({
    db: t.db, ids, clock, checks: new PgCheckQueue({ db: t.db, ids, clock }), states: new PgLessonRepo({ db: t.db, ids, clock }), audit: new PgAuditLog({ db: t.db, ids, clock }),
  });
  await t.db.with_tx(async (tx) => {
    await insert_row(tx, "lesson", { id, state, last_editor_id: null });
    await store.seed_initial(id, lesson_with_slot(id), SYSTEM_ACTOR, tx);
  });
  return id;
}
const doc_name = (id: string) => `lesson:${id}`;
const count = async (table: string, col?: string, v?: string) =>
  Number(await scalar(t, col === undefined ? `SELECT count(*)::int FROM ${table}` : `SELECT count(*)::int FROM ${table} WHERE ${col}=$1`, v === undefined ? [] : [v]));
/** All four tables the routes must leave alone on a refusal. */
const totals = async () => [await count("lesson_doc"), await count("lesson_version"), await count("review_event"), await count("audit_event")];
async function latest(id: string): Promise<StoredLesson> {
  const [r] = await rows(t, "SELECT ydoc_bytes FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq DESC LIMIT 1", [id]);
  return ydoc_to_lesson(new Uint8Array(r!["ydoc_bytes"] as Buffer), SCHEMA_VERSION);
}
const section = (l: StoredLesson, a: string) => l.sections.find((s) => s.address === a)!;
const text_of = (node: any): string => (node.type === "text" ? node.text : (node.content ?? []).map(text_of).join(""));
const live_para = (l: StoredLesson) => text_of((section(l, "literacy_lab").content as any).content[0]);

/** Holds a direct connection open so the live document can be observed and the origins of its transactions recorded. */
async function observe(h: H, id: string) {
  const conn = await (h.server.hocuspocus as any).openDirectConnection(doc_name(id), {});
  const doc = (h.server.hocuspocus as any).documents.get(doc_name(id)) as Y.Doc;
  const origins: any[] = [];
  doc.on("afterTransaction", (tr: Y.Transaction) => void origins.push(tr.origin));
  return { conn, doc, origins, tagged: () => origins.filter((o) => o?.context?.tag !== undefined), close: () => conn.disconnect() };
}
const para_text = (doc: Y.Doc) => ((doc.getXmlFragment("section:literacy_lab").get(0) as Y.XmlElement).get(0) as Y.XmlText);
function anchor_over(doc: Y.Doc, from: number, to: number) {
  const enc = (i: number) => Buffer.from(Y.encodeRelativePosition(Y.createRelativePositionFromTypeIndex(para_text(doc), i))).toString("base64");
  return { start: enc(from), end: enc(to) };
}

describe("harness sanity [characterization]", () => {
  it("a direct connection loads the seeded lesson and the live document can be observed", async () => {
    const h = await start(600_000, false);
    try {
      const id = await new_lesson();
      const o = await observe(h, id);
      expect(para_text(o.doc).toString()).toBe(LIVE_TEXT);
      // anchors resolve against the live document and survive an edit; persistence.store writes a row at once
      const a = anchor_over(o.doc, 0, LIVE_TEXT.length);
      await o.conn.transact(() => {
        para_text(o.doc).delete(11, 5);
        para_text(o.doc).insert(11, "delta");
      });
      const rel = Y.decodeRelativePosition(Buffer.from(a.end, "base64"));
      expect(Y.createAbsolutePositionFromRelativePosition(rel, o.doc)?.index).toBe(16);
      const before = await count("lesson_doc", "lesson_id", id);
      expect(await h.wiring.persistence.store(doc_name(id), Y.encodeStateAsUpdate(o.doc) as never, null, null)).not.toBeNull();
      expect(await count("lesson_doc", "lesson_id", id)).toBe(before + 1);
      expect(live_para(await latest(id))).toBe("alpha beta delta");
      await o.close();
    } finally {
      await h.stop();
    }
  }, 30000);
});

describe("test_internal_command_capture [capture, AC-4, AC-13]", () => {
  it("apply-edit confirm over the real route: one tagged Yjs transaction, an immediate row, last editor and request_id on the rows; no token or a frozen lesson writes nothing", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      const o = await observe(h, id);
      const docs_before = await count("lesson_doc", "lesson_id", id);
      const audit_before = await count("audit_event", "request_id", rid(41));
      const res = await h.http.post(id, "apply-edit", edit_body({ request_id: rid(41) }, id), bearer());
      expect(res.status).toBe(200);
      expect(res.json).toMatchObject({ lesson_id: id, stored_by: "u-rev-1", check_job_enqueued: true });
      expect(new Date(res.json.stored_at).toISOString()).toBe(res.json.stored_at);

      // one transaction with origin {actor, tag}
      expect(o.tagged()).toHaveLength(1);
      expect(o.tagged()[0].context).toMatchObject({ tag: "standard-decision", actor: { user_id: "u-rev-1" } });
      // stored at once (the debounce is ten minutes)
      expect(await count("lesson_doc", "lesson_id", id)).toBe(docs_before + 1);
      expect(await scalar(t, "SELECT stored_by FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq DESC LIMIT 1", [id])).toBe("u-rev-1");
      expect(await scalar(t, "SELECT request_id FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq DESC LIMIT 1", [id])).toBe(rid(41));
      expect(await scalar(t, "SELECT last_editor_id FROM lesson WHERE id=$1", [id])).toBe("u-rev-1");
      expect(await count("audit_event", "request_id", rid(41))).toBeGreaterThan(audit_before);
      expect((await latest(id)).front_matter.standards.find((s) => s.code === "RL.6.1")?.confirmation).toBe("confirmed");
      // exactly one check job for the new content hash
      expect(Number(await scalar(t, "SELECT count(*)::int FROM check_job WHERE lesson_id=$1 AND content_hash=$2", [id, res.json.content_hash]))).toBe(1);
      await o.close();

      // 401 on every route, no row in any of the four tables
      const before = await totals();
      for (const route of ["apply-edit", "set-mode", "lock-and-snapshot"]) {
        expect((await h.http.post(id, route, edit_body({}, id))).status).toBe(401);
        expect((await h.http.post(id, route, edit_body({}, id), bearer("wrong"))).status).toBe(401);
      }
      expect(await totals()).toEqual(before);

      // frozen: LESSON_LOCKED, no row
      h.wiring.frozen.freeze(id);
      const locked = await h.http.post(id, "apply-edit", edit_body({ request_id: rid(42) }, id), bearer());
      expect(locked.status).toBe(409);
      expect(locked.json.error).toMatchObject({ code: "LESSON_LOCKED", details: { state: "in_review" } });
      expect(await totals()).toEqual(before);
      expect(h.log.join("\n")).not.toContain("t-collab");
    } finally {
      await h.stop();
    }
  }, 60000);

  // NL-106 owns the lock-and-snapshot half of this capture test; it lands with that ticket.
  it.skip("lock-and-snapshot half: review_event and lesson_version rows carry the request_id (NL-106)", () => {});
});

describe("slot_fill_and_adopt_scopes [invariant, AC-5]", () => {
  it("slot_fill writes a quote with source_ref (JSON string) and rights into the slot's section, tag slot-fill, and nothing else changes", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      const before = await latest(id);
      const o = await observe(h, id);
      const source_ref = { title: "Fable collection", chapter: "2" };
      await h.handler.apply_edit(edit_body({
        tag: "slot-fill", request_id: rid(51),
        edit: { kind: "slot_fill", slot_id: SLOT, text: "The hare boasted.", source_ref, rights_status: "public-domain" },
      }, id) as never);
      expect(o.tagged().map((x) => x.context.tag)).toEqual(["slot-fill"]);
      await o.close();
      const after = await latest(id);
      const lab = (section(after, "literacy_lab").content as any).content;
      const q = lab.find((x: any) => x.type === "quote");
      expect(q).toBeDefined();
      expect(q.attrs).toMatchObject({ slot_id: SLOT, rights: "public-domain" });
      expect(JSON.parse(q.attrs.source_ref)).toEqual(source_ref);
      expect(text_of(q)).toBe("The hare boasted.");
      expect(lab.some((x: any) => x.type === "quote_placeholder")).toBe(false);
      expect(section(after, "launch")).toEqual(section(before, "launch"));
      expect(section(after, "wrap_up")).toEqual(section(before, "wrap_up"));
      expect(after.title).toBe(before.title);
    } finally {
      await h.stop();
    }
  }, 60000);

  it("adopt with scope section replaces only that section; scope whole replaces every section; front matter is untouched; tag candidate-adopt", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      const before = await latest(id);
      const o = await observe(h, id);
      const adopt = (scope: "section" | "whole", rn: number) => edit_body({
        tag: "candidate-adopt", request_id: rid(rn),
        edit: { kind: "adopt", candidate_version_id: CANDIDATE_ID, scope, section_address: scope === "section" ? "literacy_lab" : null },
      }, id) as never;
      await h.handler.apply_edit(adopt("section", 52));
      const mid = await latest(id);
      expect(live_para(mid)).toBe("Candidate text for literacy_lab");
      expect(section(mid, "launch")).toEqual(section(before, "launch"));
      expect(section(mid, "wrap_up")).toEqual(section(before, "wrap_up"));
      await h.handler.apply_edit(adopt("whole", 53));
      const whole = await latest(id);
      for (const a of ["launch", "literacy_lab", "wrap_up"]) expect(text_of(section(whole, a).content)).toBe(`Candidate text for ${a}`);
      expect(whole.title).toBe(before.title);
      expect(whole.front_matter.standards).toEqual(before.front_matter.standards);
      expect(o.tagged().map((x) => x.context.tag)).toEqual(["candidate-adopt", "candidate-adopt"]);
      await o.close();
    } finally {
      await h.stop();
    }
  }, 60000);
});

describe("frozen_or_non_editable_refused [failure/refusal, AC-6]", () => {
  it("frozen, submitted, approved and draft each give 409 LESSON_LOCKED with details.state and write no row", async () => {
    const h = await start();
    try {
      const cases: [string, string, boolean][] = [["in_review", "in_review", true], ["submitted", "submitted", false], ["approved", "approved", false], ["draft", "draft", false]];
      for (const [state, expected, freeze] of cases) {
        const id = await new_lesson(state);
        if (freeze) h.wiring.frozen.freeze(id);
        const before = await totals();
        const res = await h.http.post(id, "apply-edit", edit_body({ request_id: rid(60) }, id), bearer());
        expect(res.status, state).toBe(409);
        expect(res.json.error.code, state).toBe("LESSON_LOCKED");
        expect(res.json.error.details.state, state).toBe(expected);
        expect(await totals(), state).toEqual(before);
        expect((h.server.hocuspocus as any).documents.has(doc_name(id)), state).toBe(false);
      }
    } finally {
      await h.stop();
    }
  }, 60000);
});

describe("anchor_changed_trusts_live_text_only [failure/refusal, AC-7]", () => {
  it("live text 'alpha beta delta' vs stored 'alpha beta gamma' gives 409 ANCHOR_CHANGED, applies nothing, and a caller-supplied anchored_text_now changes nothing", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      const o = await observe(h, id);
      const anchor = anchor_over(o.doc, 0, LIVE_TEXT.length);
      await o.conn.transact(() => {
        para_text(o.doc).delete(11, 5);
        para_text(o.doc).insert(11, "delta");
      });
      await h.wiring.persistence.store(doc_name(id), Y.encodeStateAsUpdate(o.doc) as never, null, null);
      const before = await totals();
      const origins_before = o.tagged().length;
      const cmd = edit_body({
        tag: "ai-assist", request_id: rid(70),
        edit: { kind: "suggestion_accept", suggestion_id: "sug_1", anchor, expected_text: LIVE_TEXT, replacement_text: "REPLACED" },
      }, id);
      const res = await h.http.post(id, "apply-edit", cmd, bearer());
      expect(res.status).toBe(409);
      expect(res.json.error.code).toBe("ANCHOR_CHANGED");
      await expect(h.handler.apply_edit({ ...cmd, anchored_text_now: LIVE_TEXT } as never)).rejects.toMatchObject({ code: "ANCHOR_CHANGED" });
      expect(para_text(o.doc).toString()).toBe("alpha beta delta");
      expect(o.tagged().length).toBe(origins_before);
      expect(await totals()).toEqual(before);
      await o.close();
    } finally {
      await h.stop();
    }
  }, 60000);
});

describe("accept_applies_tagged_to_acceptor [invariant, AC-8]", () => {
  it("when the live text equals expected_text the replacement lands in one ai-assist transaction by the acceptor and is stored at once", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      const o = await observe(h, id);
      const anchor = anchor_over(o.doc, 0, LIVE_TEXT.length);
      const docs_before = await count("lesson_doc", "lesson_id", id);
      const res = await h.http.post(id, "apply-edit", edit_body({
        actor: actor("u-rev-2"), tag: "ai-assist", request_id: rid(80),
        edit: { kind: "suggestion_accept", suggestion_id: "sug_2", anchor, expected_text: LIVE_TEXT, replacement_text: "alpha beta omega" },
      }, id), bearer());
      expect(res.status).toBe(200);
      expect(o.tagged()).toHaveLength(1);
      expect(o.tagged()[0].context).toMatchObject({ tag: "ai-assist", actor: { user_id: "u-rev-2" } });
      expect(await count("lesson_doc", "lesson_id", id)).toBe(docs_before + 1);
      expect(await scalar(t, "SELECT stored_by FROM lesson_doc WHERE lesson_id=$1 ORDER BY seq DESC LIMIT 1", [id])).toBe("u-rev-2");
      expect(await scalar(t, "SELECT last_editor_id FROM lesson WHERE id=$1", [id])).toBe("u-rev-2");
      expect(live_para(await latest(id))).toBe("alpha beta omega");
      await o.close();
    } finally {
      await h.stop();
    }
  }, 60000);
});

describe("concurrent_socket_edit_merges [invariant, AC-9]", () => {
  it("a reviewer socket editing the title while apply-edit confirms a standard: both changes are stored and the socket receives stored", async () => {
    const h = await start(200);
    const spec = "@hocuspocus/provider";
    const lib: any = await import(/* @vite-ignore */ spec);
    let provider: any;
    try {
      const id = await new_lesson();
      const cookie = `${(load_collab_settings({ DATABASE_URL: t.url, COLLAB_INTERNAL_TOKEN: "t-collab" })).session_cookie_name}=${tokens["u-rev-1"]}`;
      class CookieWS extends WebSocket {
        constructor(u: string | URL) { super(u, { headers: { cookie } } as never); }
      }
      const doc = new Y.Doc();
      const stateless: any[] = [];
      let synced!: () => void;
      const ready = new Promise<void>((r) => (synced = r));
      provider = new lib.HocuspocusProvider({
        url: `ws://127.0.0.1:${h.server.address.port}`, name: doc_name(id), token: "cookie", document: doc, WebSocketPolyfill: CookieWS,
        onSynced: () => synced(),
        onStateless: ({ payload }: { payload: string }) => void stateless.push(JSON.parse(payload)),
      });
      await Promise.race([ready, sleep(8000).then(() => { throw new Error("client never synced"); })]);

      doc.getMap("front_matter").set("title", "TITLE-FROM-SOCKET");
      const res = await h.http.post(id, "apply-edit", edit_body({ actor: actor("u-rev-2"), request_id: rid(90) }, id), bearer());
      expect(res.status).toBe(200);
      await until(async () => (await latest(id)).title === "TITLE-FROM-SOCKET", 10000, "socket edit stored");
      const merged = await latest(id);
      expect(merged.title).toBe("TITLE-FROM-SOCKET");
      expect(merged.front_matter.standards.find((s) => s.code === "RL.6.1")?.confirmation).toBe("confirmed");
      await until(() => stateless.some((m) => m.type === "stored"), 8000, "stored message on the socket");
    } finally {
      provider?.destroy();
      await h.stop();
    }
  }, 60000);
});

describe("not_found [failure/refusal, AC-10]", () => {
  it("unknown lesson, slot, candidate, section, standard code: 404 NOT_FOUND and nothing written", async () => {
    const h = await start();
    try {
      const id = await new_lesson();
      const edits: [string, Record<string, unknown>][] = [
        ["slot", { tag: "slot-fill", edit: { kind: "slot_fill", slot_id: "no-such-slot", text: "x", source_ref: { title: "t" }, rights_status: "licensed" } }],
        ["candidate", { tag: "candidate-adopt", edit: { kind: "adopt", candidate_version_id: "ver_missing", scope: "whole", section_address: null } }],
        ["section", { tag: "candidate-adopt", edit: { kind: "adopt", candidate_version_id: CANDIDATE_ID, scope: "section", section_address: "no_such_section" } }],
        ["standard", { edit: { kind: "standard", code: "NO.SUCH.CODE", decision: "confirm", restore: null } }],
        ["standard to add", { edit: { kind: "standard", code: "NO.SUCH.CODE", decision: "add", restore: null } }],
      ];
      for (const [what, over] of edits) {
        const before = await totals();
        const res = await h.http.post(id, "apply-edit", edit_body({ request_id: rid(100), ...over }, id), bearer());
        expect(res.status, what).toBe(404);
        expect(res.json.error.code, what).toBe("NOT_FOUND");
        expect(await totals(), what).toEqual(before);
      }
      const ghost = "G6.U4.L999";
      const before = await totals();
      const res = await h.http.post(ghost, "apply-edit", edit_body({}, ghost), bearer());
      expect(res.status).toBe(404);
      expect(res.json.error.code).toBe("NOT_FOUND");
      expect(await totals()).toEqual(before);
      expect(await count("lesson_doc", "lesson_id", ghost)).toBe(0);
    } finally {
      await h.stop();
    }
  }, 60000);
});
