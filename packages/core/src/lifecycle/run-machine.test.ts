import { describe, expect, it } from "vitest";
import type { TileState } from "@ls/schema/api/runs";
import type { JobKind, JobStatus, RunStateName } from "../ports/common.ts";
import {
  decide_run_control,
  derive_run_state,
  tile_state,
  type JobStatusView,
  type RunControlAction,
  type RunStateInput,
} from "./run-machine.ts";

function job(status: JobStatus, kind: JobKind = "lesson", tile: TileState = "queued"): JobStatusView {
  return { status, kind, tile_state: tile, failure_check: null };
}
function run(over: Partial<RunStateInput> = {}): RunStateInput {
  return { current: "running", plan_stored: true, cancelled: false, capped: false, paused: false, ...over };
}

describe("derive_and_tile", () => {
  const rows: [string, JobStatusView[], RunStateInput, RunStateName][] = [
    ["no plan", [job("queued")], run({ plan_stored: false }), "planning"],
    ["running jobs", [job("running"), job("ready")], run(), "running"],
    ["queued job", [job("queued")], run(), "running"],
    ["all ready", [job("ready"), job("ready"), job("ready", "unit_plan")], run(), "complete"],
    ["one failed", [job("ready"), job("generation_failed")], run(), "partial"],
    ["one cancelled", [job("ready"), job("cancelled")], run(), "partial"],
    ["ready and failed", [job("generation_failed"), job("ready")], run(), "partial"],
    ["candidate run, no plan, job queued (S-36)", [job("queued", "candidate")], run({ plan_stored: false, current: "planning" }), "running"],
    ["candidate run, no plan, job ready settles (S-36)", [job("ready", "candidate")], run({ plan_stored: false, current: "planning" }), "complete"],
    ["candidate run, no plan, job failed (S-36)", [job("generation_failed", "candidate")], run({ plan_stored: false }), "partial"],
    ["lesson run with unit_plan job and no plan stays planning", [job("queued", "unit_plan"), job("queued", "lesson")], run({ plan_stored: false }), "planning"],
    ["empty jobs", [], run(), "running"],
    ["only unit_plan job pending", [job("queued", "unit_plan")], run(), "running"],
    ["capped flag", [job("running")], run({ capped: true }), "capped"],
    ["paused flag", [job("running")], run({ paused: true }), "paused"],
    ["cancelled flag", [job("running")], run({ cancelled: true }), "cancelled"],
    ["cancelled and capped", [job("running")], run({ cancelled: true, capped: true }), "cancelled"],
    ["capped and paused", [job("running")], run({ capped: true, paused: true }), "capped"],
  ];
  it.each(rows)("derive_run_state: %s", (_n, jobs, r, expected) => {
    expect(derive_run_state(jobs, r)).toBe(expected);
  });

  it("tile_state maps every job status", () => {
    expect(tile_state(job("queued", "lesson", "drafting"))).toBe("queued");
    expect(tile_state(job("ready", "lesson", "drafting"))).toBe("ready");
    expect(tile_state(job("generation_failed"))).toBe("failed");
    expect(tile_state(job("cancelled"))).toBe("failed");
    expect(tile_state(job("running", "lesson", "checking"))).toBe("checking");
    expect(tile_state(job("running", "lesson", "queued"))).toBe("drafting");
    expect(tile_state(job("running", "unit_plan", "queued"))).toBe("planning");
  });
});

describe("run_control_matrix", () => {
  const states: RunStateName[] = ["planning", "running", "complete", "partial", "capped", "paused", "cancelled"];
  const actions: RunControlAction[] = ["cancel", "retry_failed", "resume"];
  const allowed: Record<string, RunStateName> = {
    "cancel:planning": "cancelled",
    "cancel:running": "cancelled",
    "cancel:paused": "cancelled",
    "retry_failed:partial": "running",
    "resume:paused": "running",
  };
  for (const a of actions) {
    for (const s of states) {
      it(`${a} from ${s}`, () => {
        const d = decide_run_control(s, a);
        const to = allowed[`${a}:${s}`];
        if (to) {
          expect(d.allowed).toBe(true);
          expect(d.to_state).toBe(to);
          expect(d.refusal).toBeNull();
          expect(d.cancel_jobs).toBe(a === "cancel");
          expect(d.requeue_failed).toBe(a === "retry_failed");
        } else {
          expect(d).toEqual({ allowed: false, to_state: null, refusal: "INVALID_TRANSITION", requeue_failed: false, cancel_jobs: false });
        }
      });
    }
  }
});
