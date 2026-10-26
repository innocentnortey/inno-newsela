import type { ErrorCode as ApiErrorCode } from "@ls/schema/api/common";
import type { CapName, DayCapScope, JsonValue, LessonId, JobId, ModelCallId, Usd } from "./ports/common.ts";

// Same class objects as the owning packages, not copies.
export { ConfigError } from "@ls/config/errors";
export { SchemaUnknownError } from "@ls/editor-schema/errors";

// Messages are fixed phrases plus ids and codes: never a prompt, key, lesson text or email.

export class DomainRefusal extends Error {
  readonly code: ApiErrorCode;
  readonly details: JsonValue;
  constructor(code: ApiErrorCode, message: string, details: JsonValue = {}) {
    super(message);
    this.name = "DomainRefusal";
    this.code = code;
    this.details = details;
  }
}

export type ProviderErrorKind = "rate_limited" | "overloaded" | "server_error" | "timeout" | "connection" | "bad_request" | "auth" | "refusal";

// A timeout is never retried: the provider may have billed it (DO-4 section 13 R-22).
const RETRYABLE: ReadonlySet<ProviderErrorKind> = new Set(["rate_limited", "overloaded", "server_error", "connection"]);

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly retryable: boolean;
  readonly http_status: number | null;
  readonly retry_after_s: number | null;
  readonly provider_request_id: string | null;
  /** Truncated, key-stripped provider text that describes our request (HTTP 400/422 only); logged, never stored in the database. */
  readonly safe_detail: string | null;
  constructor(init: {
    kind: ProviderErrorKind;
    message?: string;
    http_status?: number | null;
    retry_after_s?: number | null;
    provider_request_id?: string | null;
    safe_detail?: string | null;
  }) {
    super(init.message ?? `provider error: ${init.kind}`);
    this.name = "ProviderError";
    this.kind = init.kind;
    this.retryable = RETRYABLE.has(init.kind);
    this.http_status = init.http_status ?? null;
    this.retry_after_s = init.retry_after_s ?? null;
    this.provider_request_id = init.provider_request_id ?? null;
    this.safe_detail = init.safe_detail ?? null;
  }
}

export class ModelOutputInvalid extends Error {
  readonly model_call_id: ModelCallId;
  readonly schema_name: string;
  readonly issues: string[];
  constructor(init: { model_call_id: ModelCallId; schema_name: string; issues: string[] }) {
    super(`model output invalid for ${init.schema_name}`);
    this.name = "ModelOutputInvalid";
    this.model_call_id = init.model_call_id;
    this.schema_name = init.schema_name;
    this.issues = init.issues;
  }
}

export class SpendRefused extends Error {
  readonly refused_by: CapName;
  readonly scope: DayCapScope | null;
  readonly amount_usd: Usd;
  constructor(init: { refused_by: CapName; scope: DayCapScope | null; amount_usd: Usd }) {
    super(`spend refused by ${init.refused_by}`);
    this.name = "SpendRefused";
    this.refused_by = init.refused_by;
    this.scope = init.scope;
    this.amount_usd = init.amount_usd;
  }
}

export class LeaseLost extends Error {
  readonly job_id: JobId;
  constructor(init: { job_id: JobId }) {
    super(`lease lost for ${init.job_id}`);
    this.name = "LeaseLost";
    this.job_id = init.job_id;
  }
}

export class CollabUnavailable extends Error {
  readonly lesson_id: LessonId;
  readonly command: "lock_and_snapshot" | "apply_edit" | "set_mode";
  constructor(init: { lesson_id: LessonId; command: "lock_and_snapshot" | "apply_edit" | "set_mode" }) {
    super(`collab unavailable for ${init.command}`);
    this.name = "CollabUnavailable";
    this.lesson_id = init.lesson_id;
    this.command = init.command;
  }
}

export class CompileError extends Error {
  readonly lesson_id: LessonId;
  readonly reason: "section_not_in_template" | "role_not_allowed" | "unknown_node";
  readonly address: string | null;
  constructor(init: { lesson_id: LessonId; reason: "section_not_in_template" | "role_not_allowed" | "unknown_node"; address?: string | null }) {
    super(`compile error: ${init.reason}`);
    this.name = "CompileError";
    this.lesson_id = init.lesson_id;
    this.reason = init.reason;
    this.address = init.address ?? null;
  }
}

export class InvariantViolation extends Error {
  readonly invariant: string;
  readonly details: JsonValue;
  constructor(invariant: string, details: JsonValue = {}) {
    super(`invariant violated: ${invariant}`);
    this.name = "InvariantViolation";
    this.invariant = invariant;
    this.details = details;
  }
}
