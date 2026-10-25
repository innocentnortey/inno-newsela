import { describe, expect, it } from "vitest";
import { LeaseLost } from "@ls/core/errors";
import { bad_wp1_draft, good_wp1_draft, make_job } from "./nodes/testing/fixtures.ts";
import { make_harness } from "./nodes/testing/harness.ts";

const good = () => ({ raw: JSON.stringify(good_wp1_draft()) });
const bad = () => ({ raw: JSON.stringify(bad_wp1_draft()) });

describe("LessonJobRunner", () => {
  it("wp1_happy_path", async () => {
    const h = make_harness([good()]);
    const out = await h.runner.run(make_job());
    expect(h.caller.requests).toHaveLength(1);
    const r = h.caller.requests[0]!;
    expect(r.ctx.purpose).toBe("lesson_draft");
    expect(r.req.alias).toBe("GENERATION");
    expect(r.req.output_mode).toBe("prompt_embedded");
    expect(r.req.max_output_tokens).toBe(32000);
    expect(out.status).toBe("ready");
    expect(out.tile_state).toBe("ready");
    expect(out.repairs).toBe(0);
    expect(h.world.versions.rows).toHaveLength(1);
    expect(h.world.versions.rows[0]!.kind).toBe("generated");
    expect(h.world.states.set_calls).toEqual([{ lesson_id: "G6.U4.L4", to: "draft" }]);
    expect(h.world.docs.docs.get("G6.U4.L4")!.seq).toBe(1);
    expect(h.world.docs.check_jobs).toBe(1);
    expect(h.world.queue.tiles).toEqual(["drafting", "checking"]);
    expect(h.finalized).toHaveLength(1);
    expect(h.world.queue.finished).toEqual([out]);
  });

  it("one_repair_then_store", async () => {
    const h = make_harness([bad(), good()]);
    const out = await h.runner.run(make_job());
    expect(h.caller.requests).toHaveLength(2);
    const r = h.caller.requests[1]!;
    expect(r.ctx.purpose).toBe("repair");
    expect(r.req.alias).toBe("REPAIR");
    expect(r.rendered.text).toContain("minutes_out_of_range");
    expect(r.rendered.text).toContain(bad_wp1_draft().title);
    expect(r.rendered.text).not.toContain("A quote is still needed here");
    expect(out.status).toBe("ready");
    expect(out.repairs).toBe(1);
    expect(h.world.queue.tiles).toEqual(["drafting", "checking", "repairing", "checking"]);
  });

  it("still_failing_after_one_repair", async () => {
    const h = make_harness([bad(), bad()]);
    const out = await h.runner.run(make_job());
    expect(h.caller.requests).toHaveLength(2);
    expect(out.status).toBe("generation_failed");
    expect(out.brakes_fired).toContain("repair_round");
    expect(out.failure_reasons).toEqual([expect.objectContaining({ check: "check_failed", check_kind: "minutes_out_of_range" })]);
    expect(h.world.states.rows.get("G6.U4.L4")!.state).toBe("generation_failed");
    expect(h.world.versions.rows).toHaveLength(0);
  });

  it("truncation_retry_and_twice", async () => {
    const a = make_harness([{ raw: "{", stop_reason: "max_tokens" }, good()]);
    const out = await a.runner.run(make_job());
    expect(a.caller.requests.map((r) => r.ctx.purpose)).toEqual(["lesson_draft", "truncation_retry"]);
    expect(a.caller.requests[1]!.req.max_output_tokens).toBe(48000);
    expect(out.status).toBe("ready");
    expect(out.truncation_retries).toBe(1);
    expect(out.repairs).toBe(0);

    const b = make_harness([{ raw: "{", stop_reason: "max_tokens" }, { raw: "{", stop_reason: "max_tokens" }]);
    const out2 = await b.runner.run(make_job());
    expect(b.caller.requests).toHaveLength(2);
    expect(out2.status).toBe("generation_failed");
    expect(out2.brakes_fired).toContain("truncation_retry");
    expect(out2.failure_reasons.map((r) => r.check)).toEqual(["truncated"]);
    expect(b.world.states.rows.get("G6.U4.L4")!.state).toBe("generation_failed");
  });

  it("reservation_refused_makes_no_call", async () => {
    for (const [cap, brake] of [["run_cap", "spend_run_cap"], ["day_cap", "spend_day_cap"], ["project_cap", "spend_project_cap"]] as const) {
      const h = make_harness([{ refuse: cap }]);
      const out = await h.runner.run(make_job());
      expect(out.cost_usd.toString()).toBe("0");
      expect(out.brakes_fired).toContain(brake);
      expect(out.failure_reasons.map((r) => r.check)).toEqual(["capped"]);
      expect(h.caller.requests).toHaveLength(1);
      expect(h.world.states.set_calls).toHaveLength(0);
      expect(h.world.versions.rows).toHaveLength(0);
    }
  });

  it("wall_clock_and_cancel", async () => {
    const h = make_harness([]);
    h.caller["script"].push({ ...good(), on_call: () => h.clock.advance(600001) });
    const out = await h.runner.run(make_job());
    expect(h.caller.requests).toHaveLength(1);
    expect(out.brakes_fired).toContain("job_wall_clock");
    expect(out.failure_reasons.map((r) => r.check)).toContain("timeout");
    expect(out.status).toBe("generation_failed");
    expect(h.world.versions.rows).toHaveLength(0);

    const c = make_harness([bad(), good()]);
    c.world.queue.cancelled = () => c.caller.requests.length >= 1;
    const out2 = await c.runner.run(make_job());
    expect(c.caller.requests).toHaveLength(1);
    expect(out2.status).toBe("cancelled");
    expect(c.world.versions.rows).toHaveLength(0);
    expect(c.world.states.set_calls).toHaveLength(0);
  });

  it("lease_lost_stops_node", async () => {
    const h = make_harness([good()]);
    h.world.queue.lease_lost_at = 2; // renewed before drafting, lost before compile-check
    await expect(h.runner.run(make_job())).rejects.toBeInstanceOf(LeaseLost);
    expect(h.world.queue.finished).toHaveLength(0);
    expect(h.world.versions.rows).toHaveLength(0);
    expect(h.finalized).toHaveLength(0);
  });
});
