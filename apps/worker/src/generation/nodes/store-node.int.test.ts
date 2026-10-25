import { describe, expect, it } from "vitest";
import type { LessonId } from "@ls/core/ports/common";
import { initial_state } from "@ls/core/pipeline/state";
import { CompileCheckNode } from "./compile-check-node.ts";
import type { JobContext, JobState } from "./job-state.ts";
import { StoreNode } from "./store-node.ts";
import { CHECK_POLICY, load_draft, load_row, make_job, make_loader, row_context_of, standard_rows } from "./testing/fixtures.ts";
import { as_ports, make_world } from "./testing/memory-store.ts";
import { ulid_body } from "./testing/scripted-paid-caller.ts";
import Decimal from "decimal.js";

// The real repos (NL-36/42/43) are not merged; the memory store's transaction restores all four stores on a throw,
// which is the same all-or-nothing contract the single tx.with_tx gives (G-25).
async function state(): Promise<JobState> {
  const row = load_row("wp4");
  const draft = load_draft("wp4");
  const call = { model_call_id: `mc_${ulid_body(1)}`, purpose: "lesson_draft", attempt: 1, raw_output: JSON.stringify(draft), stop_reason: "end_turn", usage: { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 }, cost_usd: new Decimal("0.1"), served_model: "m", retries: 0 } as JobContext["calls"][number];
  const context: JobContext = { row_context: row_context_of(row), standards: standard_rows(row), calls: [call], draft_call: call, draft_max_output_tokens: 32000, effort: "high", raw_output: call.raw_output, provider_error: null };
  const base: JobState = { ...(initial_state(make_job({ lesson_id: row.lesson_id as LessonId }), 0) as JobState), context, call_ids: [call.model_call_id] };
  return new CompileCheckNode(make_loader(row), [], CHECK_POLICY).run(base);
}

describe("StoreNode transaction", () => {
  it("store_is_idempotent_and_atomic", async () => {
    const lesson = "G6.U4.L31" as LessonId;
    const w = make_world();
    w.states.seed(lesson, "generation_failed");
    const p = as_ports(w);
    const node = new StoreNode(p.versions, p.states, p.docs, p.flags, w.tx);
    const first = await node.run(await state());
    const second = await node.run(await state());
    expect(w.versions.rows).toHaveLength(1);
    expect(w.docs.docs.size).toBe(1);
    expect(w.docs.check_jobs).toBe(1);
    expect(w.flags.rows).toHaveLength(1);
    expect((second.outcome as { version_id: string }).version_id).toBe((first.outcome as { version_id: string }).version_id);

    const r = make_world();
    r.states.seed(lesson, "generation_failed");
    r.flags.fail_next = true;
    const rp = as_ports(r);
    await expect(new StoreNode(rp.versions, rp.states, rp.docs, rp.flags, r.tx).run(await state())).rejects.toThrow("armed");
    expect(r.versions.rows).toHaveLength(0);
    expect(r.docs.docs.size).toBe(0);
    expect(r.docs.check_jobs).toBe(0);
    expect(r.states.rows.get(lesson)!.state).toBe("generation_failed");
  });
});
