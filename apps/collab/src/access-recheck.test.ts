// GEN-6 frozen tests (risk::security): S-29 role/lesson-state recheck on open sockets. Unit level, fakes only, no database.
// Written before the implementation: SessionRecheck has no `current_access` yet, so these fail for that reason.
import { describe, expect, it, vi } from "vitest";
import type { RoleName, LessonStateName } from "@ls/core/ports/common";
import { FAILURES_BEFORE_CLOSE, SESSION_ENDED_CODE, SessionRecheck, type LiveHashes } from "./session-recheck.ts";
import { capture_logger, clock, sha256, user } from "./nl-80.fixtures.ts";
import type { SocketContext } from "./permissions.ts";

type Access = { roles: Map<string, RoleName>; states: Map<string, LessonStateName> };
type AccessFn = (user_ids: string[], lesson_ids: string[]) => Promise<Access>;

const mk_ctx = (token: string, role: RoleName, lesson: string, state: LessonStateName, read_only: boolean, id = `u-${role}-1`): SocketContext =>
  ({ socket_id: `s-${token}`, user: user(role, id), lesson_id: lesson, lesson_state: state, read_only, session_hash: sha256(token) }) as unknown as SocketContext;
const target = (ctx: SocketContext | undefined) => ({ ctx, close: vi.fn(), downgrade: vi.fn() });
const access = (roles: Record<string, RoleName>, states: Record<string, LessonStateName>): AccessFn =>
  async () => ({ roles: new Map(Object.entries(roles)), states: new Map(Object.entries(states)) });
const live_all: LiveHashes = async (hs) => new Set(hs);
const make = (access_fn?: AccessFn, live: LiveHashes = live_all) => {
  const cap = capture_logger();
  // The 4th constructor argument is the new optional access lookup (frozen contract of GEN-6).
  const Ctor = SessionRecheck as unknown as new (l: LiveHashes, c: ReturnType<typeof clock>, lg: typeof cap.logger, a?: AccessFn) => SessionRecheck;
  return { r: new Ctor(live, clock(), cap.logger, access_fn), cap };
};

describe("access_recheck: downgrade (S-29)", () => {
  it("T-1 a demoted reviewer is downgraded to read-only, not closed, and the socket's role is refreshed", async () => {
    const c = mk_ctx("a", "reviewer", "L1", "in_review", false, "u-1");
    const t = target(c);
    const { r, cap } = make(access({ "u-1": "author" }, { L1: "in_review" }));
    expect(await r.sweep([t])).toBe(0);
    expect(t.downgrade).toHaveBeenCalledOnce();
    expect(t.downgrade).toHaveBeenCalledWith({ role: "author", state: "in_review", reason: "role" });
    expect(t.close).not.toHaveBeenCalled();
    expect(c.read_only).toBe(true);
    expect(c.user.role).toBe("author");
    const logs = cap.lines.join("\n");
    expect(logs).toContain("collab.role_downgraded");
    expect(logs).not.toContain("demo@example.org");
    expect(logs).not.toContain("Synthetic");
    expect(logs).not.toContain(sha256("a"));
  });

  it("T-2 an approver whose context is somehow writable is downgraded too: the test is 'editable now', not 'was reviewer'", async () => {
    const c = mk_ctx("a", "approver", "L1", "in_review", false, "u-2");
    const t = target(c);
    const { r } = make(access({ "u-2": "author" }, { L1: "in_review" }));
    await r.sweep([t]);
    expect(t.downgrade).toHaveBeenCalledOnce();
    expect(c.read_only).toBe(true);
    expect(t.close).not.toHaveBeenCalled();
  });

  it("T-3 a user whose row is gone is closed with the session-ended path, not downgraded", async () => {
    const c = mk_ctx("a", "reviewer", "L1", "in_review", false, "u-gone");
    const t = target(c);
    const { r, cap } = make(access({}, { L1: "in_review" }));
    expect(await r.sweep([t])).toBe(1);
    expect(t.close).toHaveBeenCalledOnce();
    expect(t.downgrade).not.toHaveBeenCalled();
    expect(cap.lines.join("\n")).toContain("user_removed");
    expect(SESSION_ENDED_CODE).toBe(4401);
  });

  it("T-4 a locked lesson state downgrades even with the reviewer role (the set_mode never arrived)", async () => {
    const c = mk_ctx("a", "reviewer", "L1", "in_review", false, "u-1");
    const t = target(c);
    const { r } = make(access({ "u-1": "reviewer" }, { L1: "submitted" }));
    await r.sweep([t]);
    expect(t.downgrade).toHaveBeenCalledWith({ role: "reviewer", state: "submitted", reason: "state" });
    expect(c.lesson_state).toBe("submitted");
    expect(c.read_only).toBe(true);
    expect(t.close).not.toHaveBeenCalled();
  });

  it("T-5 a missing lesson row is treated as not editable: downgrade, not close", async () => {
    const c = mk_ctx("a", "reviewer", "L-missing", "in_review", false, "u-1");
    const t = target(c);
    const { r } = make(access({ "u-1": "reviewer" }, {}));
    await r.sweep([t]);
    expect(t.downgrade).toHaveBeenCalledOnce();
    expect(t.close).not.toHaveBeenCalled();
    expect(c.read_only).toBe(true);
  });

  it("T-6 an unchanged reviewer on an in_review lesson is left alone", async () => {
    const c = mk_ctx("a", "reviewer", "L1", "in_review", false, "u-1");
    const t = target(c);
    const { r } = make(access({ "u-1": "reviewer" }, { L1: "in_review" }));
    expect(await r.sweep([t])).toBe(0);
    expect(t.downgrade).not.toHaveBeenCalled();
    expect(t.close).not.toHaveBeenCalled();
    expect(c.read_only).toBe(false);
  });

  it("T-7 [negative] a raised role never upgrades a read-only socket in the recheck, but the role is refreshed", async () => {
    const c = mk_ctx("a", "author", "L1", "in_review", true, "u-1");
    const t = target(c);
    const { r } = make(access({ "u-1": "reviewer" }, { L1: "in_review" }));
    await r.sweep([t]);
    expect(c.read_only).toBe(true);
    expect(t.downgrade).not.toHaveBeenCalled();
    expect(t.close).not.toHaveBeenCalled();
    expect(c.user.role).toBe("reviewer");
  });

  it("T-8 an already read-only socket is not messaged or logged again on later sweeps", async () => {
    const c = mk_ctx("a", "author", "L1", "in_review", true, "u-1");
    const t = target(c);
    const { r, cap } = make(access({ "u-1": "author" }, { L1: "in_review" }));
    for (let i = 0; i < 3; i++) await r.sweep([t]);
    expect(t.downgrade).not.toHaveBeenCalled();
    expect(t.close).not.toHaveBeenCalled();
    expect(cap.lines.join("\n")).not.toContain("collab.role_downgraded");
  });

  it("T-8b a downgraded socket is not downgraded a second time on the next sweep", async () => {
    const c = mk_ctx("a", "reviewer", "L1", "in_review", false, "u-1");
    const t = target(c);
    const { r } = make(access({ "u-1": "author" }, { L1: "in_review" }));
    await r.sweep([t]);
    await r.sweep([t]);
    await r.sweep([t]);
    expect(t.downgrade).toHaveBeenCalledOnce();
  });
});

describe("access_recheck: cost and failure policy", () => {
  it("T-9 the access lookup is one batched call per sweep with distinct ids; the session lookup is still one call", async () => {
    const calls: Array<{ users: string[]; lessons: string[] }> = [];
    const fn: AccessFn = async (u, l) => {
      calls.push({ users: [...u], lessons: [...l] });
      return { roles: new Map(u.map((x) => [x, "reviewer" as RoleName])), states: new Map(l.map((x) => [x, "in_review" as LessonStateName])) };
    };
    let session_calls = 0;
    const live: LiveHashes = async (hs) => (session_calls++, new Set(hs));
    const targets = [
      target(mk_ctx("t1", "reviewer", "L1", "in_review", false, "u-A")),
      target(mk_ctx("t2", "reviewer", "L2", "in_review", false, "u-A")),
      target(mk_ctx("t3", "reviewer", "L3", "in_review", false, "u-B")),
      target(mk_ctx("t4", "reviewer", "L1", "in_review", false, "u-B")),
      target(mk_ctx("t5", "reviewer", "L3", "in_review", false, "u-A")),
      target(undefined),
    ];
    const { r } = make(fn, live);
    await r.sweep(targets);
    expect(session_calls).toBe(1);
    expect(calls).toHaveLength(1);
    expect([...new Set(calls[0]!.users)].sort()).toEqual(["u-A", "u-B"]);
    expect(calls[0]!.users).toHaveLength(2);
    expect([...new Set(calls[0]!.lessons)].sort()).toEqual(["L1", "L2", "L3"]);
    expect(calls[0]!.lessons).toHaveLength(3);
  });

  it("T-10 [negative] an access lookup that fails leaves sockets alone twice and fails closed on the third, writable sockets only", async () => {
    let fail = true;
    const ok = access({ "u-1": "reviewer", "u-2": "reviewer" }, { L1: "in_review" });
    const fn: AccessFn = async (u, l) => {
      if (fail) throw new Error("db down");
      return ok(u, l);
    };
    const { r, cap } = make(fn);
    const writable = target(mk_ctx("w", "reviewer", "L1", "in_review", false, "u-1"));
    const readonly = target(mk_ctx("r", "author", "L1", "in_review", true, "u-2"));
    const ts = [writable, readonly];
    for (let i = 1; i < FAILURES_BEFORE_CLOSE; i++) expect(await r.sweep(ts)).toBe(0);
    expect(writable.close).not.toHaveBeenCalled();
    expect(writable.downgrade).not.toHaveBeenCalled();
    expect(cap.lines.join("\n")).toContain("collab.access_recheck_failed");
    // success resets the count
    fail = false;
    expect(await r.sweep(ts)).toBe(0);
    fail = true;
    for (let i = 1; i < FAILURES_BEFORE_CLOSE; i++) await r.sweep(ts);
    expect(writable.close).not.toHaveBeenCalled();
    expect(await r.sweep(ts)).toBe(1);
    expect(writable.close).toHaveBeenCalledOnce();
    expect(readonly.close).not.toHaveBeenCalled();
    expect(cap.lines.join("\n")).toContain("unverified_access");
  });

  it("T-10b the session counter and the access counter are independent: a failing access lookup is not reset by healthy sessions", async () => {
    const { r } = make(async () => { throw new Error("access down"); });
    const w = target(mk_ctx("w", "reviewer", "L1", "in_review", false, "u-1"));
    await r.sweep([w]);
    await r.sweep([w]);
    expect(w.close).not.toHaveBeenCalled();
    await r.sweep([w]); // session lookup succeeded all three times, yet access failed three times in a row
    expect(w.close).toHaveBeenCalledOnce();
  });

  it("T-10c three session-lookup failures still close everything, as in S-9, even though the access lookup is healthy", async () => {
    let n = 0;
    const live: LiveHashes = async () => { n++; throw new Error("sessions down"); };
    const { r } = make(access({ "u-1": "reviewer" }, { L1: "in_review" }), live);
    const w = target(mk_ctx("w", "reviewer", "L1", "in_review", false, "u-1"));
    for (let i = 1; i < FAILURES_BEFORE_CLOSE; i++) expect(await r.sweep([w])).toBe(0);
    expect(await r.sweep([w])).toBe(1);
    expect(n).toBe(FAILURES_BEFORE_CLOSE);
    expect(w.close).toHaveBeenCalledOnce();
  });

  it("T-11 [negative] a downgrade that throws falls back to closing that socket; a close that throws does not stop the others", async () => {
    const bad = target(mk_ctx("a", "reviewer", "L1", "in_review", false, "u-1"));
    bad.downgrade.mockImplementation(() => { throw new Error("boom"); });
    const other = target(mk_ctx("b", "reviewer", "L1", "in_review", false, "u-2"));
    const { r } = make(access({ "u-1": "author", "u-2": "author" }, { L1: "in_review" }));
    await r.sweep([bad, other]);
    expect(bad.close).toHaveBeenCalledOnce();
    expect(other.downgrade).toHaveBeenCalledOnce();

    const bad_close = target(mk_ctx("c", "reviewer", "L1", "in_review", false, "u-gone-1"));
    bad_close.close.mockImplementation(() => { throw new Error("boom"); });
    const next = target(mk_ctx("d", "reviewer", "L1", "in_review", false, "u-gone-2"));
    const { r: r2 } = make(access({}, { L1: "in_review" }));
    expect(await r2.sweep([bad_close, next])).toBe(1);
    expect(next.close).toHaveBeenCalledOnce();
  });

  it("T-11b a target without a downgrade function is closed (fail closed)", async () => {
    const c = mk_ctx("a", "reviewer", "L1", "in_review", false, "u-1");
    const close = vi.fn();
    const { r } = make(access({ "u-1": "author" }, { L1: "in_review" }));
    await r.sweep([{ ctx: c, close }]);
    expect(close).toHaveBeenCalledOnce();
  });

  it("T-12 a socket whose session is dead is closed once and never passed to the access lookup", async () => {
    const seen: string[][] = [];
    const fn: AccessFn = async (u, l) => (seen.push(u), access({ "u-live": "reviewer" }, { L1: "in_review" })(u, l));
    const live: LiveHashes = async (hs) => new Set(hs.filter((h) => h === sha256("live")));
    const dead = target(mk_ctx("dead", "reviewer", "L1", "in_review", false, "u-dead"));
    const alive = target(mk_ctx("live", "reviewer", "L1", "in_review", false, "u-live"));
    const { r } = make(fn, live);
    expect(await r.sweep([dead, alive])).toBe(1);
    expect(dead.close).toHaveBeenCalledOnce();
    expect(dead.downgrade).not.toHaveBeenCalled();
    expect(seen.flat()).not.toContain("u-dead");
    expect(seen.flat()).toContain("u-live");
  });

  it("T-12b when no socket has a live session the access lookup is not called at all", async () => {
    const fn = vi.fn(access({}, {}));
    const { r } = make(fn, async () => new Set());
    await r.sweep([target(mk_ctx("a", "reviewer", "L1", "in_review", false, "u-1"))]);
    expect(fn).not.toHaveBeenCalled();
  });

  it("T-13 without current_access the sweep is the S-9 sweep: no downgrade, ever", async () => {
    const cap = capture_logger();
    const r = new SessionRecheck(live_all, clock(), cap.logger);
    const t = target(mk_ctx("a", "author", "L1", "submitted", false, "u-1"));
    expect(await r.sweep([t])).toBe(0);
    expect(t.downgrade).not.toHaveBeenCalled();
    expect(t.close).not.toHaveBeenCalled();
  });
});
