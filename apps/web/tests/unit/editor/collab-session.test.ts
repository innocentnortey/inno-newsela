// @vitest-environment node
import { HocuspocusProvider } from "@hocuspocus/provider";
import { afterEach, describe, expect, it } from "vitest";
import * as Y from "yjs";
import { CollabSession } from "@/editor/collab-session";
import { parse_collab_message } from "@/editor/messages";
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
function session(m: CollabMock, lesson_id: string, name = "M. Okafor", read_only = false) {
  const s = new CollabSession({ url: m.url, lesson_id, user: { user_id: name, name, initials: "MO", slot: 1 }, read_only });
  cleanups.push(() => s.destroy());
  return s;
}
async function until(fn: () => boolean, ms = 5000) {
  const t0 = Date.now();
  while (!fn()) {
    if (Date.now() - t0 > ms) throw new Error("timeout");
    await new Promise((r) => setTimeout(r, 20));
  }
}
const post = (m: CollabMock, p: string) => fetch(`http://localhost:${m.port}${p}`, { method: "POST" });
const text = (s: CollabSession) => s.doc.getText("t").toString();

describe("CollabSession", () => {
  it("connects, syncs and reports stored after an edit", async () => {
    const m = await mock();
    const a = session(m, "L1");
    const b = session(m, "L1", "J. Rivera");
    await until(() => a.snapshot().state === "synced" && b.snapshot().state === "synced");
    a.doc.getText("t").insert(0, "hi");
    expect(a.snapshot().state).toBe("saving");
    await until(() => text(b) === "hi");
    await until(() => a.snapshot().state === "stored");
    expect(Number.isNaN(Date.parse(a.snapshot().stored!.stored_at))).toBe(false);
  });

  it("reconnect: held edits reach the other session and state returns to stored", async () => {
    const m = await mock();
    const a = session(m, "L2");
    const b = session(m, "L2", "J. Rivera");
    await until(() => a.snapshot().state === "synced" && b.snapshot().state === "synced");
    const seen: string[] = [];
    a.subscribe(() => seen.push(a.snapshot().state));
    await post(m, "/__mock/drop");
    await until(() => a.snapshot().state === "DISCONNECTED");
    a.doc.getText("t").insert(0, "offline");
    await until(() => text(b) === "offline", 15000);
    await until(() => a.snapshot().state === "stored", 15000);
    expect(seen).toContain("DISCONNECTED");
  }, 40000);

  it("refused: lock then a raw provider write is answered with a refused message of the CON-12 shape", async () => {
    const m = await mock();
    const doc = new Y.Doc();
    const got: string[] = [];
    const p = new HocuspocusProvider({ url: m.url, name: "lesson:L3", document: doc, onStateless: ({ payload }) => got.push(payload) });
    cleanups.push(() => p.destroy());
    await until(() => p.isSynced);
    await post(m, "/__mock/lock");
    doc.getText("t").insert(0, "x");
    await until(() => got.some((g) => parse_collab_message(g)?.type === "refused"));
    const r = got.map((g) => parse_collab_message(g)).find((x) => x?.type === "refused");
    expect(r).toMatchObject({ type: "refused", code: "LESSON_LOCKED" });
    expect(typeof (r as { refused_from: string }).refused_from).toBe("string");
  });

  it("refused edits are never re-sent (the session swaps to a fresh doc)", async () => {
    const m = await mock();
    const a = session(m, "L5");
    const b = session(m, "L5", "J. Rivera");
    await until(() => a.snapshot().state === "synced" && b.snapshot().state === "synced");
    // hold the mode message back by locking only after A believes it is editable: lock, then type immediately
    await post(m, "/__mock/lock");
    a.doc.getText("t").insert(0, "late");
    await until(() => a.snapshot().read_only);
    await new Promise((r) => setTimeout(r, 1500));
    expect(text(b)).toBe("");
    expect(text(a)).toBe("");
  }, 20000);

  it("unauth: a refused socket reports signed_out and no sections", async () => {
    const m = await mock({ requireCookie: true });
    const s = session(m, "L4");
    await until(() => s.snapshot().signed_out, 3000);
    expect(s.doc.getArray("section_order").length).toBe(0);
  });

  it("read-only: a mode read_only message makes the session read_only", async () => {
    const m = await mock();
    const s = session(m, "L6");
    await until(() => s.snapshot().state === "synced");
    await post(m, "/__mock/lock");
    await until(() => s.snapshot().read_only);
    expect(s.snapshot().mode_state).toBe("submitted");
    expect(s.snapshot().state).toBe("read_only");
  });

  it("late text after read-only lands after the refused text", async () => {
    const m = await mock();
    const s = session(m, "L7");
    await until(() => s.snapshot().state === "synced");
    await post(m, "/__mock/lock");
    await until(() => s.snapshot().read_only);
    s.add_late_text("06 ");
    s.doc.getText("t").insert(0, "b");
    await until(() => (s.snapshot().refusal?.text.length ?? 0) > 1, 5000);
    expect(s.snapshot().refusal?.text.join("")).toBe("b06 ");
  }, 20000);

  it("late text with no refusal still shows a notice", async () => {
    const m = await mock();
    const s = session(m, "L8");
    await until(() => s.snapshot().state === "synced");
    await post(m, "/__mock/lock");
    await until(() => s.snapshot().read_only);
    s.add_late_text("x");
    expect(s.snapshot().refusal).toEqual({ message: "Your last edits were not saved.", text: ["x"], dropped: 0 });
  }, 20000);
});
