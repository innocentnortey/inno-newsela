// @vitest-environment node
import { HocuspocusProvider } from "@hocuspocus/provider";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { startCollabMock, type CollabMock } from "../../../mocks/collab-mock";

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const c of cleanups.splice(0).reverse()) await c();
});

async function mock(opts: Parameters<typeof startCollabMock>[0] = {}) {
  const m = await startCollabMock({ port: 0, requireCookie: false, debounceMs: 100, ...opts });
  cleanups.push(() => m.stop());
  return m;
}

interface Client {
  doc: Y.Doc;
  provider: HocuspocusProvider;
  messages: Array<Record<string, string>>;
  closed: () => boolean;
}
async function client(m: CollabMock, name = "lesson:G6.U4.L4", wait = true): Promise<Client> {
  const doc = new Y.Doc();
  const messages: Client["messages"] = [];
  let closed = false;
  const provider = new HocuspocusProvider({
    url: m.url,
    name,
    document: doc,
    onStateless: ({ payload }) => messages.push(JSON.parse(payload)),
    onClose: () => {
      closed = true;
    },
  });
  cleanups.push(() => provider.destroy());
  if (wait) await until(() => provider.isSynced);
  return { doc, provider, messages, closed: () => closed };
}

async function until(fn: () => boolean, ms = 3000) {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 20));
  }
}

const post = (m: CollabMock, p: string) => fetch(`http://localhost:${m.port}${p}`, { method: "POST" });

describe("collab mock", () => {
  it("syncs an edit between two clients", async () => {
    const m = await mock();
    const a = await client(m);
    const b = await client(m);
    a.doc.getText("t").insert(0, "hello");
    await until(() => b.doc.getText("t").toString() === "hello");
  });

  it("sends stored within 2 s of the last edit", async () => {
    const m = await mock();
    const a = await client(m);
    const t0 = Date.now();
    a.doc.getText("t").insert(0, "x");
    await until(() => a.messages.some((x) => x.type === "stored"));
    expect(Date.now() - t0).toBeLessThan(2000);
    const stored = a.messages.find((x) => x.type === "stored") as Record<string, string>;
    expect(stored.content_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored.state_vector!.length).toBeGreaterThan(0);
    expect(Number.isNaN(Date.parse(stored.stored_at!))).toBe(false);
  });

  it("lock sends mode read_only and refuses further edits", async () => {
    const m = await mock();
    const a = await client(m);
    const b = await client(m);
    a.doc.getText("t").insert(0, "one");
    await until(() => b.doc.getText("t").toString() === "one");
    await post(m, "/__mock/lock?doc=lesson:G6.U4.L4");
    await until(() => a.messages.some((x) => x.type === "mode") && b.messages.some((x) => x.type === "mode"));
    expect(a.messages.find((x) => x.type === "mode")).toMatchObject({ mode: "read_only", state: "submitted" });
    a.doc.getText("t").insert(3, "-two");
    await until(() => a.messages.some((x) => x.type === "refused"));
    const refused = a.messages.find((x) => x.type === "refused")!;
    expect(refused).toMatchObject({ code: "LESSON_LOCKED" });
    expect(refused.message).toBeTruthy();
    expect(refused.refused_from).toBeTruthy();
    await new Promise((r) => setTimeout(r, 300));
    expect(b.doc.getText("t").toString()).toBe("one");
  });

  it("drop closes the sockets", async () => {
    const m = await mock();
    const a = await client(m);
    await post(m, "/__mock/drop");
    await until(() => a.closed());
  });

  it("refuses a connection without the session cookie", async () => {
    const m = await mock({ requireCookie: true });
    const a = await client(m, "lesson:G6.U4.L4", false);
    await new Promise((r) => setTimeout(r, 800));
    expect(a.provider.isSynced).toBe(false);
  });
});
