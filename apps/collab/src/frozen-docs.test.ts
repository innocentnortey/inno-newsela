// NL-80 frozen tests: AC-8. Failing tests written before the implementation.
import { describe, expect, it } from "vitest";
import { FrozenDocs } from "./frozen-docs.ts";
import { AckBroadcaster, type ConnectionRegistry, type SocketHandle } from "./acks.ts";
import type { SocketContext } from "./permissions.ts";
import { LESSON, user } from "./nl-80.fixtures.ts";
import type { LessonStateName, RoleName } from "@ls/core/ports/common";

function handle(role: RoleName, socket_id: string, read_only: boolean, state: LessonStateName = "submitted") {
  const ctx = { socket_id, user: user(role), lesson_id: LESSON, lesson_state: state, read_only } as SocketContext;
  const sent: string[] = [];
  const h: SocketHandle = {
    socket_id, context: () => ctx, send_stateless: (j) => void sent.push(j), set_read_only: (v) => void (ctx.read_only = v),
  };
  return { h, ctx, sent };
}

describe("seed_on_first_connection_and_mode_message [invariant, AC-8]", () => {
  it("seeds frozen unless the state is editable for a reviewer; second seed is a no-op", () => {
    for (const s of ["draft", "generation_failed", "submitted", "approved", "exported"] as const) {
      const f = new FrozenDocs();
      f.seed(`l-${s}`, s);
      expect(f.is_frozen(`l-${s}`), s).toBe(true);
    }
    for (const s of ["in_review", "changes_requested", "reopened"] as const) {
      const f = new FrozenDocs();
      f.seed(`l-${s}`, s);
      expect(f.is_frozen(`l-${s}`), s).toBe(false);
    }
    const f = new FrozenDocs();
    f.seed(LESSON, "in_review");
    f.seed(LESSON, "submitted");
    expect(f.is_frozen(LESSON)).toBe(false);
  });

  it("[boundary] an unseeded lesson fails closed (frozen); a freeze before the first connect wins over the seed", () => {
    const f = new FrozenDocs();
    expect(f.is_frozen("never-seen")).toBe(true);
    f.freeze(LESSON);
    f.seed(LESSON, "in_review");
    expect(f.is_frozen(LESSON)).toBe(true);
  });

  it("freeze then unfreeze toggles the flag", () => {
    const f = new FrozenDocs();
    f.seed(LESSON, "in_review");
    f.freeze(LESSON);
    expect(f.is_frozen(LESSON)).toBe(true);
    f.unfreeze(LESSON);
    expect(f.is_frozen(LESSON)).toBe(false);
  });

  it("after unfreeze, AckBroadcaster.mode(editable) re-opens the reviewer only and sends the exact CON-12 message", () => {
    const rev = handle("reviewer", "s-rev", true);
    const auth = handle("author", "s-auth", true);
    const reg: ConnectionRegistry = {
      sockets_of: () => [rev.h, auth.h],
      find: (id) => [rev.h, auth.h].find((x) => x.socket_id === id),
    };
    const acks = new AckBroadcaster(reg);
    const n = acks.mode(LESSON, { mode: "editable", state: "in_review" });
    expect(n).toBe(2);
    expect(rev.ctx.read_only).toBe(false);
    expect(rev.ctx.lesson_state).toBe("in_review");
    expect(auth.ctx.read_only).toBe(true);
    const expected = '{"type":"mode","mode":"editable","state":"in_review"}';
    expect(rev.sent).toEqual([expected]);
    expect(auth.sent).toEqual([expected]);
  });

  it("[invariant] a read_only mode message locks a writable reviewer socket", () => {
    const rev = handle("reviewer", "s-rev", false, "in_review");
    const acks = new AckBroadcaster({ sockets_of: () => [rev.h], find: () => rev.h });
    acks.mode(LESSON, { mode: "read_only", state: "submitted" });
    expect(rev.ctx.read_only).toBe(true);
    expect(rev.sent).toEqual(['{"type":"mode","mode":"read_only","state":"submitted"}']);
  });

  it("stored and refused messages have the CON-12 shape and refused goes to one socket only", () => {
    const a = handle("reviewer", "s-a", false, "in_review");
    const b = handle("reviewer", "s-b", false, "in_review");
    const acks = new AckBroadcaster({ sockets_of: () => [a.h, b.h], find: (id) => [a.h, b.h].find((x) => x.socket_id === id) });
    const at = new Date("2026-10-25T12:00:00.000Z");
    const n = acks.stored(LESSON, { lesson_id: LESSON, store_id: "st_1", seq: 2, content_hash: "h1", state_vector: "sv1", stored_at: at,
      stored_by: null, check_job_enqueued: true } as never);
    expect(n).toBe(2);
    const expected = JSON.stringify({ type: "stored", content_hash: "h1", state_vector: "sv1", stored_at: at.toISOString() });
    expect(a.sent).toEqual([expected]);
    expect(b.sent).toEqual([expected]);
    acks.refused("s-a", "LESSON_LOCKED", "locked", "svb64");
    expect(JSON.parse(a.sent[1] as string)).toEqual({ type: "refused", code: "LESSON_LOCKED", message: "locked", refused_from: "svb64" });
    expect(b.sent).toHaveLength(1);
  });
});
