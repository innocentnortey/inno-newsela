// Graceful drain for the collab entry point (NL-07). Duplicated per app on purpose: apps may not import each other.
import type { Logger } from "@ls/obs/logger";

export const DRAIN_GRACE_MS = 25000; // [A] ticket assumption

export interface InflightTracker {
  /** Wrap a handler; resolves with the handler's result. Throws DrainingError once draining began. */
  track<T>(work: () => Promise<T>): Promise<T>;
  readonly draining: boolean;
  /** Stop accepting: after this, track() throws. Resolves when in-flight count is 0. */
  begin_drain(): Promise<void>;
  readonly in_flight: number;
}

export class DrainingError extends Error {
  constructor() {
    super("draining");
    this.name = "DrainingError";
  }
}

export function create_inflight_tracker(): InflightTracker {
  let count = 0;
  let draining = false;
  let waiters: Array<() => void> = [];
  const release = (): void => {
    if (count === 0) {
      const w = waiters;
      waiters = [];
      for (const fn of w) fn();
    }
  };
  return {
    async track<T>(work: () => Promise<T>): Promise<T> {
      if (draining) throw new DrainingError();
      count += 1;
      try {
        return await work();
      } finally {
        count -= 1;
        release();
      }
    },
    get draining() {
      return draining;
    },
    get in_flight() {
      return count;
    },
    begin_drain(): Promise<void> {
      draining = true;
      if (count === 0) return Promise.resolve();
      return new Promise<void>((resolve) => waiters.push(resolve));
    },
  };
}

type Sig = "SIGTERM" | "SIGINT";
export interface SignalHost {
  on(sig: Sig, fn: () => void): unknown;
  off?(sig: Sig, fn: () => void): unknown;
}

export interface DrainOptions {
  tracker: InflightTracker;
  close: () => Promise<void>;
  exit: (code: number) => void;
  logger: Logger;
  grace_ms?: number;
  host?: SignalHost;
  setTimer?: typeof setTimeout;
  clearTimer?: typeof clearTimeout;
}

/** First signal: drain then exit(0). Second signal: exit(1) at once. Returns an uninstall function. */
export function install_drain(opts: DrainOptions): () => void {
  const host: SignalHost = opts.host ?? process;
  const set_timer = opts.setTimer ?? setTimeout;
  const clear_timer = opts.clearTimer ?? clearTimeout;
  const grace = opts.grace_ms ?? DRAIN_GRACE_MS;
  let signals = 0;

  const run = async (signal: string): Promise<void> => {
    opts.logger.info("process.drain", { extra: { signal } });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expired = new Promise<"timeout">((resolve) => {
      timer = set_timer(() => resolve("timeout"), grace);
    });
    const outcome = await Promise.race([opts.tracker.begin_drain().then(() => "done" as const), expired]);
    if (timer !== undefined) clear_timer(timer);
    if (outcome === "timeout") opts.logger.warn("process.drain_timeout", { extra: { grace_ms: grace } });
    try {
      await opts.close();
    } catch {
      opts.logger.error("process.drain_failed", {});
      opts.exit(1);
      return;
    }
    opts.exit(0);
  };

  const make = (sig: Sig) => () => {
    signals += 1;
    if (signals === 1) void run(sig);
    else if (signals === 2) opts.exit(1);
  };
  const on_term = make("SIGTERM");
  const on_int = make("SIGINT");
  host.on("SIGTERM", on_term);
  host.on("SIGINT", on_int);
  return () => {
    host.off?.("SIGTERM", on_term);
    host.off?.("SIGINT", on_int);
  };
}
