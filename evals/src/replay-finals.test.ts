import { describe, expect, it } from "vitest";
import { delta, lift_teaching_tags, pick_output, summarize, type ReplayRecord } from "./replay-finals.ts";

const f = (kind: string, level = "blocking") => ({ kind, level, message: "m", address: null, code: null });
const rec = (gen: ReturnType<typeof f>[] | null, review: ReturnType<typeof f>[] | null): ReplayRecord => ({
  lesson: "L", which: "final", status: "ready", schema_issues: [], compile_error: null, gen, review,
});

describe("pick_output", () => {
  const calls = [
    { purpose: "lesson_draft", raw_output: "d1" },
    { purpose: "repair", raw_output: "r1" },
    { purpose: "repair", raw_output: null },
  ];
  it("final is the last call that has output, initial the first draft", () => {
    expect(pick_output(calls, "final")).toBe("r1");
    expect(pick_output(calls, "initial")).toBe("d1");
  });
  it("ignores other purposes and returns null when nothing is usable", () => {
    expect(pick_output([{ purpose: "unit_plan", raw_output: "x" }], "final")).toBeNull();
    expect(pick_output([{ purpose: "repair", raw_output: "r" }], "initial")).toBeNull();
  });
});

describe("summarize and delta", () => {
  const records = [
    rec([], [f("a"), f("a"), f("b", "advisory")]),
    rec([f("a")], [f("a")]),
    rec(null, null),
  ];
  const s = summarize(records);
  it("counts passes only among compiled lessons", () => {
    expect(s).toMatchObject({ lessons: 3, not_compiled: 1, gen_pass: 1, review_pass: 0 });
  });
  it("counts lessons per kind once, blocking only", () => {
    expect(s.review_blocking["a"]).toEqual({ blocking: 3, other: 0, lessons: 2 });
    expect(s.review_blocking["b"]).toBeUndefined();
  });
  it("delta is new minus baseline, zeros dropped", () => {
    const base = summarize([rec([], [f("a")])]).review_blocking;
    expect(delta(base, s.review_blocking)).toEqual({ a: 1 });
  });
});

describe("lift_teaching_tags", () => {
  const h = (section: string, codes: string[] = []) => ({ role: "routine_heading", section, part: null, standard_codes: codes, code_origins: codes.map(() => "outline") });
  const t = (section: string, codes: string[]) => ({ role: "teacher_talk", section, part: null, standard_codes: codes, code_origins: codes.map(() => "outline") });
  it("copies teaching codes to the preceding heading in the same section", () => {
    const out = JSON.parse(lift_teaching_tags(JSON.stringify({ blocks: [t("Launch", ["X.1"]), h("Launch"), t("Launch", ["RL.6.1"]), h("Look Back"), t("Look Back", ["W.6.9"])] })));
    expect(out.blocks[2].standard_codes).toEqual(["RL.6.1"]);
    expect(out.blocks[2].code_origins).toEqual(["outline"]);
    expect(out.blocks[4].standard_codes).toEqual(["W.6.9"]);
  });
  it("adds a heading where the section has none and leaves bad JSON alone", () => {
    const out = JSON.parse(lift_teaching_tags(JSON.stringify({ blocks: [h("Launch"), t("Learning in Action", ["RL.6.1"])] })));
    expect(out.blocks[0].standard_codes).toEqual([]);
    expect(out.blocks[1]).toMatchObject({ role: "routine_heading", section: "Learning in Action", standard_codes: ["RL.6.1"] });
    expect(lift_teaching_tags("not json")).toBe("not json");
  });
});
