import { describe, expect, it } from "vitest";
import { plan_parts } from "./part-labels.ts";

describe("plan_parts", () => {
  it("lettered_forms", () => {
    const p = plan_parts("S", ["Part A", "part b", "C"]);
    expect(["Part A", "part b", "C"].map((r) => p.label_of(r))).toEqual(["Part A", "Part B", "Part C"]);
    expect(p.title_of("Part A")).toBeNull();
  });
  it("title_after_colon", () => {
    const p = plan_parts("S", ["Part A: Gather evidence"]);
    expect(p.label_of("Part A: Gather evidence")).toBe("Part A");
    expect(p.title_of("Part A")).toBe("Gather evidence");
    expect(p.remaps).toHaveLength(1);
  });
  it("descriptive_labels_map_by_order", () => {
    const p = plan_parts("S", ["Gather evidence", "Plan and write"]);
    expect(p.label_of("Gather evidence")).toBe("Part A");
    expect(p.label_of("Plan and write")).toBe("Part B");
    expect(p.title_of("Part B")).toBe("Plan and write");
    expect(p.remaps).toHaveLength(2);
  });
  it("descriptive_skips_claimed_letters", () => {
    const p = plan_parts("S", ["Part B", "Plan"]);
    expect(p.label_of("Part B")).toBe("Part B");
    expect(p.label_of("Plan")).toBe("Part A");
  });
  it("a_plan_is_descriptive", () => {
    expect(plan_parts("S", ["A Plan"]).label_of("A Plan")).toBe("Part A");
    expect(plan_parts("S", ["A Plan"]).title_of("Part A")).toBe("A Plan");
  });
  it("same_raw_same_label", () => {
    const p = plan_parts("S", ["x", "y", "x"]);
    expect(p.label_of("x")).toBe(p.label_of("x"));
    expect(p.label_of("x")).not.toBe(p.label_of("y"));
  });
  it("canonical labels produce no remaps", () => {
    expect(plan_parts("S", ["Part A", "Part B", null]).remaps).toEqual([]);
  });
});
