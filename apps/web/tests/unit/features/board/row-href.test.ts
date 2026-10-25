import { describe, expect, it } from "vitest";
import { paramFromState, stateFromParam, totalLessons } from "@/features/board/board-state";
import { lessonHref, runHref, validationReportHref } from "@/features/board/row-href";

describe("row-href", () => {
  it("reviewer goes to the lesson", () => {
    expect(lessonHref("g6-u4", "reviewer", { lesson_key: "L4", state: "draft" })).toBe("/units/g6-u4/lessons/L4");
  });
  it("approver on submitted goes to approve", () => {
    expect(lessonHref("g6-u4", "approver", { lesson_key: "L5", state: "submitted" })).toBe("/units/g6-u4/lessons/L5/approve");
  });
  it("approver on draft goes to the lesson", () => {
    expect(lessonHref("g6-u4", "approver", { lesson_key: "L4", state: "draft" })).toBe("/units/g6-u4/lessons/L4");
  });
  it("author on submitted goes to the lesson", () => {
    expect(lessonHref("g6-u4", "author", { lesson_key: "L5", state: "submitted" })).toBe("/units/g6-u4/lessons/L5");
  });
  it("run and report links", () => {
    expect(runHref("g6-u4", "run-0001")).toBe("/units/g6-u4/runs/run-0001");
    expect(validationReportHref("g6-u4", 2)).toBe("/units/g6-u4/outlines/2");
  });
  it("state params", () => {
    expect(stateFromParam("failed")).toBe("generation_failed");
    expect(stateFromParam("zzz")).toBeNull();
    expect(stateFromParam(null)).toBeNull();
    expect(paramFromState("generation_failed")).toBe("failed");
    expect(paramFromState(null)).toBeNull();
  });
  it("totals the roll-up", () => {
    expect(totalLessons({ draft: 34, in_review: 6, submitted: 2, approved: 3, generation_failed: 2 })).toBe(47);
  });
});
