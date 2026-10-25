// Mirrors OpenAPI components TransitionRequest (six variants), VersionRef, TransitionResult.
// TransitionRequestInput is the form-side input: DO-4 §5, G-11 (rating, note and reason may be absent so the server answers with the named error).
import { z } from "zod";
import { NullableText, Sha256, StateVector } from "./common.ts";
import { LessonState, SendBackTag } from "./board.ts";

export const StartReview = z.object({ action: z.literal("start_review") }).strict();
export type StartReview = z.infer<typeof StartReview>;

export const Submit = z
  .object({ action: z.literal("submit"), client_state_vector: StateVector })
  .strict();
export type Submit = z.infer<typeof Submit>;

export const Withdraw = z
  .object({ action: z.literal("withdraw"), note: NullableText.optional() })
  .strict();
export type Withdraw = z.infer<typeof Withdraw>;

export const Approve = z
  .object({
    action: z.literal("approve"),
    snapshot_hash: Sha256,
    snapshot_state_vector: StateVector,
    rating: z.enum(["usable_as_drafted", "usable_with_edits", "rewritten"]),
  })
  .strict();
export type Approve = z.infer<typeof Approve>;

export const RequestChanges = z
  .object({
    action: z.literal("request_changes"),
    tag: SendBackTag,
    note: z.string(),
    // CHG-3: optional pin; both or neither (the service answers INVALID_REQUEST for one alone).
    snapshot_hash: Sha256.optional(),
    snapshot_state_vector: StateVector.optional(),
  })
  .strict();
export type RequestChanges = z.infer<typeof RequestChanges>;

export const Reopen = z
  .object({
    action: z.literal("reopen"),
    reason: z.string(),
    snapshot_hash: Sha256.optional(),
    snapshot_state_vector: StateVector.optional(),
  })
  .strict();
export type Reopen = z.infer<typeof Reopen>;

export const TransitionRequest = z.discriminatedUnion("action", [
  StartReview,
  Submit,
  Withdraw,
  Approve,
  RequestChanges,
  Reopen,
]);
export type TransitionRequest = z.infer<typeof TransitionRequest>;

const ApproveInput = Approve.extend({ rating: Approve.shape.rating.nullish() }).strict();
const RequestChangesInput = RequestChanges.extend({ note: RequestChanges.shape.note.nullish() }).strict();
const ReopenInput = Reopen.extend({ reason: Reopen.shape.reason.nullish() }).strict();

export const TransitionRequestInput = z.discriminatedUnion("action", [
  StartReview,
  Submit,
  Withdraw,
  ApproveInput,
  RequestChangesInput,
  ReopenInput,
]);
export type TransitionRequestInput = z.infer<typeof TransitionRequestInput>;

export const VersionRef = z.object({
  version_id: z.string(),
  version_number: z.number().int(),
  content_hash: Sha256,
  state_vector: StateVector,
});
export type VersionRef = z.infer<typeof VersionRef>;

export const TransitionResult = z.object({
  lesson_id: z.string(),
  from_state: LessonState,
  to_state: LessonState,
  version: VersionRef,
  audit_id: z.string(),
  dependency_record: z
    .array(z.object({ lesson_id: z.string(), approved_hash: Sha256 }))
    .optional(),
  metrics_row_written: z.boolean().optional(),
});
export type TransitionResult = z.infer<typeof TransitionResult>;
