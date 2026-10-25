import { describe, expect, it } from "vitest";
import type { Clock } from "@ls/core/ports/clock";
import type { Logger, LogFields } from "@ls/obs/logger";
import type { CheckRunReport } from "./check-job-runner.ts";
import { CheckLane, type CheckRunnerPort, type LaneStop } from "./check-lane.ts";

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i += 1) await Promise.resolve();
};

class ManualClock implements Clock {
  sleeps: { ms: number; wake: () => void }[] = [];
  now(): Date {
    return new Date(0);
  }
  sleep(ms: number): Promise<void> {
    return new Promise((wake) => this.sleeps.push({ ms, wake }));
  }
  wake_all(): void {
    const s = this.sleeps;
    this.sleeps = [];
    for (const x of s) x.wake();
  }
}
class Stop implements LaneStop {
  set = false;
  is_set(): boolean {
    return this.set;
  }
}
const report: CheckRunReport = {
  lesson_id: "G6.U4.L4" as never, content_hash: "h" as never, blocking: 0, confirmation: 0,
  advisory: 0, dependants_requeued: 0, duration_ms: 1,
};
function logger() {
  const lines: { event: string; fields: LogFields }[] = [];
  const l: Logger = {
    info: (event, fields) => lines.push({ event, fields }),
    warn: (event, fields) => lines.push({ event, fields }),
    error: (event, fields) => lines.push({ event, fields }),
  };
  return { l, lines };
}

describe("CheckLane", () => {
  it("polls_every_check_poll_ms", async () => {
    const clock = new ManualClock();
    const stop = new Stop();
    let calls = 0;
    const runner: CheckRunnerPort = { run_once: async () => { calls += 1; return null; } };
    const done = new CheckLane(runner, clock, logger().l, { check_poll_ms: 250 }).run_until(stop);
    await flush();
    expect(calls).toBe(1);
    expect(clock.sleeps.map((s) => s.ms)).toEqual([250]);
    clock.wake_all();
    await flush();
    expect(calls).toBe(2);
    expect(clock.sleeps.map((s) => s.ms)).toEqual([250]);
    stop.set = true;
    clock.wake_all();
    expect(await done).toEqual({ checked: 0 });
  });

  it("backlog_drains_without_sleep", async () => {
    const clock = new ManualClock();
    const stop = new Stop();
    let left = 3;
    const runner: CheckRunnerPort = {
      run_once: async () => {
        if (left === 0) return null;
        left -= 1;
        return report;
      },
    };
    const done = new CheckLane(runner, clock, logger().l, { check_poll_ms: 500 }).run_until(stop);
    await flush();
    expect(left).toBe(0);
    expect(clock.sleeps).toHaveLength(1); // only after the queue ran dry
    stop.set = true;
    clock.wake_all();
    expect(await done).toEqual({ checked: 3 });
  });

  it("stops_after_check_in_hand_on_stop", async () => {
    const clock = new ManualClock();
    const stop = new Stop();
    let calls = 0;
    let finish!: () => void;
    const runner: CheckRunnerPort = {
      run_once: () => {
        calls += 1;
        return new Promise((res) => { finish = () => res(report); });
      },
    };
    let resolved = false;
    const done = new CheckLane(runner, clock, logger().l, { check_poll_ms: 500 })
      .run_until(stop)
      .then((r) => { resolved = true; return r; });
    await flush();
    stop.set = true;
    await flush();
    expect(resolved).toBe(false);
    finish();
    expect(await done).toEqual({ checked: 1 });
    expect(calls).toBe(1);
  });

  it("runner_throw_logs_name_only_and_continues", async () => {
    const clock = new ManualClock();
    const stop = new Stop();
    const { l, lines } = logger();
    let calls = 0;
    const runner: CheckRunnerPort = {
      run_once: async () => {
        calls += 1;
        if (calls === 1) throw new TypeError("secret lesson text CHECK-QZ-81");
        return report;
      },
    };
    const done = new CheckLane(runner, clock, l, { check_poll_ms: 100 }).run_until(stop);
    await flush();
    expect(clock.sleeps.map((s) => s.ms)).toEqual([100]);
    clock.wake_all();
    await flush();
    expect(calls).toBeGreaterThanOrEqual(2);
    stop.set = true;
    expect(await done).toMatchObject({ checked: calls - 1 });
    const err = lines.find((x) => x.event === "check_lane.failed");
    expect(err?.fields.extra).toEqual({ name: "TypeError" });
    expect(JSON.stringify(lines)).not.toContain("CHECK-QZ-81");
  });
});
