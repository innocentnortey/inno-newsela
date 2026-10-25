// Mirrors OpenAPI components Sha256, StateVector, Timestamp, NullableText, Error, ErrorCode, ProseMirrorDoc (interface.openapi.yaml, NL-11).
import { z } from "zod";

export const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
export type Sha256 = z.infer<typeof Sha256>;

export const StateVector = z.base64();
export type StateVector = z.infer<typeof StateVector>;

export const Timestamp = z.iso.datetime({ offset: true });
export type Timestamp = z.infer<typeof Timestamp>;

export const NullableText = z.string().nullable();
export type NullableText = z.infer<typeof NullableText>;

export const API_ERROR_CODES = [
  "INVALID_REQUEST",
  "INVALID_CREDENTIALS",
  "INVALID_CHOICE",
  "NOT_RESOLVABLE",
  "UNDO_EXPIRED",
  "STALE_BASE",
  "SHEET_UNREACHABLE",
  "COLLAB_UNAVAILABLE",
  "SERVICE_BUSY",
  "UNAUTHENTICATED",
  "NOT_ON_ALLOW_LIST",
  "ROLE_FORBIDDEN",
  "NOT_FOUND",
  "INVALID_TRANSITION",
  "SHEET_NOT_PUBLIC",
  "UNSUPPORTED_FILE",
  "HEADER_NOT_FOUND",
  "TOO_MANY_ROWS",
  "VALIDATION_INCOMPLETE",
  "DAY_CAP_REACHED",
  "SCHEMA_UNKNOWN",
  "LESSON_LOCKED",
  "REASON_REQUIRED",
  "NOTE_REQUIRED",
  "SOURCE_REQUIRED",
  "QUOTE_TOO_LONG",
  "ANCHOR_CHANGED",
  "MODEL_UNAVAILABLE",
  "BLOCKED",
  "CONFIRMATION_OPEN",
  "SUGGESTION_PENDING",
  "NOT_STORED",
  "STALE_PIN",
  "FOUR_EYES",
  "RATING_REQUIRED",
  "DEPENDENCY_UNAPPROVED",
] as const;

export const ErrorCode = z.enum(API_ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCode>;
export const ApiErrorCode = ErrorCode;

export const Error = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type Error = z.infer<typeof Error>;

// The generator types `content` items (`type: object`, no properties) as Record<string, never>; the custom check keeps
// that inferred type so the AC-8 parity file passes, while at runtime any plain object is accepted.
const ProseMirrorNode = z.custom<Record<string, never>>(
  (v) => typeof v === "object" && v !== null && !Array.isArray(v),
);

export const ProseMirrorDoc = z.looseObject({
  type: z.literal("doc"),
  content: z.array(ProseMirrorNode).optional(),
});
export type ProseMirrorDoc = z.infer<typeof ProseMirrorDoc>;
