import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { initial_state } from "@ls/core/pipeline/state";
import type { LessonId } from "@ls/core/ports/common";
import { CompileCheckNode } from "./compile-check-node.ts";
import type { JobContext, JobState } from "./job-state.ts";
import { StoreNode } from "./store-node.ts";
import { CHECK_POLICY, good_wp1_draft, load_draft, load_row, make_job, make_loader, row_context_of, standard_rows, type Wp } from "./testing/fixtures.ts";
import { as_ports, make_world } from "./testing/memory-store.ts";
import { ulid_body } from "./testing/scripted-paid-caller.ts";

async function ready_state(wp: Wp, job = make_job()): Promise<JobState> {
  const row = load_row(wp);
  const draft = wp === "wp1" ? good_wp1_draft() : load_draft(wp);
  const call = (n: number, cost: string) => ({
    model_call_id: `mc_${ulid_body(n)}`, purpose: n === 1 ? "lesson_draft" : "repair", attempt: 1, raw_output: JSON.stringify(draft), stop_reason: "end_turn",
    usage: { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 }, cost_usd: new Decimal(cost), served_model: "claude-test-1", retries: 0,
  }) as JobContext["calls"][number];
  const calls = [call(1, "0.10"), call(2, "0.25")];
  const context: JobContext = { row_context: row_context_of(row), standards: standard_rows(row), calls, draft_call: calls[0]!, draft_max_output_tokens: 32000, effort: "high", raw_output: JSON.stringify(draft), provider_error: null };
  const base: JobState = { ...(initial_state({ ...job, lesson_id: row.lesson_id as LessonId }, 0) as JobState), context, call_ids: calls.map((c) => c.model_call_id), repair_rounds: 1 };
  // rules: none, so the fixture's open placeholders do not block compile; this test only needs a compiled lesson
  return new CompileCheckNode(make_loader(row), [], CHECK_POLICY).run(base);
}
const store_of = (w: ReturnType<typeof make_world>) => {
  const p = as_ports(w);
  return new StoreNode(p.versions, p.states, p.docs, p.flags, w.tx);
};

describe("StoreNode", () => {
  it("provenance_and_flags", async () => {
    const w = make_world();
    const s1 = await ready_state("wp1");
    const out = await store_of(w).run(s1);
    const v = w.versions.rows[0]!;
    expect(v.provenance.model_call_ids).toEqual(s1.call_ids);
    expect(v.provenance.cost_usd.toString()).toBe("0.35");
    expect(v.provenance.example_set_id).toBeNull();
    expect(v.provenance.run_id).toBe(s1.job.run_id);
    expect(v.provenance.parameters).toMatchObject({ output_mode: "prompt_embedded" });
    expect(v.content_hash).toBe(s1.compiled!.content_hash);
    expect(w.flags.rows).toHaveLength(0);
    expect((out.outcome as { version_id: string }).version_id).toBe(v.version_id);

    const w4 = make_world();
    await store_of(w4).run(await ready_state("wp4"));
    expect(w4.flags.rows).toHaveLength(1);
    expect(w4.flags.rows[0]!.source_row).toBe(39);
  });

  it("candidate_store", async () => {
    const lesson = "G6.U4.L4" as LessonId;
    // lesson already has v1: the candidate is a candidate; no seed, no state change
    const w = make_world();
    w.states.seed(lesson, "in_review");
    await store_of(w).run(await ready_state("wp1", make_job({ idempotency_key: "g" })));
    const base_set_calls = w.states.set_calls.length;
    const docs_before = w.docs.docs.size;
    const cand = await ready_state("wp1", make_job({ kind: "candidate", idempotency_key: "c" }));
    await store_of(w).run(cand);
    expect(w.versions.rows.map((r) => r.kind)).toEqual(["generated", "candidate"]);
    expect(w.states.set_calls.length).toBe(base_set_calls);
    expect(w.docs.docs.size).toBe(docs_before);

    // generation_failed with no version: the candidate becomes v1
    const f = make_world();
    f.states.seed(lesson, "generation_failed");
    await store_of(f).run(await ready_state("wp1", make_job({ kind: "candidate", idempotency_key: "c2" })));
    expect(f.versions.rows.map((r) => r.kind)).toEqual(["generated"]);
    expect(f.states.rows.get(lesson)!.state).toBe("draft");
    expect(f.docs.docs.has(lesson)).toBe(true);

    // same key twice returns the first version
    const again = await store_of(f).run(await ready_state("wp1", make_job({ kind: "candidate", idempotency_key: "c2" })));
    expect(f.versions.rows).toHaveLength(1);
    expect((again.outcome as { version_id: string }).version_id).toBe(f.versions.rows[0]!.version_id);
  });
});
