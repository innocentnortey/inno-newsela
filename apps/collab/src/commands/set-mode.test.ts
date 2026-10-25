// NL-105 frozen test: AC-11. No database: real FrozenDocs and AckBroadcaster over a fake connection registry.
import { describe, expect, it } from "vitest";
import { AckBroadcaster, type ConnectionRegistry, type SocketHandle } from "../acks.ts";
import { FrozenDocs } from "../frozen-docs.ts";
import { FakeStates, LESSON, user } from "../nl-80.fixtures.ts";
import { set_mode } from "./set-mode.ts";
import { CollabCommandHandler } from "./routes.ts";
import { mode_body } from "./nl-105.fixtures.ts";

class Socket implements SocketHandle {
  sent: any[] = [];
  read_only_calls: boolean[] = [];
  ctx: any;
  constructor(public socket_id: string, role: "author" | "reviewer" | "approver", public log: string[], public frozen: FrozenDocs) {
    this.ctx = { user: user(role), read_only: true, lesson_state: "submitted" };
  }
  context() { return this.ctx; }
  send_stateless(json: string): void {
    this.sent.push(JSON.parse(json));
    this.log.push(`broadcast(frozen=${this.frozen.is_frozen(LESSON)})`);
  }
  set_read_only(v: boolean): void { this.read_only_calls.push(v); }
}

function setup(state: any = "in_review", roles: ("author" | "reviewer" | "approver")[] = ["reviewer", "reviewer"]) {
  const log: string[] = [];
  const frozen = new FrozenDocs();
  frozen.freeze(LESSON);
  const sockets = roles.map((r, i) => new Socket(`s${i}`, r, log, frozen));
  const registry: ConnectionRegistry = { sockets_of: (id) => (id === LESSON ? sockets : []), find: (id) => sockets.find((s) => s.socket_id === id) };
  const states = new FakeStates(state);
  const deps = { states, frozen, acks: new AckBroadcaster(registry) } as never;
  return { deps, frozen, sockets, log, states };
}
const cmd = (over: Record<string, unknown> = {}) => mode_body(over) as never;

describe("idempotent_and_frozen_first [invariant, AC-11]", () => {
  it("editable after Withdraw unfreezes the lesson, lets the reviewer socket write again and keeps the author read-only", async () => {
    const s = setup("in_review", ["reviewer", "author"]);
    expect(s.frozen.is_frozen(LESSON)).toBe(true);
    const res = await set_mode(s.deps, cmd({ mode: "editable", state: "in_review" }));
    expect(res).toEqual({ lesson_id: LESSON, mode: "editable", connections_notified: 2 });
    expect(s.frozen.is_frozen(LESSON)).toBe(false);
    expect(s.sockets[0]!.read_only_calls.at(-1)).toBe(false);
    expect(s.sockets[1]!.read_only_calls.at(-1)).toBe(true);
    expect(s.sockets[0]!.sent[0]).toMatchObject({ type: "mode", mode: "editable", state: "in_review" });
  });

  it("read_only freezes the lesson and every socket becomes read-only", async () => {
    const s = setup("submitted");
    s.frozen.unfreeze(LESSON);
    const res = await set_mode(s.deps, cmd({ mode: "read_only", state: "submitted" }));
    expect(res.connections_notified).toBe(2);
    expect(s.frozen.is_frozen(LESSON)).toBe(true);
    expect(s.sockets.every((k) => k.read_only_calls.at(-1) === true)).toBe(true);
  });

  it("[invariant] FrozenDocs is updated before any broadcast: every message is sent when the new frozen flag is already set", async () => {
    const s = setup();
    await set_mode(s.deps, cmd({ mode: "editable", state: "in_review" }));
    expect(s.log).toEqual(["broadcast(frozen=false)", "broadcast(frozen=false)"]);
    s.log.length = 0;
    await set_mode(s.deps, cmd({ mode: "read_only", state: "submitted" }));
    expect(s.log).toEqual(["broadcast(frozen=true)", "broadcast(frozen=true)"]);
  });

  it("calling either mode twice returns the same ModeResult and leaves the same state", async () => {
    for (const mode of ["editable", "read_only"] as const) {
      const s = setup("in_review");
      const state = mode === "editable" ? "in_review" : "submitted";
      const a = await set_mode(s.deps, cmd({ mode, state }));
      const flag = s.frozen.is_frozen(LESSON);
      const b = await set_mode(s.deps, cmd({ mode, state }));
      expect(b).toEqual(a);
      expect(s.frozen.is_frozen(LESSON)).toBe(flag);
    }
  });

  it("connections_notified is zero when nobody is connected", async () => {
    const s = setup("in_review", []);
    expect((await set_mode(s.deps, cmd({ mode: "editable", state: "in_review" }))).connections_notified).toBe(0);
  });

  it("[boundary] an unknown lesson is refused NOT_FOUND and neither the frozen set nor any socket is touched", async () => {
    const s = setup();
    s.states.get = async () => null;
    const before = s.frozen.is_frozen(LESSON);
    await expect(set_mode(s.deps, cmd({ mode: "editable" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(s.frozen.is_frozen(LESSON)).toBe(before);
    expect(s.sockets.every((k) => k.sent.length === 0)).toBe(true);
  });

  it("the CollabCommandHandler class dispatches set_mode to the same behaviour", async () => {
    const s = setup();
    const handler = new CollabCommandHandler(s.deps as never);
    const res = await handler.set_mode(cmd({ mode: "editable", state: "in_review" }));
    expect(res).toMatchObject({ mode: "editable", connections_notified: 2 });
    expect(s.frozen.is_frozen(LESSON)).toBe(false);
  });
});
