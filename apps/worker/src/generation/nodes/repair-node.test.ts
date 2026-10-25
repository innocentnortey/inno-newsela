import { describe, expect, it } from "vitest";
import { initial_state } from "@ls/core/pipeline/state";
import { RepairNode } from "./repair-node.ts";
import type { JobContext, JobState } from "./job-state.ts";
import { load_row, make_job, make_renderer, make_repos, make_settings, row_context_of, standard_rows } from "./testing/fixtures.ts";
import { ScriptedPaidCaller } from "./testing/scripted-paid-caller.ts";

describe("RepairNode", () => {
  it("checkpoint_no_repay", async () => {
    const row = load_row("wp1");
    const caller = new ScriptedPaidCaller([]);
    const job = make_job();
    const stored = caller.seed_completed(job.job_id, "repair", 1, '{"fixed":true}');
    const context: JobContext = { row_context: row_context_of(row), standards: standard_rows(row), calls: [], draft_call: null, draft_max_output_tokens: 32000, effort: "high", raw_output: "{}", provider_error: null };
    const state: JobState = { ...(initial_state(job, 0) as JobState), context };
    const repos = make_repos(row);
    const s = await new RepairNode(caller, make_renderer(), repos.prompts, make_settings(), caller).run(state);
    expect(caller.requests).toHaveLength(0);
    expect(s.repair_rounds).toBe(1);
    expect(s.context!.raw_output).toBe('{"fixed":true}');
    expect(s.call_ids).toEqual([stored.model_call_id]);
  });
});
