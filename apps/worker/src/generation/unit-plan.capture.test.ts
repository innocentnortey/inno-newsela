import { describe, expect, it } from "vitest";
import { build_job, valid_plan_json } from "./testing/unit-plan-fakes.ts";
import { make_rows } from "./testing/unit-plan-fixtures.ts";

describe("unit_plan_capture_component", () => {
  it("records the call, then the stored plan, before any lesson claim", async () => {
    const b = build_job({ script: [valid_plan_json(make_rows(47))] });
    const events: string[] = [];
    b.calls.on_insert = () => events.push("model_call_inserted");
    b.runs.on_store = () => events.push("plan_stored");
    await b.job.run(b.claimed);
    if (b.runs.plan_stored_at !== null) events.push("lesson_claimed");

    expect(events).toEqual(["model_call_inserted", "plan_stored", "lesson_claimed"]);
    expect(b.runs.stored?.plan.entries).toHaveLength(47);
    const row = b.calls.rows[0]!;
    expect(row.rendered_prompt.length).toBeGreaterThan(0);
    expect(row.raw_output.length).toBeGreaterThan(0);
    expect(row.model_call_id).toBe(b.runs.stored?.model_call_id);
    expect(b.paid.requests[0]!.run_id).toBe(b.claimed.run_id);
    expect(b.paid.requests[0]!.ctx.run_id).toBe(b.claimed.run_id);
  });
});
