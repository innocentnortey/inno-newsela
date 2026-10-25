// AC-2. Uses an in-memory queue double that encodes the R-8 gate (lesson claims need plan_stored_at);
// the real RunRepo/JobQueue are not on main yet. See plan NL-31 Open item 1.
import { describe, expect, it } from "vitest";
import type { JobRow } from "@ls/core/ports/job-queue";
import { MemoryClock, build_job, valid_plan_json, type BuiltJob } from "./testing/unit-plan-fakes.ts";
import { make_rows } from "./testing/unit-plan-fixtures.ts";

class PlanGatedQueue {
  started_at: Date | null = null;
  constructor(
    private readonly b: BuiltJob,
    private readonly clock: MemoryClock,
  ) {}
  async claim(): Promise<JobRow | null> {
    if (this.b.runs.plan_stored_at === null) return null;
    const lesson = (await this.b.queue.jobs_for_run(this.b.claimed.run_id)).find((j) => j.kind === "lesson");
    if (lesson === undefined) return null;
    this.started_at = this.clock.tick();
    return { ...lesson, status: "running", started_at: this.started_at };
  }
}

describe("plan_before_first_claim", () => {
  it("lesson jobs are unclaimable until the plan is stored, and stay so on failure", async () => {
    const clock = new MemoryClock();
    const good = build_job({ script: [valid_plan_json(make_rows(47))], clock });
    const gate = new PlanGatedQueue(good, clock);
    expect(await gate.claim()).toBeNull();
    expect(await gate.claim()).toBeNull();
    await good.job.run(good.claimed);
    const claimed = await gate.claim();
    expect(claimed).not.toBeNull();
    expect(gate.started_at!.getTime()).toBeGreaterThan(good.runs.plan_stored_at!.getTime());

    const bad = build_job({ script: ["nope", "nope"], clock });
    const bad_gate = new PlanGatedQueue(bad, clock);
    await bad.job.run(bad.claimed);
    expect(await bad_gate.claim()).toBeNull();
  });
});
