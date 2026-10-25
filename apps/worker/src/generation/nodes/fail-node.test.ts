import { describe, expect, it } from "vitest";
import { initial_state, with_brake } from "@ls/core/pipeline/state";
import type { LessonId } from "@ls/core/ports/common";
import { FailNode } from "./fail-node.ts";
import type { JobState } from "./job-state.ts";
import { make_job } from "./testing/fixtures.ts";
import { as_ports, make_world } from "./testing/memory-store.ts";
import { ulid_body } from "./testing/scripted-paid-caller.ts";

const lesson = "G6.U4.L4" as LessonId;
const mk = (kind: "lesson" | "candidate", calls: number): JobState => ({
  ...(initial_state(make_job({ kind }), 0) as JobState),
  call_ids: Array.from({ length: calls }, (_, i) => `mc_${ulid_body(i + 1)}`),
});
const node = (w: ReturnType<typeof make_world>) => {
  const p = as_ports(w);
  return new FailNode(p.states, p.versions, w.tx);
};
const stored_v1 = async (w: ReturnType<typeof make_world>) => {
  await w.versions.write_generated_version({ lesson_id: lesson, kind: "generated", idempotency_key: "k" } as never, {});
};

describe("FailNode", () => {
  it("candidate_branches", async () => {
    // candidate failing on a lesson with v1 leaves its state alone
    const a = make_world();
    a.states.seed(lesson, "in_review");
    await stored_v1(a);
    const out = await node(a).run(mk("candidate", 2));
    expect(a.states.rows.get(lesson)!.state).toBe("in_review");
    expect(out.outcome).toMatchObject({ status: "generation_failed", tile_state: "failed" });

    // candidate with no version sets generation_failed
    const b = make_world();
    b.states.seed(lesson, "draft");
    await node(b).run(mk("candidate", 2));
    expect(b.states.rows.get(lesson)!.state).toBe("generation_failed");

    // lesson job sets generation_failed
    const c = make_world();
    c.states.seed(lesson, "draft");
    await node(c).run(mk("lesson", 1));
    expect(c.states.rows.get(lesson)!.state).toBe("generation_failed");

    // no call made and capped: nothing written
    const d = make_world();
    d.states.seed(lesson, "draft");
    const capped = with_brake(mk("lesson", 0), "spend_run_cap");
    const o = await node(d).run(capped);
    expect(d.states.set_calls).toHaveLength(0);
    expect((o.outcome as { failure_reasons: { check: string }[] }).failure_reasons.map((r) => r.check)).toEqual(["capped"]);

    // cancelled: never touched, status cancelled
    const e = make_world();
    e.states.seed(lesson, "draft");
    const x = await node(e).run(with_brake(mk("lesson", 1), "cancelled"));
    expect(e.states.set_calls).toHaveLength(0);
    expect(x.outcome).toMatchObject({ status: "cancelled", tile_state: "failed" });
  });
});
