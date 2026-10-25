// Run state machine (DO-4 section 8). Pure: no clock, no IO, no randomness.
import type { ErrorCode } from "@ls/schema/api/common";
import type { TileState } from "@ls/schema/api/runs";
import type { JobKind, JobStatus, RunStateName } from "../ports/common.ts";

export type RunControlAction = "cancel" | "retry_failed" | "resume";

export interface JobStatusView {
  status: JobStatus;
  tile_state: TileState;
  kind: JobKind;
  failure_check: string | null;
}

export interface RunStateInput {
  current: RunStateName;
  plan_stored: boolean;
  cancelled: boolean;
  capped: boolean;
  paused: boolean;
}

export interface RunControlDecision {
  allowed: boolean;
  to_state: RunStateName | null;
  refusal: Extract<ErrorCode, "INVALID_TRANSITION"> | null;
  requeue_failed: boolean;
  cancel_jobs: boolean;
}

const RUNNING_TILES: readonly TileState[] = ["planning", "drafting", "checking", "repairing"];

export function tile_state(job: JobStatusView): TileState {
  switch (job.status) {
    case "queued":
      return "queued";
    case "running":
      if (RUNNING_TILES.includes(job.tile_state)) return job.tile_state;
      return job.kind === "unit_plan" ? "planning" : "drafting";
    case "ready":
      return "ready";
    case "generation_failed":
    case "cancelled":
      return "failed";
  }
}

// Flag precedence: cancelled > capped > paused (decision D-1).
export function derive_run_state(jobs: readonly JobStatusView[], run: RunStateInput): RunStateName {
  if (run.cancelled) return "cancelled";
  if (run.capped) return "capped";
  if (run.paused) return "paused";
  if (!run.plan_stored) return "planning";
  const work = jobs.filter((j) => j.kind !== "unit_plan");
  if (work.length === 0) return "running";
  if (work.some((j) => j.status === "queued" || j.status === "running")) return "running";
  return work.every((j) => j.status === "ready") ? "complete" : "partial";
}

const INVALID: RunControlDecision = {
  allowed: false,
  to_state: null,
  refusal: "INVALID_TRANSITION",
  requeue_failed: false,
  cancel_jobs: false,
};

export function decide_run_control(current: RunStateName, action: RunControlAction): RunControlDecision {
  if (action === "cancel" && (current === "planning" || current === "running" || current === "paused")) {
    return { allowed: true, to_state: "cancelled", refusal: null, requeue_failed: false, cancel_jobs: true };
  }
  if (action === "retry_failed" && current === "partial") {
    return { allowed: true, to_state: "running", refusal: null, requeue_failed: true, cancel_jobs: false };
  }
  if (action === "resume" && current === "paused") {
    return { allowed: true, to_state: "running", refusal: null, requeue_failed: false, cancel_jobs: false };
  }
  return { ...INVALID };
}
