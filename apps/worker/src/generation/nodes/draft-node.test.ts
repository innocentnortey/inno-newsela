import { describe, expect, it } from "vitest";
import { initial_state } from "@ls/core/pipeline/state";
import type { UnitPlanDraft } from "@ls/schema/unit-plan";
import { DraftNode } from "./draft-node.ts";
import type { JobState } from "./job-state.ts";
import { good_wp1_draft, id, load_row, make_job, make_renderer, make_repos, make_settings } from "./testing/fixtures.ts";
import { ScriptedPaidCaller } from "./testing/scripted-paid-caller.ts";

function node(caller: ScriptedPaidCaller, repos = make_repos(load_row("wp1")), render = make_renderer()) {
  return new DraftNode(caller, render, repos.outlines, repos.runs, repos.standards, repos.prompts, make_settings(), caller);
}

describe("DraftNode", () => {
  it("checkpoint_no_repay", async () => {
    const caller = new ScriptedPaidCaller([]);
    const job = make_job();
    const raw = JSON.stringify(good_wp1_draft());
    const stored = caller.seed_completed(job.job_id, "lesson_draft", 1, raw);
    const s = await node(caller).run(initial_state(job, 0) as JobState);
    expect(caller.requests).toHaveLength(0);
    expect(s.context!.raw_output).toBe(raw);
    expect(s.call_ids).toContain(stored.model_call_id);
  });

  it("checkpoint_no_repay_after_truncation", async () => {
    const caller = new ScriptedPaidCaller([]);
    const job = make_job();
    caller.seed_completed(job.job_id, "lesson_draft", 1, "{", "max_tokens");
    const retry = caller.seed_completed(job.job_id, "truncation_retry", 1, "{}");
    const s = await node(caller).run(initial_state(job, 0) as JobState);
    expect(caller.requests).toHaveLength(0);
    expect(s.truncation_retries).toBe(1);
    expect(s.context!.draft_call).toBe(retry);
  });

  it("pinned_choices_and_plan_wiring", async () => {
    const row = load_row("wp1");
    const plan = { entries: [{ lesson_id: "G6.U4.L4", day: 4, purpose: "p", routines: [], hands_forward: "h", performance_task_thread: "t" }, { lesson_id: "G6.U4.L9", day: 9, purpose: "other", routines: [], hands_forward: "h", performance_task_thread: "t" }] } as unknown as UnitPlanDraft;
    const parent = id("run", 7);
    const repos = make_repos(row, plan, parent);
    const seen: { reviewer_note: string | null; example_set_id: string | null; plan_ids: string[] }[] = [];
    const real = make_renderer();
    const render = { render_lesson_draft: (i: Parameters<typeof real.render_lesson_draft>[0]) => (seen.push({ reviewer_note: i.reviewer_note, example_set_id: i.example_set_id, plan_ids: i.plan_entries.map((e) => e.lesson_id) }), real.render_lesson_draft(i)) };
    const caller = new ScriptedPaidCaller([{ raw: "{}" }]);
    const job = make_job({ kind: "candidate", reviewer_note: "make it shorter" });
    await new DraftNode(caller, render, repos.outlines, repos.runs, repos.standards, repos.prompts, make_settings(), caller).run(initial_state(job, 0) as JobState);
    expect(repos.runs.pinned_requests).toEqual([job.run_id]);
    expect(repos.runs.unit_plan_requests).toEqual([parent]);
    expect(seen).toEqual([{ reviewer_note: "make it shorter", example_set_id: null, plan_ids: ["G6.U4.L4"] }]);
  });

  it("sub_codes_of_listed_parents_reach_the_prompt", async () => {
    const parent_row = { ...load_row("wp1"), focus_codes: ["L.6.4"] };
    const caller = new ScriptedPaidCaller([]);
    const job = make_job();
    caller.seed_completed(job.job_id, "lesson_draft", 1, JSON.stringify(good_wp1_draft()));
    const s = await node(caller, make_repos(parent_row)).run(initial_state(job, 0) as JobState);
    expect(s.context!.standards.map((x) => x.code).sort()).toEqual(["L.6.4", "L.6.4.a", "L.6.4.b"]);
    // A row that lists only leaves adds nothing.
    const leaf_row = load_row("wp1");
    const caller2 = new ScriptedPaidCaller([]);
    caller2.seed_completed(job.job_id, "lesson_draft", 1, JSON.stringify(good_wp1_draft()));
    const s2 = await node(caller2, make_repos(leaf_row)).run(initial_state(job, 0) as JobState);
    expect(s2.context!.standards.map((x) => x.code).sort()).toEqual([...leaf_row.focus_codes].sort());
  });
});

