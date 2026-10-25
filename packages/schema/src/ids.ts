import { z } from "zod";

export const UNIT_ID_RE = /^G\d{1,2}\.U\d{1,2}$/;
export const LESSON_ID_RE = /^G\d{1,2}\.U\d{1,2}\.(L\d{1,3}|FLEX-\d{1,2}[a-z]?)$/;
export const OUTLINE_VERSION_ID_RE = /^G\d{1,2}\.U\d{1,2}\.ov\d+$/;
export const ULID_BODY = "[0-9A-HJKMNP-TV-Z]{26}";

export const ID_PREFIXES = [
  "usr", "run", "job", "mc", "lv", "st", "iss", "sug", "sr", "ae", "ov", "exp", "ev", "pr", "ops",
] as const;

export const IdPrefix = z.enum([
  "usr", "run", "job", "mc", "lv", "st", "iss", "sug", "sr", "ae", "req", "ov", "exp", "ev", "pr", "ops",
]);
export type IdPrefix = z.infer<typeof IdPrefix>;

function prefixed_id(prefix: string): RegExp {
  return new RegExp(`^${prefix}_${ULID_BODY}$`);
}

export const UnitId = z.string().regex(UNIT_ID_RE);
export type UnitId = z.infer<typeof UnitId>;
export const LessonId = z.string().regex(LESSON_ID_RE);
export type LessonId = z.infer<typeof LessonId>;
export const OutlineVersionId = z.string().regex(OUTLINE_VERSION_ID_RE);
export type OutlineVersionId = z.infer<typeof OutlineVersionId>;

export const UserId = z.string().regex(prefixed_id("usr"));
export type UserId = z.infer<typeof UserId>;
export const RunId = z.string().regex(prefixed_id("run"));
export type RunId = z.infer<typeof RunId>;
export const JobId = z.string().regex(prefixed_id("job"));
export type JobId = z.infer<typeof JobId>;
export const ModelCallId = z.string().regex(prefixed_id("mc"));
export type ModelCallId = z.infer<typeof ModelCallId>;
export const VersionId = z.string().regex(prefixed_id("lv"));
export type VersionId = z.infer<typeof VersionId>;
export const StoreId = z.string().regex(prefixed_id("st"));
export type StoreId = z.infer<typeof StoreId>;
export const IssueId = z.string().regex(prefixed_id("iss"));
export type IssueId = z.infer<typeof IssueId>;
export const SuggestionId = z.string().regex(prefixed_id("sug"));
export type SuggestionId = z.infer<typeof SuggestionId>;
export const ReservationId = z.string().regex(prefixed_id("sr"));
export type ReservationId = z.infer<typeof ReservationId>;
export const AuditEventId = z.string().regex(prefixed_id("ae"));
export type AuditEventId = z.infer<typeof AuditEventId>;

export const RequestId = z.string().regex(/^(req_[0-9A-HJKMNP-TV-Z]{26}|[A-Za-z0-9_.-]{1,64})$/);
export type RequestId = z.infer<typeof RequestId>;
export const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
export type Sha256 = z.infer<typeof Sha256>;
// base64
export const StateVector = z.string().regex(/^[A-Za-z0-9+/]*={0,2}$/);
export type StateVector = z.infer<typeof StateVector>;
// JSON-safe timestamp (matches OpenAPI Timestamp)
export const Timestamp = z.iso.datetime({ offset: true });
export type Timestamp = z.infer<typeof Timestamp>;
