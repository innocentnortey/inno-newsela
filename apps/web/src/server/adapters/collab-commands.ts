import { z } from "zod";
import type { SecretStr } from "@ls/config/secret";
import type { Clock } from "@ls/core/ports/clock";
import type { JsonValue } from "@ls/core/ports/common";
import type {
  CollabCommands, EditCommand, ModeCommand, ModeResult, SnapshotResult, StoreAck, SubmitCommand,
} from "@ls/core/ports/collab-commands";
import { CollabUnavailable, DomainRefusal, InvariantViolation } from "@ls/core/errors";
import type { Logger } from "@ls/obs/logger";
import { Error as ErrorEnvelope } from "@ls/schema/api/common";
import { LessonId, Sha256, StateVector, StoreId, Timestamp, UserId, VersionId } from "@ls/schema/ids";

export interface HttpCollabCommandClient_ctor {
  base_url: string;
  token: SecretStr;
  timeout_ms: number;
}
export interface CollabClientDeps {
  clock: Clock;
  logger: Logger;
  fetch_impl?: typeof fetch;
}
export type CollabCommandName = "lock_and_snapshot" | "apply_edit" | "set_mode";

const ROUTES: Record<CollabCommandName, string> = {
  lock_and_snapshot: "lock-and-snapshot",
  apply_edit: "apply-edit",
  set_mode: "set-mode",
};

const LessonStateName = z.enum([
  "draft", "generation_failed", "in_review", "submitted", "changes_requested", "approved", "reopened", "exported",
]);

const SnapshotResultZ = z.object({
  lesson_id: LessonId,
  version_id: VersionId,
  version_number: z.number().int(),
  content_hash: Sha256,
  state_vector: StateVector,
  review_event_id: z.string(),
  from_state: LessonStateName,
  to_state: LessonStateName,
});
const StoreAckZ = z.object({
  lesson_id: LessonId,
  store_id: StoreId,
  seq: z.number().int(),
  content_hash: Sha256,
  state_vector: StateVector,
  stored_at: Timestamp.transform((s) => new Date(s)),
  stored_by: UserId.nullable(),
  check_job_enqueued: z.boolean(),
});
const ModeResultZ = z.object({
  lesson_id: LessonId,
  mode: z.enum(["editable", "read_only"]),
  connections_notified: z.number().int(),
});

// One URL path segment: encodeURIComponent leaves dots, and ".." would walk the path.
function seg(id: string): string {
  const e = encodeURIComponent(id);
  return e === "." ? "%2E" : e === ".." ? "%2E%2E" : e;
}

export function collab_refusal_from(
  status: number,
  body: unknown,
  command: CollabCommandName,
  lesson_id: string,
  request_id: string,
  logger?: Logger,
): DomainRefusal | CollabUnavailable {
  const unavailable = new CollabUnavailable({ lesson_id, command });
  if (status === 401) {
    logger?.error("collab.token_mismatch", {
      request_id,
      lesson_id,
      extra: new InvariantViolation("collab token rejected", { command }),
    });
    return unavailable;
  }
  const parsed = ErrorEnvelope.safeParse(body);
  if (!parsed.success) return unavailable;
  const details: Record<string, unknown> = { ...(parsed.data.error.details ?? {}) };
  const collab_request_id = typeof details["request_id"] === "string" ? details["request_id"] : null;
  details["request_id"] = request_id;
  logger?.warn("collab.refusal", {
    request_id,
    lesson_id,
    extra: { command, code: parsed.data.error.code, collab_request_id },
  });
  return new DomainRefusal(parsed.data.error.code, parsed.data.error.message, details as JsonValue);
}

export class HttpCollabCommandClient implements CollabCommands {
  private readonly base: string;
  private readonly token: SecretStr;
  private readonly timeout_ms: number;
  private readonly clock: Clock;
  private readonly logger: Logger;
  private readonly fetch_impl: typeof fetch;

  constructor(cfg: HttpCollabCommandClient_ctor, deps: CollabClientDeps) {
    this.base = cfg.base_url.replace(/\/+$/, "");
    this.token = cfg.token;
    this.timeout_ms = cfg.timeout_ms > 0 ? cfg.timeout_ms : 5000;
    this.clock = deps.clock;
    this.logger = deps.logger;
    this.fetch_impl = deps.fetch_impl ?? fetch;
  }

  lock_and_snapshot(cmd: SubmitCommand): Promise<SnapshotResult> {
    return this.call("lock_and_snapshot", cmd, SnapshotResultZ);
  }
  apply_edit(cmd: EditCommand): Promise<StoreAck> {
    return this.call("apply_edit", cmd, StoreAckZ);
  }
  set_mode(cmd: ModeCommand): Promise<ModeResult> {
    return this.call("set_mode", cmd, ModeResultZ);
  }

  private async call<T>(
    command: CollabCommandName,
    cmd: { lesson_id: string; request_id: string },
    result: z.ZodType<T, unknown>,
  ): Promise<T> {
    const { lesson_id, request_id } = cmd;
    const unavailable = (): CollabUnavailable => new CollabUnavailable({ lesson_id, command });
    const url = `${this.base}/lessons/${seg(lesson_id)}/${ROUTES[command]}`;
    const ac = new AbortController();
    let res: Response;
    try {
      const timer = this.clock.sleep(this.timeout_ms).then(() => "timeout" as const);
      const sent = this.fetch_impl(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + this.token.reveal(),
          "x-request-id": request_id,
        },
        body: JSON.stringify(cmd),
        redirect: "error",
        signal: ac.signal,
      });
      sent.catch(() => undefined); // a late failure after the timeout must not go unhandled
      const won = await Promise.race([sent, timer]);
      if (won === "timeout") {
        ac.abort();
        throw new Error("timeout");
      }
      res = won;
    } catch (err) {
      this.logger.warn("collab.call_failed", {
        request_id,
        lesson_id,
        extra: { command, error: err instanceof Error ? err.name : "unknown" },
      });
      throw unavailable();
    }
    let body: unknown;
    try {
      body = JSON.parse(await res.text());
    } catch {
      body = undefined;
    }
    if (res.status >= 200 && res.status < 300) {
      const parsed = result.safeParse(body);
      if (parsed.success) return parsed.data;
      this.logger.warn("collab.bad_body", { request_id, lesson_id, extra: { command, status: res.status } });
      throw unavailable();
    }
    throw collab_refusal_from(res.status, body, command, lesson_id, request_id, this.logger);
  }
}
