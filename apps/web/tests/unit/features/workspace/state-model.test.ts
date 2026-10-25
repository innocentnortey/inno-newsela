import { describe, expect, it } from "vitest";
import { groupSections, isReadOnly, lessonLabel, offPathStatus, placeLabel, shortHash, stepFor, totalMinutes } from "@/features/workspace/state-model";
import { LESSON4 } from "../../../../e2e/workspace-read/fixtures";

describe("state-model", () => {
  it("step_and_off_path", () => {
    expect(lessonLabel("L4")).toBe("Lesson 4");
    expect(lessonLabel("F2")).toBe("Flex day 2");
    expect(placeLabel("g6-u4")).toBe("Grade 6 · Unit 4");
    expect(stepFor("generation_failed")).toBe(1);
    expect(stepFor("reopened")).toBe(2);
    expect(stepFor("submitted")).toBe(3);
    expect(stepFor("approved")).toBe(4);
    expect(stepFor("exported")).toBe(5);
    expect(offPathStatus("generation_failed")).toBe("lesson.generation_failed");
    expect(offPathStatus("changes_requested")).toBe("lesson.changes_requested");
    expect(offPathStatus("draft")).toBeNull();
    expect(shortHash("9f00000000000000000000000000000000000000000000000000000000000405")).toBe("9f00…0405");
  });

  it("read_only_by_role_and_state", () => {
    for (const s of ["draft", "in_review", "changes_requested", "reopened"] as const) {
      expect(isReadOnly("reviewer", s)).toBe(false);
      expect(isReadOnly("author", s)).toBe(true);
      expect(isReadOnly("approver", s)).toBe(true);
    }
    for (const s of ["generation_failed", "submitted", "approved", "exported"] as const) expect(isReadOnly("reviewer", s)).toBe(true);
  });

  it("group_sections_parts", () => {
    const groups = groupSections(LESSON4.sections);
    expect(groups.map((g) => g.name)).toEqual(["Launch", "Literacy Lab", "Learning in Action", "Look Back", "Homework"]);
    const lia = groups[2]!;
    expect(lia.minutes).toBe(30);
    expect(lia.parts).toHaveLength(2);
    expect(totalMinutes(LESSON4.sections)).toBe(50);
  });
});
