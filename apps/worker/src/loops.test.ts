// RT-1 AC-1, AC-2, AC-4 (drain closes db). Fakes only.
import { describe, expect, it, vi } from "vitest";
import { load_worker_settings } from "@ls/config/settings";
import { create_logger } from "@ls/obs/logger";
import { create_inflight_tracker } from "./drain.ts";
import { start_worker_loops } from "./loops.ts";
import { build_worker_runtime } from "./main.ts";

const ENV = { DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" };

function setup(run_claim: (stop: { is_set(): boolean }) => Promise<unknown>, run_lane: (stop: { is_set(): boolean }) => Promise<unknown>) {
  const order: string[] = [];
  const tracker = create_inflight_tracker();
  const exit = vi.fn();
  const h = {
    tracker, exit, settings: load_worker_settings(ENV),
    logger: create_logger({ service: "worker", build_id: "t", level: "info", write: () => undefined }),
    generation: { claim_loop: { start: async () => (order.push("start"), {}), run_until: (s: { is_set(): boolean }) => (order.push("claim"), run_claim(s)) }, paid: {} },
    checks: { check_lane: { run_until: (s: { is_set(): boolean }) => (order.push("lane"), run_lane(s)) } },
  };
  return { h: h as never, order, tracker, exit };
}
const poll = async (stop: { is_set(): boolean }, ms = 5) => { while (!stop.is_set()) await new Promise((r) => setTimeout(r, ms)); };

describe("start_worker_loops", () => {
  it("starts_both_loops_after_requeue_pass (AC-1)", async () => {
    const { h, order, tracker } = setup(async (s) => (await poll(s), { reason: "sigterm" }), async (s) => (await poll(s), { checked: 0 }));
    start_worker_loops(h);
    await new Promise((r) => setTimeout(r, 20));
    expect(order[0]).toBe("start"); // orphan cleanup before any claim
    expect(order).toContain("claim");
    expect(order).toContain("lane");
    expect(tracker.in_flight).toBe(2);
    await tracker.begin_drain();
  });

  it("drain_waits_for_in_flight_then_exits_zero (AC-2)", async () => {
    let finish_job!: () => void;
    const job = new Promise<void>((r) => (finish_job = r));
    const { h, tracker, exit } = setup(async (s) => (await poll(s), await job, { reason: "sigterm" }), async (s) => (await poll(s), { checked: 0 }));
    const { done } = start_worker_loops(h);
    await new Promise((r) => setTimeout(r, 10));
    let drained = false;
    const d = tracker.begin_drain().then(() => (drained = true));
    await new Promise((r) => setTimeout(r, 30));
    expect(drained).toBe(false); // claim loop still finishing its in-flight job
    finish_job();
    await d;
    await done;
    expect(exit).not.toHaveBeenCalled();
  });

  it("start_after_drain_is_not_an_error (boundary)", async () => {
    const { h, tracker, exit, order } = setup(async () => ({ reason: "sigterm" }), async () => ({ checked: 0 }));
    await tracker.begin_drain();
    await start_worker_loops(h).done;
    expect(exit).not.toHaveBeenCalled();
    expect(order).toEqual([]);
  });
});

describe("worker runtime drain", () => {
  it("drain_closes_db (AC-4)", async () => {
    const codes: number[] = [];
    let handler: (() => void) | undefined;
    const rt = await build_worker_runtime(load_worker_settings(ENV), {
      health_port: 0, health_db: { ping: async () => true, with_tx: async () => { throw new Error("unused"); } } as never,
      log_write: () => undefined, exit: (c) => void codes.push(c),
      signal_host: { on: (sig, fn) => (sig === "SIGTERM" && (handler = fn), undefined), off: () => undefined },
    });
    const close = vi.spyOn(rt.deps.db as unknown as { close(): Promise<void> }, "close");
    void handler;
    await rt.stop();
    expect(close).toHaveBeenCalledTimes(1);
    expect(codes).toEqual([0]);
  });
});
