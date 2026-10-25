// AckBroadcaster: the stateless messages of CON-12 `x-collaboration-channel`. Only these fields are ever serialised:
// never lesson text, a cookie, a token or an email.
import { is_editable } from "@ls/core/lifecycle/lesson-machine";
import type { StoreAck } from "@ls/core/ports/collab-commands";
import type {
  CollabMode,
  LessonId,
  LessonStateName,
  StateVector,
} from "@ls/core/ports/common";
import type { ErrorCode as ApiErrorCode } from "@ls/schema/api/common";
import type { SocketContext } from "./permissions.ts";

export interface SocketHandle {
  readonly socket_id: string;
  context(): SocketContext;
  send_stateless(json: string): void;
  set_read_only(v: boolean): void;
}
export interface ConnectionRegistry {
  sockets_of(lesson_id: LessonId): SocketHandle[];
  find(socket_id: string): SocketHandle | undefined;
}
export interface ModeMessage {
  mode: CollabMode;
  state: LessonStateName;
}

export class AckBroadcaster {
  constructor(private readonly registry: ConnectionRegistry) {}

  stored(lesson_id: LessonId, ack: StoreAck): number {
    const json = JSON.stringify({
      type: "stored",
      content_hash: ack.content_hash,
      state_vector: ack.state_vector,
      stored_at: ack.stored_at.toISOString(),
    });
    const sockets = this.registry.sockets_of(lesson_id);
    for (const s of sockets) s.send_stateless(json);
    return sockets.length;
  }

  /** Updates each socket's flags first, then tells it. A writable flag needs a role that may edit in that state. */
  mode(lesson_id: LessonId, msg: ModeMessage): number {
    const json = JSON.stringify({
      type: "mode",
      mode: msg.mode,
      state: msg.state,
    });
    const sockets = this.registry.sockets_of(lesson_id);
    for (const s of sockets) {
      const ctx = s.context();
      ctx.lesson_state = msg.state;
      ctx.read_only =
        msg.mode === "read_only" || !is_editable(msg.state, ctx.user.role);
      s.set_read_only(ctx.read_only);
      s.send_stateless(json);
    }
    return sockets.length;
  }

  /** One socket, flags untouched (used when a socket has just connected). */
  mode_to(socket_id: string, msg: ModeMessage): void {
    this.registry
      .find(socket_id)
      ?.send_stateless(
        JSON.stringify({ type: "mode", mode: msg.mode, state: msg.state }),
      );
  }

  refused(
    socket_id: string,
    code: ApiErrorCode,
    message: string,
    refused_from: StateVector,
  ): void {
    this.registry
      .find(socket_id)
      ?.send_stateless(
        JSON.stringify({ type: "refused", code, message, refused_from }),
      );
  }
}
