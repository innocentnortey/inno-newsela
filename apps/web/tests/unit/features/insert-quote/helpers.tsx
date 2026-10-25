import { vi } from "vitest";
import { ApiError } from "@/lib/api-client";

export const GET = vi.fn();
export const POST = vi.fn();

export const lessonWith = (state: string, ...content: unknown[]) => ({
  lesson_id: "G6.U4.L4",
  state,
  sections: [{ address: "G6.U4.L4.LearningInAction.PartA", name: "Part A", minutes: 15, content: { type: "doc", content } }],
});
export const QUOTE = { type: "quote_placeholder", attrs: { slot_id: "s1", reason: "Reviewer to insert one sentence" } };
export const EXCERPT = { type: "excerpt_slot", attrs: { slot_id: "s1", rights: "to-clear", source_ref: null } };
export const NINE = "The cat sat quietly on the warm window sill";
export const THIRTEEN = `${NINE} and then it left`;
export const err = (code: ApiError["code"], details: Record<string, unknown> = {}) => new ApiError({ status: 422, code, message: "msg", details });
export const OK = { slot_id: "s1", still_blocking: false, blocking_reason: null, linked_lessons: [] };
