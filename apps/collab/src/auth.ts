// CollabAuthenticator: session cookie -> SocketContext, before the document loads. Never logs a cookie, token or hash.
import { createHash } from "node:crypto";
import type { CollabSettings } from "@ls/config/settings";
import { DomainRefusal } from "@ls/core/errors";
import type { Clock } from "@ls/core/ports/clock";
import type { LessonStateRepo } from "@ls/core/ports/lesson-state";
import type { SessionRepo } from "@ls/core/ports/sessions";
import type { FrozenDocs } from "./frozen-docs.ts";
import type { SocketContext, WriteGuard } from "./permissions.ts";

export interface SocketAuthRequest {
  document_name: string;
  cookie_header: string | null;
  /** Present for the WebSocket handshake only; never an identity. */
  token_param: string | null;
  socket_id: string;
}

export function cookie_value(
  header: string | null,
  name: string,
): string | null {
  if (header === null) return null;
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at < 0) continue;
    if (part.slice(0, at).trim() === name) {
      const v = part.slice(at + 1).trim();
      return v === "" ? null : v;
    }
  }
  return null;
}

export class CollabAuthenticator {
  constructor(
    private readonly sessions: SessionRepo,
    private readonly states: LessonStateRepo,
    private readonly guard: WriteGuard,
    private readonly frozen: FrozenDocs,
    private readonly clock: Clock,
    private readonly settings: CollabSettings,
  ) {}

  async authenticate(req: SocketAuthRequest): Promise<SocketContext> {
    const m = /^lesson:(.+)$/.exec(req.document_name);
    if (m === null) throw new DomainRefusal("NOT_FOUND", "Unknown document.");
    const lesson_id = m[1] as string;

    const token = cookie_value(
      req.cookie_header,
      this.settings.session_cookie_name,
    );
    if (token === null)
      throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");
    const session_hash = createHash("sha256").update(token).digest("hex");
    const found = await this.sessions.resolve(session_hash, this.clock.now());
    if (found === null)
      throw new DomainRefusal("UNAUTHENTICATED", "Sign in again.");

    const row = await this.states.get(lesson_id);
    if (row === null) throw new DomainRefusal("NOT_FOUND", "Unknown document.");
    this.frozen.seed(lesson_id, row.state);
    const decision = this.guard.can_write(
      found.user.role,
      row.state,
      lesson_id,
    );
    return {
      socket_id: req.socket_id,
      user: found.user,
      lesson_id,
      lesson_state: row.state,
      read_only: !decision.allowed,
      session_hash,
    };
  }
}
