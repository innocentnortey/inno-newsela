import { describe, expect, it } from "vitest";
import { CheckContextLoader } from "@ls/core/checks/context-loader";
import { reading_lesson } from "@ls/core/checks/test-helpers";
import type { StoredCall } from "./replay-finals.ts";
import { make_replay_env, type ReplayJob } from "./replay-finals-lesson.ts";
import { LESSON, OV1, OV2, ROW1, ROW2, build_world, good_draft_json, open_flag } from "./replay-finals-world.ts";

const call = (o: Partial<StoredCall> = {}): StoredCall => ({ id: "mc_1", purpose: "lesson_draft", attempt: 1, status: "completed", stop_reason: "end_turn", raw_output: good_draft_json(), sent_at: "2026-10-26T10:00:00.000000Z", ...o });
const job = (calls: StoredCall[] = [call()]): ReplayJob => ({
  job_id: "job_1", run_id: "run_test", lesson_id: LESSON, status: "ready", calls,
  historical: { tile_state: "ready", repairs: 0, truncation_retries: 0, failure_reasons: [] },
});
const env = (w: ReturnType<typeof build_world>, o: Partial<Parameters<typeof make_replay_env>[2]> = {}) =>
  make_replay_env(w.ports, w.pin, { lift: false, review_context: "generation_time", messages: false, first_stored_at: async () => "2026-10-26T09:00:00.000Z", ...o });

describe("replay_job", () => {
  it("test_verdict_unchanged_by_later_upload_and_changed_choices", async () => {
    const a = (await env(build_world()).replay_job(job(), ["effective"])).records[0]!;
    const b = (await env(build_world({ later_upload: true })).replay_job(job(), ["effective"])).records[0]!;
    expect(a.gen).not.toBeNull();
    expect(b.gen).toEqual(a.gen);
    expect(b.review).toEqual(a.review);
    expect(b.schema_issues).toEqual(a.schema_issues);
    expect(b.compile_error).toEqual(a.compile_error);
    expect(a.identity?.loader_outline_version).toBe(OV1);
    expect(b.identity?.loader_outline_version).toBe(OV1);
    expect(a.identity?.unpinned_would_differ).toBe(false);
    expect(b.identity?.unpinned_would_differ).toBe(true);
  });
  it("test_unpinned_loader_would_follow_the_later_upload", async () => {
    const w = build_world({ later_upload: true });
    const p = w.ports;
    const plain = new CheckContextLoader(p.outlines, p.standards, p.graph, p.reader, p.suggestions, p.flags, p.alignment, p.clock);
    const ctx = await plain.load(LESSON, reading_lesson({ lesson_id: LESSON }), "h".repeat(64) as never);
    expect(ctx.outline_version_id).toBe(OV2);
    expect(ctx.row.title).toBe(ROW2.title);
    expect(ctx.row.title).not.toBe(ROW1.title);
  });
  it("test_open_safety_flag_blocks_only_with_current_review_context", async () => {
    const w = () => build_world({ flags: [open_flag()] });
    const gt = (await env(w(), { review_context: "generation_time" }).replay_job(job(), ["effective"])).records[0]!;
    const cur = (await env(w(), { review_context: "current" }).replay_job(job(), ["effective"])).records[0]!;
    expect(gt.gen!.map((f) => f.kind)).not.toContain("safety_flag_open");
    expect(cur.gen!.filter((f) => f.level === "blocking").map((f) => f.kind)).toContain("safety_flag_open");
  });
  it("test_state_probe_names_safety_flag_open", async () => {
    for (const mode of ["generation_time", "current"] as const) {
      const r = (await env(build_world({ flags: [open_flag()] }), { review_context: mode }).replay_job(job(), ["effective"])).records[0]!;
      expect(r.state_probe?.gen_added_blocking_kinds).toContain("safety_flag_open");
      expect(r.state_probe?.review_state.safety_flags).toEqual([`sf:${LESSON}:39`]);
      expect(r.state_probe?.review_state.first_stored_at).toBe("2026-10-26T09:00:00.000Z");
    }
  });
  it("test_cross_lesson_fields_are_always_cleared_and_counted", async () => {
    const e = env(build_world(), { review_context: "current" });
    await e.replay_job(job(), ["effective"]);
    // the fake graph has one dependency (waits_on) and one dependant, but no stored rows for them: counts are of what the loader built
    expect(e.trace_omissions()).toEqual({ links: 0, linked_lessons: 0, dependency_states: 1 });
  });
  it("test_missing_output_gives_a_no_output_record", async () => {
    const { records, input } = await env(build_world()).replay_job(job([]), ["effective", "last_repair"]);
    expect(records.map((r) => r.no_output_reason)).toEqual(["no_draft_call", "no_repair_call"]);
    expect(records[0]).toMatchObject({ gen: null, review: null, identity: null, compile_error: null });
    expect(input.selections.map((s) => s.reason)).toEqual(["no_draft_call", "no_repair_call"]);
  });
  it("test_identity_error_aborts_the_replay", async () => {
    const e = env(build_world({ loader_follows: OV2 }));
    await expect(e.replay_job(job(), ["effective"])).rejects.toMatchObject({ code: "outline_version_mismatch" });
  });
  it("test_records_never_carry_matched_or_message_by_default", async () => {
    const w = () => build_world({ flags: [open_flag()] });
    const quiet = (await env(w(), { review_context: "current" }).replay_job(job(), ["effective"])).records[0]!;
    const loud = (await env(w(), { review_context: "current", messages: true }).replay_job(job(), ["effective"])).records[0]!;
    expect(JSON.stringify(quiet)).not.toContain('"message"');
    expect(JSON.stringify(quiet)).not.toContain('"matched"');
    expect(loud.gen!.some((f) => typeof f.message === "string")).toBe(true);
  });
  it("test_non_json_output_is_a_schema_failure", async () => {
    const r = (await env(build_world()).replay_job(job([call({ raw_output: "not json" })]), ["effective"])).records[0]!;
    expect(r).toMatchObject({ gen: null, schema_issues: ["$"], no_output_reason: null });
  });
});
