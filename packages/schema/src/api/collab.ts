// Mirrors x-collaboration-channel.server_messages (CON-12): stored, refused, mode.
import { z } from "zod";
import { Sha256, StateVector, Timestamp } from "./common.ts";
import { LessonState } from "./board.ts";

export const StoredMessage = z.object({
  type: z.literal("stored"),
  content_hash: Sha256,
  state_vector: StateVector,
  stored_at: Timestamp,
});
export type StoredMessage = z.infer<typeof StoredMessage>;

export const ModeMessage = z.object({
  type: z.literal("mode"),
  mode: z.enum(["editable", "read_only"]),
  state: LessonState,
});
export type ModeMessage = z.infer<typeof ModeMessage>;

export const RefusedMessage = z.object({
  type: z.literal("refused"),
  code: z.literal("LESSON_LOCKED"),
  message: z.string(),
  refused_from: StateVector,
});
export type RefusedMessage = z.infer<typeof RefusedMessage>;
