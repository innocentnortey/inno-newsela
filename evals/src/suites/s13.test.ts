// NL-86 AC-7: S13 rating split with n, read from unit_metrics_rows and approved_snapshots only.
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { make_s13, type S13Deps } from "./s13.ts";
import type { EvalOptions } from "../types.ts";

const OPTS: EvalOptions = { repeat: 1, provider_mode: "stub", git_sha: "x", unit: "G6.U4" };
const RATINGS = ["usable_as_drafted", "usable_as_drafted", "usable_as_drafted", "usable_as_drafted", "usable_as_drafted", "usable_as_drafted", "usable_with_edits", "usable_with_edits", "usable_with_edits", "rewritten"];
const IDS = ["G6.U4.L4", "G6.U4.L5", "G6.U4.FLEX-1a", "G6.U4.L1", "G6.U4.L2", "G6.U4.L3", "G6.U4.L6", "G6.U4.L7", "G6.U4.L10", "G6.U4.L11"];

function deps(over: Partial<{ rows: number; approved: string[] }> = {}): S13Deps {
  // the three demo ids carry usable_with_edits, usable_as_drafted, rewritten
  const rating = (i: number): string => (i === 0 ? "usable_with_edits" : i === 1 ? "usable_as_drafted" : i === 2 ? "rewritten" : (RATINGS[i] as string));
  const rows = IDS.slice(0, over.rows ?? 10).map((lesson_id, i) => ({
    lesson_id, version_id: `v${i}`, draft_rating: rating(i), active_minutes: new Decimal("12.5"), human_sessions: 1, teacher_word_count: 1, g2_threshold_minutes: new Decimal(20), approved_at: new Date(0),
  }));
  return {
    metrics: { unit_metrics_rows: async () => rows as never },
    versions: { approved_snapshots: async () => (over.approved ?? IDS).map((lesson_id) => ({ lesson_id })) as never },
    unit_id: "G6.U4" as never, demo_lesson_ids: ["G6.U4.L4", "G6.U4.L5", "G6.U4.FLEX-1a"] as never,
  };
}
const run = async (d: S13Deps, id: string) => { const s = make_s13("stub", d); return s.score(s.cases().find((c) => c.case_id === id) as never, OPTS); };

describe("S13", () => {
  it("has four static cases", () => expect(make_s13("stub", deps()).cases()).toHaveLength(4));

  it("rating_split_with_n", async () => {
    const o = await run(deps(), "rating_split_with_n");
    expect(o.passed).toBe(true);
    expect(o.actual).toEqual({ n: 10, usable_as_drafted: 4, usable_with_edits: 4, rewritten: 2 });
  });
  it("all approved lessons must be rated", async () => {
    expect((await run(deps(), "all_approved_rated")).passed).toBe(true);
    expect((await run(deps({ rows: 8 }), "all_approved_rated")).passed).toBe(false);
  });
  it("demo lessons: two of three usable with edits or better", async () => {
    const o = await run(deps(), "demo_lessons_usable_with_edits_or_better");
    expect(o).toMatchObject({ passed: true, actual: { demo_rated: 3, good: 2 } });
  });
  it("rewritten lessons are listed as trace candidates and no minutes enter actual", async () => {
    const o = await run(deps(), "rewritten_listed_as_trace_candidates");
    expect(o.actual).toEqual({ trace_candidates: ["G6.U4.FLEX-1a", "G6.U4.L11"] });
  });
});
