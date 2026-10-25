// Maps a thrown value to the OpenAPI Error envelope and its HTTP status. Messages are fixed phrases: no lesson text, no token.
import { ZodError } from "zod";
import { DomainRefusal } from "@ls/core/errors";
import type { ErrorCode as ApiErrorCode } from "@ls/schema/api/common";

// Mirror of apps/web/src/server/http/error-status.generated.ts (x-error-catalog); the web client maps these codes unchanged.
const STATUS: Record<ApiErrorCode, number> = {
  INVALID_REQUEST: 400, UNAUTHENTICATED: 401, INVALID_CREDENTIALS: 401, NOT_ON_ALLOW_LIST: 403, ROLE_FORBIDDEN: 403,
  NOT_FOUND: 404, INVALID_TRANSITION: 409, LESSON_LOCKED: 409, ANCHOR_CHANGED: 409, NOT_STORED: 409, STALE_PIN: 409,
  UNDO_EXPIRED: 409, STALE_BASE: 409, SHEET_NOT_PUBLIC: 422, UNSUPPORTED_FILE: 422, HEADER_NOT_FOUND: 422, TOO_MANY_ROWS: 422,
  INVALID_CHOICE: 422, VALIDATION_INCOMPLETE: 422, DAY_CAP_REACHED: 422, REASON_REQUIRED: 422, NOTE_REQUIRED: 422,
  NOT_RESOLVABLE: 422, SOURCE_REQUIRED: 422, QUOTE_TOO_LONG: 422, BLOCKED: 422, CONFIRMATION_OPEN: 422, SUGGESTION_PENDING: 422,
  FOUR_EYES: 422, RATING_REQUIRED: 422, DEPENDENCY_UNAPPROVED: 422, SCHEMA_UNKNOWN: 500, SHEET_UNREACHABLE: 502,
  MODEL_UNAVAILABLE: 503, COLLAB_UNAVAILABLE: 503, SERVICE_BUSY: 503,
};

export interface Enveloped {
  status: number;
  code: ApiErrorCode;
  body: { error: { code: ApiErrorCode; message: string; details: Record<string, unknown> } };
}

export function envelope(code: ApiErrorCode, message: string, details: Record<string, unknown>, request_id: string | null): Enveloped {
  const merged = { ...details, ...(request_id === null ? {} : { request_id }) };
  return { status: STATUS[code], code, body: { error: { code, message, details: merged } } };
}

export function from_unknown(e: unknown, request_id: string | null): Enveloped {
  if (e instanceof DomainRefusal) {
    const d = typeof e.details === "object" && e.details !== null && !Array.isArray(e.details) ? (e.details as Record<string, unknown>) : {};
    return envelope(e.code, e.message, d, request_id);
  }
  if (e instanceof ZodError) {
    const fields = e.issues.flatMap((i) => {
      const base = i.path.map(String).join(".");
      if (i.code === "unrecognized_keys") return i.keys.map((k) => (base === "" ? k : `${base}.${k}`));
      return [base];
    });
    return envelope("INVALID_REQUEST", "The request body is not valid", { fields }, request_id);
  }
  // Any other failure: the catalog has no internal-error code, so the web client sees the retryable "collab unavailable".
  return envelope("COLLAB_UNAVAILABLE", "The collaboration command failed", {}, request_id);
}
