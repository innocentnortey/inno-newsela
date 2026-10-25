// S-9: re-check open sockets against their session; close any whose session was signed out, revoked or expired.
import type { Clock } from "@ls/core/ports/clock";
import type { SessionRepo } from "@ls/core/ports/sessions";
import type { Logger } from "@ls/obs/logger";
import type { SocketContext } from "./permissions.ts";

export interface RecheckTarget {
  ctx: SocketContext | undefined;
  close(): void;
}

export class SessionRecheck {
  constructor(
    private readonly sessions: SessionRepo,
    private readonly clock: Clock,
    private readonly logger: Logger,
  ) {}

  /** Resolve each distinct session once. A lookup error leaves sockets open (fail soft on infra, retried next sweep). */
  async sweep(targets: RecheckTarget[]): Promise<number> {
    const hashes = new Set<string>();
    for (const t of targets)
      if (t.ctx?.session_hash !== undefined) hashes.add(t.ctx.session_hash);
    const dead = new Set<string>();
    for (const hash of hashes) {
      try {
        if ((await this.sessions.resolve(hash, this.clock.now())) === null)
          dead.add(hash);
      } catch {
        this.logger.warn("collab.session_recheck_failed", {});
      }
    }
    let closed = 0;
    for (const t of targets) {
      const ctx = t.ctx;
      if (ctx?.session_hash === undefined || !dead.has(ctx.session_hash))
        continue;
      ctx.read_only = true;
      t.close();
      closed += 1;
      this.logger.warn("collab.session_ended_socket_closed", {
        lesson_id: ctx.lesson_id,
      });
    }
    return closed;
  }
}
