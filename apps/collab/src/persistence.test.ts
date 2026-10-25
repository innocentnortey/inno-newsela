// NL-80 frozen tests: AC-7 and the unit half of AC-5/AC-6 (no database). Written before the implementation.
import * as Y from "yjs";
import { describe, expect, it } from "vitest";
import { AckBroadcaster } from "./acks.ts";
import { FrozenDocs } from "./frozen-docs.ts";
import { LessonPersistence } from "./persistence.ts";
import { wire_collab_server } from "./wiring/server.ts";
import {
  DOC_NAME, FakeConnection, FakeDocStore, FakeDocument, FakeReader, FakeSessions, FakeStates, LESSON, bytes_of, capture_logger, clock,
  edited, settings, stored_doc, user, wp1,
} from "./nl-80.fixtures.ts";

function persistence(reader: FakeReader, store = new FakeDocStore(), conns: FakeConnection[] = []) {
  const handles = conns.map((c) => ({ socket_id: c.socketId, context: () => c.context.ctx as never, send_stateless: (j: string) => c.sendStateless(j),
    set_read_only: () => {} }));
  const acks = new AckBroadcaster({ sockets_of: () => handles, find: (id) => handles.find((h) => h.socket_id === id) });
  const { logger, lines } = capture_logger();
  return { p: new LessonPersistence(store, reader, new FrozenDocs(), acks, logger, settings()), store, lines };
}

describe("unknown_schema_version_fails_loudly [failure/refusal, AC-7]", () => {
  it("a stored schema_version 99 rejects with an error naming the lesson id and returns no document", async () => {
    const { p } = persistence(new FakeReader(stored_doc({ schema_version: 99 })));
    const err = await p.load(DOC_NAME).then(() => null, (e: unknown) => e as Error);
    expect(err).toBeInstanceOf(Error);
    expect(err!.message).toContain(LESSON);
    expect(err!.message).toContain("99");
  });

  it("[boundary] a lesson with no lesson_doc fails loudly too, naming the id", async () => {
    const { p } = persistence(new FakeReader(null));
    await expect(p.load(DOC_NAME)).rejects.toThrow(LESSON);
  });

  it("a known version loads the stored bytes", async () => {
    const doc = stored_doc();
    const { p } = persistence(new FakeReader(doc));
    const l = await p.load(DOC_NAME);
    expect(l.ydoc_bytes).toEqual(doc.ydoc_bytes);
    expect(l.lesson_id).toBe(LESSON);
  });
});

describe("store behaviour [invariant, AC-5/AC-6 unit half]", () => {
  it("storing the loaded bytes unchanged is a no-op (null, no row) and the round-trip hash is stable", async () => {
    const reader = new FakeReader(stored_doc());
    const { p, store } = persistence(reader);
    await p.load(DOC_NAME);
    expect(await p.store(DOC_NAME, reader.doc!.ydoc_bytes, "u-rev-1", null)).toBeNull();
    expect(store.requests).toHaveLength(0);
  });

  it("an edited document stores once with hash, state vector, last editor, then acks stored to every socket", async () => {
    const reader = new FakeReader(stored_doc());
    const a = new FakeConnection("a", { ctx: {} });
    const b = new FakeConnection("b", { ctx: {} });
    const { p, store } = persistence(reader, new FakeDocStore(), [a, b]);
    await p.load(DOC_NAME);
    const ack = await p.store(DOC_NAME, bytes_of(edited(1)), "u-rev-2", null);
    expect(ack).not.toBeNull();
    expect(store.requests).toHaveLength(1);
    expect(store.requests[0]).toMatchObject({ lesson_id: LESSON, stored_by: "u-rev-2" });
    expect(store.requests[0]!.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(store.requests[0]!.derived.title).toBe(edited(1).title);
    for (const c of [a, b]) {
      expect(c.sent).toHaveLength(1);
      expect(JSON.parse(c.sent[0]!)).toMatchObject({ type: "stored", content_hash: store.requests[0]!.content_hash });
    }
  });

  it("[invariant] a failing store transaction sends no stored message and propagates the error", async () => {
    const a = new FakeConnection("a", { ctx: {} });
    const fail = new FakeDocStore();
    fail.fail = true;
    const { p } = persistence(new FakeReader(stored_doc()), fail, [a]);
    await p.load(DOC_NAME);
    await expect(p.store(DOC_NAME, bytes_of(edited(2)), "u-rev-1", null)).rejects.toThrow();
    expect(a.sent).toEqual([]);
  });

  it("onStoreDocument hook passes the last typist's user id and acks both clients", async () => {
    const sessions = new FakeSessions();
    const store = new FakeDocStore();
    const hocus = { configuration: { extensions: [] as unknown[], debounce: 0, maxDebounce: 0 }, documents: new Map<string, FakeDocument>() };
    const { logger } = capture_logger();
    const w = wire_collab_server({ settings: settings(), logger, db: {} as never, ids: {} as never, clock: clock() }, { hocuspocus: hocus },
      { sessions, states: new FakeStates(), doc_store: store, doc_reader: new FakeReader(stored_doc()) });
    const rev = user("reviewer", "u-rev-9");
    const c1 = new FakeConnection("s1", { ctx: { socket_id: "s1", user: rev, lesson_id: LESSON, lesson_state: "in_review", read_only: false } });
    const c2 = new FakeConnection("s2", { ctx: { socket_id: "s2", user: rev, lesson_id: LESSON, lesson_state: "in_review", read_only: false } });
    const doc = new FakeDocument([c1, c2]);
    hocus.documents.set(DOC_NAME, doc);
    const hooks = w.extension as unknown as Record<string, (p: unknown) => Promise<unknown>>;
    await hooks["onLoadDocument"]!({ document: doc, documentName: DOC_NAME });
    doc.getMap("front_matter").set("title", edited(3).title);
    await hooks["onStoreDocument"]!({ document: doc, documentName: DOC_NAME, lastContext: { ctx: { user: rev } } });
    expect(store.requests).toHaveLength(1);
    expect(store.requests[0]!.stored_by).toBe("u-rev-9");
    expect(c1.sent).toHaveLength(1);
    expect(c1.sent).toEqual(c2.sent);
    expect(Y.encodeStateVector(doc).length).toBeGreaterThan(0);
    expect(wp1().title).not.toBe(edited(3).title);
  });
});
