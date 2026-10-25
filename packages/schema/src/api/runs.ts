// Mirrors OpenAPI components for the run cards (CON runs: start, progress, control, plan, summary).
import { z } from "zod";
import { NullableText, Sha256, Timestamp } from "./common.ts";

export const RunState = z.enum([
  "planning",
  "running",
  "complete",
  "partial",
  "capped",
  "paused",
  "cancelled",
]);
export type RunState = z.infer<typeof RunState>;

export const TileState = z.enum([
  "queued",
  "planning",
  "drafting",
  "checking",
  "repairing",
  "ready",
  "failed",
]);
export type TileState = z.infer<typeof TileState>;

export const RunScope = z.object({
  kind: z.enum(["all", "rows", "unfinished_of_run"]),
  rows: z.array(z.number().int()).optional(),
  run_id: z.string().optional(),
});
export type RunScope = z.infer<typeof RunScope>;

export const StartRunRequest = z
  .object({
    outline_version_id: z.string(),
    mode: z.enum(["run", "trial"]),
    scope: RunScope,
    lesson_id: z.string().nullable().optional(),
    prompt_version_id: z.string(),
    cap_usd: z.number().gt(0),
  })
  .strict();
export type StartRunRequest = z.infer<typeof StartRunRequest>;

export const Run = z.object({
  run_id: z.string(),
  state: RunState,
  mode: z.enum(["run", "trial"]),
  scope: RunScope,
  outline_version_id: z.string(),
  prompt_version_id: z.string(),
  choices_hash: Sha256,
  cap_usd: z.number(),
  spent_usd: z.number(),
  created_by: z.string(),
  created_at: Timestamp,
});
export type Run = z.infer<typeof Run>;

export const FailureReason = z.object({
  check: z.enum([
    "schema_invalid",
    "truncated",
    "rate_limited",
    "provider_error",
    "timeout",
    "compile_error",
    "check_failed",
    "cancelled",
    "capped",
  ]),
  check_kind: z.string().nullable().optional(),
  message: z.string(),
});
export type FailureReason = z.infer<typeof FailureReason>;

export const Tile = z.object({
  lesson_id: z.string(),
  lesson_key: z.string(),
  number: z.number().int().nullable(),
  title: z.string(),
  tile_state: TileState,
  attempts: z.number().int(),
  repair_used: z.boolean(),
  truncation_retry_used: z.boolean(),
  failure_reasons: z.array(FailureReason),
  cost_usd: z.number(),
  openable: z.boolean(),
});
export type Tile = z.infer<typeof Tile>;

export const RunProgress = z.object({
  run_id: z.string(),
  state: RunState,
  paused_reason: z
    .object({
      check: z.string(),
      lesson_ids: z.array(z.string()),
    })
    .nullable(),
  capped_by: z.enum(["run_cap", "day_cap", "project_cap"]).nullable(),
  spent_usd: z.number(),
  reserved_usd: z.number(),
  cap_usd: z.number(),
  concurrency_cap: z.number().int(),
  queued_ahead: z.number().int(),
  counts_by_tile_state: z.record(z.string(), z.number().int()),
  updated_at: Timestamp,
  tiles: z.array(Tile),
});
export type RunProgress = z.infer<typeof RunProgress>;

export const RunControlRequest = z
  .object({
    action: z.enum(["cancel", "retry_failed", "resume"]),
  })
  .strict();
export type RunControlRequest = z.infer<typeof RunControlRequest>;

export const RunControlResult = z.object({
  run_id: z.string(),
  state: RunState,
  requeued_lessons: z.array(z.string()),
});
export type RunControlResult = z.infer<typeof RunControlResult>;

export const PlanEntry = z.object({
  lesson_id: z.string(),
  day: z.number().int(),
  purpose: z.string(),
  routines: z.array(z.string()),
  hands_forward: z.string(),
  performance_task_thread: z.string(),
});
export type PlanEntry = z.infer<typeof PlanEntry>;

export const LessonLink = z.object({
  link_id: z.string(),
  from_lesson_id: z.string(),
  from_address: z.string(),
  to_lesson_id: z.string(),
  to_slot_id: z.string(),
  label: z.string(),
});
export type LessonLink = z.infer<typeof LessonLink>;

export const UnitPlan = z.object({
  run_id: z.string(),
  state: z.enum(["planning", "stored", "failed"]),
  stored_at: Timestamp.nullable(),
  entries: z.array(PlanEntry),
  lesson_links: z.array(LessonLink),
});
export type UnitPlan = z.infer<typeof UnitPlan>;

export const RunSummary = z.object({
  run_id: z.string(),
  state: RunState,
  n: z.number().int(),
  wall_time_seconds: z.number().int(),
  cost_usd: z.number(),
  cost_per_ready_lesson_usd: z.number().nullable(),
  lessons: z.object({ ready: z.number().int(), failed: z.number().int() }),
  retries: z.number().int(),
  failures_by_reason: z.array(z.object({ reason: z.string(), count: z.number().int() })),
  placeholders_left: z.number().int(),
  calls_lost_in_flight: z.number().int(),
  brakes_fired: z.array(z.object({ brake: z.string(), count: z.number().int() })),
  truncation_retries: z.number().int(),
  p95_minutes_per_lesson: z.number().nullable(),
  target_minutes_per_lesson: z.number(),
  report_path: NullableText,
});
export type RunSummary = z.infer<typeof RunSummary>;
