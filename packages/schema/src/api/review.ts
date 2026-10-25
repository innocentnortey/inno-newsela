// Mirrors OpenAPI components Provenance, VersionEntry, AuditRow, LessonHistory, Heartbeat (history and presence cards).
import { z } from "zod";
import { NullableText, Sha256, Timestamp } from "./common.ts";
import { LessonState } from "./board.ts";

export const Provenance = z.object({
  outline_row_hash: Sha256,
  prompt_version_id: z.string(),
  model: z.string().nullable(),
  parameters: z.record(z.string(), z.unknown()).nullable(),
  schema_version: z.number().int(),
  example_set_id: z.string().nullable(),
  run_id: z.string().nullable(),
  cost_usd: z.number(),
  derived_from_version_id: z.string().nullable(),
});
export type Provenance = z.infer<typeof Provenance>;

export const VersionEntry = z.object({
  version_id: z.string(),
  version_number: z.number().int(),
  kind: z.enum(["generated", "candidate", "submit", "approval", "reopen"]),
  content_hash: Sha256,
  created_at: Timestamp,
  created_by: z.string(),
  adopted: z.boolean().nullable(),
  provenance: Provenance,
});
export type VersionEntry = z.infer<typeof VersionEntry>;

export const AuditRow = z.object({
  at: Timestamp,
  user: z.string(),
  action: z.string(),
  from_state: LessonState.nullable(),
  to_state: LessonState.nullable(),
  version_hash: Sha256,
  reason: NullableText,
});
export type AuditRow = z.infer<typeof AuditRow>;

export const LessonHistory = z.object({
  versions: z.array(VersionEntry),
  audit: z.array(AuditRow),
  ai_spans: z.array(z.object({ accepted_by: z.string(), at: Timestamp })),
});
export type LessonHistory = z.infer<typeof LessonHistory>;

export const Heartbeat = z.object({
  tab_id: z.string(),
  focused: z.boolean(),
  visible: z.boolean(),
  last_input_at: Timestamp,
  sent_at: Timestamp,
  version_id: z.string(),
});
export type Heartbeat = z.infer<typeof Heartbeat>;
