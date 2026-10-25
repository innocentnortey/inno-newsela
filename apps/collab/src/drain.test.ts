import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { create_logger } from "@ls/obs/logger";
import { create_inflight_tracker, DrainingError, install_drain, type SignalHost } from "./drain.ts";

function fake_host() {
  const handlers = new Map<string, () => void>();
  const host: SignalHost = { on: (s, fn) => void handlers.set(s, fn) };
  return { host, emit: (s: string) => handlers.get(s)?.() };
}
const logger = create_logger({ service: "t", build_id: "b", write: () => {} });

describe("drain", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits for in-flight handler", async () => {
    const tracker = create_inflight_tracker();
    const { host, emit } = fake_host();
    const exit = vi.fn();
    install_drain({ tracker, close: async () => {}, exit, logger, host });
    let release!: () => void;
    const work = tracker.track(() => new Promise<void>((r) => (release = r)));
    emit("SIGTERM");
    await vi.advanceTimersByTimeAsync(100);
    expect(exit).not.toHaveBeenCalled();
    release();
    await work;
    await vi.advanceTimersByTimeAsync(10);
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it("second signal exits 1 immediately", async () => {
    const tracker = create_inflight_tracker();
    const { host, emit } = fake_host();
    const exit = vi.fn();
    install_drain({ tracker, close: async () => {}, exit, logger, host });
    void tracker.track(() => new Promise<void>(() => {}));
    emit("SIGTERM");
    emit("SIGINT");
    expect(exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it("rejects new work after first signal", async () => {
    const tracker = create_inflight_tracker();
    const { host, emit } = fake_host();
    install_drain({ tracker, close: async () => {}, exit: vi.fn(), logger, host });
    emit("SIGTERM");
    await expect(tracker.track(async () => 1)).rejects.toBeInstanceOf(DrainingError);
  });

  it("grace expiry still exits 0", async () => {
    const tracker = create_inflight_tracker();
    const { host, emit } = fake_host();
    const exit = vi.fn();
    install_drain({ tracker, close: async () => {}, exit, logger, host, grace_ms: 1000 });
    void tracker.track(() => new Promise<void>(() => {}));
    emit("SIGTERM");
    await vi.advanceTimersByTimeAsync(1001);
    expect(exit).toHaveBeenCalledExactlyOnceWith(0);
  });
});
