// S-9: re-check open sockets against their session; close any whose session was signed out, revoked or expired.
// Cost: one batched query per sweep (all distinct session hashes at once), so one query per second however many sockets.
// Failure policy: a failed lookup leaves sockets "unverified"; after FAILURES_BEFORE_CLOSE consecutive failed sweeps
// (about 3 s at the 1 s interval) every socket carrying a session is closed, so a database outage cannot keep a
// revoked session writing. A later successful sweep resets the count (clients reconnect and are re-authenticated).
import type { Clock } from "@ls/core/ports/clock";
import type { Logger } from "@ls/obs/logger";
import type { SocketContext } from "./permissions.ts";

export const FAILURES_BEFORE_CLOSE = 3;
export const SESSION_ENDED_CODE = 4401;
export const SESSION_ENDED_REASON = "Session ended. Sign in again.";

export interface RecheckTarget {
  ctx: SocketContext | undefined;
  close(): void;
}

/** Of the given token hashes, the ones that still resolve to a live session. One round trip. */
export type LiveHashes = (hashes: string[], now: Date) => Promise<Set<string>>;

export class SessionRecheck {
  private in_flight = false;
  private failures = 0;

  constructor(
    private readonly live_hashes: LiveHashes,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  /** Timer entry point: never throws, never overlaps itself. Returns false when skipped because a sweep is running. */
  async tick(get_targets: () => RecheckTarget[]): Promise<boolean> {
    if (this.in_flight) return false;
    this.in_flight = true;
    try {
      await this.sweep(get_targets());
    } catch {
      this.logger.warn("collab.session_recheck_failed", {});
    } finally {
      this.in_flight = false;
    }
    return true;
  }

  async sweep(targets: RecheckTarget[]): Promise<number> {
    const hashes = new Set<string>();
    for (const t of targets)
      if (t.ctx?.session_hash !== undefined) hashes.add(t.ctx.session_hash);
    if (hashes.size === 0) return 0;

    let live: Set<string> | null = null;
    try {
      live = await this.live_hashes([...hashes], this.clock.now());
      this.failures = 0;
    } catch {
      this.failures += 1;
      this.logger.warn("collab.session_recheck_failed", {
        extra: { consecutive: this.failures },
      });
      if (this.failures < FAILURES_BEFORE_CLOSE) return 0;
    }

    let closed = 0;
    for (const t of targets) {
      const ctx = t.ctx;
      if (ctx?.session_hash === undefined) continue;
      if (live !== null && live.has(ctx.session_hash)) continue;
      ctx.read_only = true;
      try {
        t.close();
      } catch {
        this.logger.warn("collab.session_close_failed", {
          lesson_id: ctx.lesson_id,
        });
        continue;
      }
      closed += 1;
      this.logger.warn("collab.session_ended_socket_closed", {
        lesson_id: ctx.lesson_id,
        extra: { reason: live === null ? "unverified" : "ended" },
      });
    }
    return closed;
  }
}
