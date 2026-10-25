import { describe, expect, it, vi } from "vitest";
import { SessionRecheck } from "./session-recheck.ts";
import { FakeSessions, capture_logger, clock, sha256 } from "./nl-80.fixtures.ts";
import type { SocketContext } from "./permissions.ts";

const ctx = (token: string): SocketContext =>
  ({ socket_id: "s", lesson_id: "L", read_only: false, session_hash: sha256(token) }) as unknown as SocketContext;
const user = { user_id: "u", role: "reviewer" } as never;

describe("session_recheck (S-9)", () => {
  it("closes sockets whose session no longer resolves, keeps live ones", async () => {
    const sessions = new FakeSessions();
    sessions.add("live", user);
    sessions.add("gone", user, "revoked" as never);
    const a = vi.fn(), b = vi.fn();
    const r = new SessionRecheck(sessions, clock(), capture_logger().logger);
    const n = await r.sweep([
      { ctx: ctx("live"), close: a },
      { ctx: ctx("gone"), close: b },
      { ctx: undefined, close: vi.fn() },
    ]);
    expect(n).toBe(1);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
  });

  it("[negative] a lookup error does not close the socket", async () => {
    const sessions = new FakeSessions();
    sessions.resolve = async () => { throw new Error("db down"); };
    const a = vi.fn();
    const n = await new SessionRecheck(sessions, clock(), capture_logger().logger).sweep([{ ctx: ctx("x"), close: a }]);
    expect(n).toBe(0);
    expect(a).not.toHaveBeenCalled();
  });
});
