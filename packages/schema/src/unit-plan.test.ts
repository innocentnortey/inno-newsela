// NL-09 AC-5 [negative]
import { describe, expect, it } from "vitest";
import { zod_issue_paths } from "./lesson-draft.ts";
import { UnitPlanDraft } from "./unit-plan.ts";

const e = (id: string, day = 1) => ({ lesson_id: id, day, purpose: "p", routines: [], hands_forward: "h", performance_task_thread: "t" });
const paths = (x: unknown): string[] => {
  const r = UnitPlanDraft.safeParse(x);
  if (r.success) throw new Error("expected failure");
  return zod_issue_paths(r.error);
};

describe("UnitPlanDraft", () => {
  it("accepts a valid plan", () => {
    expect(UnitPlanDraft.safeParse({ entries: [e("G6.U4.L1"), e("G6.U4.L2", 2)] }).success).toBe(true);
  });
  it("rejects zero entries", () => expect(paths({ entries: [] })).toEqual(["entries"]));
  it("rejects duplicate lesson_id at the repeat", () => {
    expect(paths({ entries: [e("G6.U4.L1"), e("G6.U4.L1", 2)] })).toEqual(["entries[1].lesson_id"]);
  });
  it("rejects day 0", () => expect(paths({ entries: [e("G6.U4.L1", 0)] })).toEqual(["entries[0].day"]));
});
