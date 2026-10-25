import { describe, expect, it, vi } from "vitest";
import { FAILURES_BEFORE_CLOSE, SessionRecheck, type LiveHashes } from "./session-recheck.ts";
import { capture_logger, clock, sha256 } from "./nl-80.fixtures.ts";
import type { SocketContext } from "./permissions.ts";

const ctx = (token: string): SocketContext =>
  ({ socket_id: "s", lesson_id: "L", read_only: false, session_hash: sha256(token) }) as unknown as SocketContext;
const only = (...tokens: string[]): LiveHashes => async (hs) => new Set(hs.filter((h) => tokens.some((t) => sha256(t) === h)));
const make = (l: LiveHashes) => new SessionRecheck(l, clock(), capture_logger().logger);

describe("session_recheck (S-9)", () => {
  it("closes sockets whose session is not live, keeps live ones, asks once for all distinct hashes", async () => {
    const calls: string[][] = [];
    const live: LiveHashes = async (hs, n) => (calls.push(hs), only("live")(hs, n));
    const a = vi.fn(), b = vi.fn(), c = vi.fn();
    const n = await make(live).sweep([
      { ctx: ctx("live"), close: a },
      { ctx: ctx("gone"), close: b },
      { ctx: ctx("gone"), close: c },
      { ctx: undefined, close: vi.fn() },
    ]);
    expect(n).toBe(2);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveLength(2);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledOnce();
    expect(c).toHaveBeenCalledOnce();
  });

  it("[negative] lookup errors: sockets stay open until the third consecutive failure, then all close; success resets", async () => {
    let fail = true;
    const live: LiveHashes = async (hs, n) => {
      if (fail) throw new Error("db down");
      return only("x")(hs, n);
    };
    const r = make(live);
    const close = vi.fn();
    const t = [{ ctx: ctx("x"), close }];
    for (let i = 1; i < FAILURES_BEFORE_CLOSE; i++) expect(await r.sweep(t)).toBe(0);
    expect(close).not.toHaveBeenCalled();
    fail = false;
    expect(await r.sweep(t)).toBe(0); // success resets the count
    fail = true;
    for (let i = 1; i < FAILURES_BEFORE_CLOSE; i++) await r.sweep(t);
    expect(close).not.toHaveBeenCalled();
    expect(await r.sweep(t)).toBe(1);
    expect(close).toHaveBeenCalledOnce();
  });

  it("[negative] a close() that throws does not stop the others or the sweep", async () => {
    const bad = vi.fn(() => { throw new Error("boom"); });
    const ok = vi.fn();
    const n = await make(only()).sweep([{ ctx: ctx("a"), close: bad }, { ctx: ctx("b"), close: ok }]);
    expect(n).toBe(1);
    expect(ok).toHaveBeenCalledOnce();
  });

  it("[negative] tick never throws when listing connections throws, and works again next tick", async () => {
    const r = make(only());
    await expect(r.tick(() => { throw new Error("getConnections"); })).resolves.toBe(true);
    const close = vi.fn();
    await r.tick(() => [{ ctx: ctx("a"), close }]);
    expect(close).toHaveBeenCalledOnce();
  });

  it("[boundary] a sweep slower than the interval is not overlapped", async () => {
    let release: () => void = () => {};
    let calls = 0;
    const live: LiveHashes = () => (calls++, new Promise((res) => (release = () => res(new Set()))));
    const r = make(live);
    const t = [{ ctx: ctx("a"), close: vi.fn() }];
    const first = r.tick(() => t);
    expect(await r.tick(() => t)).toBe(false); // skipped while the first is in flight
    expect(calls).toBe(1);
    release();
    await first;
    const second = r.tick(() => t);
    release();
    expect(await second).toBe(true);
    expect(calls).toBe(2);
  });
});
