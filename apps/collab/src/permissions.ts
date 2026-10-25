// WriteGuard: who may write, at connect and per update (CON-12, SP-2 option A). Keeps no state list: is_editable decides.
import { is_editable } from "@ls/core/lifecycle/lesson-machine";
import type {
  LessonId,
  LessonStateName,
  RoleName,
} from "@ls/core/ports/common";
import type { AppUserRow } from "@ls/core/ports/sessions";
import type { ErrorCode as ApiErrorCode } from "@ls/schema/api/common";
import type { FrozenDocs } from "./frozen-docs.ts";

export interface WriteDecision {
  allowed: boolean;
  refusal: ApiErrorCode | null;
}

/** Per-connection context. `lesson_state` and `read_only` are updated by AckBroadcaster.mode. */
export interface SocketContext {
  socket_id: string;
  user: AppUserRow;
  lesson_id: LessonId;
  lesson_state: LessonStateName;
  read_only: boolean;
}

const ALLOWED: WriteDecision = { allowed: true, refusal: null };
const LOCKED: WriteDecision = { allowed: false, refusal: "LESSON_LOCKED" };

export class WriteGuard {
  constructor(private readonly frozen: FrozenDocs) {}

  can_write(
    role: RoleName,
    state: LessonStateName,
    lesson_id: LessonId,
  ): WriteDecision {
    return is_editable(state, role) && !this.frozen.is_frozen(lesson_id)
      ? { ...ALLOWED }
      : { ...LOCKED };
  }

  on_update(ctx: SocketContext, frozen: boolean): WriteDecision {
    return frozen || ctx.read_only ? { ...LOCKED } : { ...ALLOWED };
  }
}
