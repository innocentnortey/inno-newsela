// S-29 (GEN-6): after the session check, the same sweep also compares each live socket's role and lesson state with
// the database (two more batched reads per sweep). A socket that may no longer edit is downgraded to read-only, never
// upgraded; a removed user is closed. A failing access lookup fails closed after FAILURES_BEFORE_CLOSE sweeps.
// S-9: re-check open sockets against their session; close any whose session was signed out, revoked or expired.
// Cost: one batched query per sweep (all distinct session hashes at once), so one query per second however many sockets.
// Failure policy: a failed lookup leaves sockets "unverified"; after FAILURES_BEFORE_CLOSE consecutive failed sweeps
// (about 3 s at the 1 s interval) every socket carrying a session is closed, so a database outage cannot keep a
// revoked session writing. A later successful sweep resets the count (clients reconnect and are re-authenticated).
import type { Clock } from "@ls/core/ports/clock";
import type {
  LessonId,
  LessonStateName,
  RoleName,
  UserId,
} from "@ls/core/ports/common";
import { is_editable } from "@ls/core/lifecycle/lesson-machine";
import type { Logger } from "@ls/obs/logger";
import type { SocketContext } from "./permissions.ts";

export const FAILURES_BEFORE_CLOSE = 3;
export const SESSION_ENDED_CODE = 4401;
export const SESSION_ENDED_REASON = "Session ended. Sign in again.";

export interface RecheckTarget {
  ctx: SocketContext | undefined;
  close(): void;
  /** Make this socket read-only and tell the client (S-29). A target without it is closed instead. */
  downgrade?(d: Downgrade): void;
}

export interface AccessSnapshot {
  roles: Map<UserId, RoleName>;
  states: Map<LessonId, LessonStateName>;
}
/** Current roles and lesson states for the given ids. One round trip for any number of ids. */
export type CurrentAccess = (
  user_ids: UserId[],
  lesson_ids: LessonId[],
) => Promise<AccessSnapshot>;
export interface Downgrade {
  role: RoleName | null;
  state: LessonStateName;
  reason: "role" | "state";
}

/** Of the given token hashes, the ones that still resolve to a live session. One round trip. */
export type LiveHashes = (hashes: string[], now: Date) => Promise<Set<string>>;

export class SessionRecheck {
  private in_flight = false;
  private failures = 0;
  private access_failures = 0;

  constructor(
    private readonly live_hashes: LiveHashes,
    private readonly clock: Clock,
    private readonly logger: Logger,
    private readonly current_access?: CurrentAccess,
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
    const survivors: RecheckTarget[] = [];
    for (const t of targets) {
      const ctx = t.ctx;
      if (ctx?.session_hash === undefined) continue;
      if (live !== null && live.has(ctx.session_hash)) {
        survivors.push(t);
        continue;
      }
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
    if (
      this.current_access !== undefined &&
      live !== null &&
      survivors.length > 0
    ) {
      closed += await this.check_access(this.current_access, survivors);
    }
    return closed;
  }

  /** Close one socket for an access reason. Returns 1 when closed. */
  private close_for(
    t: RecheckTarget,
    ctx: SocketContext,
    reason: string,
  ): number {
    ctx.read_only = true;
    try {
      t.close();
    } catch {
      this.logger.warn("collab.session_close_failed", {
        lesson_id: ctx.lesson_id,
      });
      return 0;
    }
    this.logger.warn("collab.session_ended_socket_closed", {
      lesson_id: ctx.lesson_id,
      extra: { reason },
    });
    return 1;
  }

  private async check_access(
    lookup: CurrentAccess,
    targets: RecheckTarget[],
  ): Promise<number> {
    const users = new Set<UserId>();
    const lessons = new Set<LessonId>();
    for (const t of targets) {
      users.add((t.ctx as SocketContext).user.user_id);
      lessons.add((t.ctx as SocketContext).lesson_id);
    }
    let snap: AccessSnapshot;
    try {
      snap = await lookup([...users], [...lessons]);
      this.access_failures = 0;
    } catch {
      this.access_failures += 1;
      this.logger.warn("collab.access_recheck_failed", {
        extra: { consecutive: this.access_failures },
      });
      if (this.access_failures < FAILURES_BEFORE_CLOSE) return 0;
      let n = 0;
      for (const t of targets) {
        const ctx = t.ctx as SocketContext;
        if (ctx.read_only) continue;
        n += this.close_for(t, ctx, "unverified_access");
      }
      return n;
    }

    let closed = 0;
    let downgraded = 0;
    for (const t of targets) {
      const ctx = t.ctx as SocketContext;
      const role = snap.roles.get(ctx.user.user_id);
      if (role === undefined) {
        closed += this.close_for(t, ctx, "user_removed");
        continue;
      }
      const from = ctx.user.role;
      if (role !== from) ctx.user = { ...ctx.user, role };
      const state = snap.states.get(ctx.lesson_id);
      if (ctx.read_only) continue; // never upgrade, never repeat a downgrade
      if (state !== undefined && is_editable(state, role)) continue;
      // Not editable now. A missing lesson row is reported with the state the socket already holds.
      const shown = state ?? ctx.lesson_state;
      const reason = role !== from ? "role" : "state";
      const d: Downgrade = { role, state: shown, reason };
      const before = ctx.lesson_state;
      ctx.read_only = true;
      ctx.lesson_state = shown;
      try {
        if (t.downgrade === undefined) throw new Error("no downgrade");
        t.downgrade(d);
      } catch {
        closed += this.close_for(t, ctx, "downgrade_failed");
        continue;
      }
      downgraded += 1;
      this.logger.warn("collab.role_downgraded", {
        lesson_id: ctx.lesson_id,
        extra: { from, to: role, reason, state_from: before, state_to: shown },
      });
    }
    if (downgraded > 0 || closed > 0)
      this.logger.info("collab.access_recheck", {
        extra: { downgraded, closed },
      });
    return closed;
  }
}
