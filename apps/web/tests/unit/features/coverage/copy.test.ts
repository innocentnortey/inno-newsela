import { describe, expect, it } from "vitest";
import {
  cellName,
  confirmedWords,
  lessonColumnLabel,
  lessonLabel,
  sortLessons,
} from "@/features/coverage/copy";

describe("coverage copy", () => {
  it("parses the lesson number from the id", () => {
    expect(lessonLabel("G6.U4.L31")).toBe("Lesson 31");
    expect(lessonLabel("odd")).toBe("odd");
  });
  it("labels a null-number lesson from its id and sorts it last", () => {
    expect(
      lessonColumnLabel({ lesson_id: "G6.U4.L9", number: null }),
    ).toBe("Lesson 9");
    const sorted = sortLessons([
      { lesson_id: "G6.U4.L9", number: null },
      { lesson_id: "G6.U4.L5", number: 5 },
      { lesson_id: "G6.U4.L3", number: 3 },
    ]);
    expect(sorted.map((l) => l.lesson_id)).toEqual([
      "G6.U4.L3",
      "G6.U4.L5",
      "G6.U4.L9",
    ]);
  });
  it("words the confirmer", () => {
    expect(confirmedWords("person")).toBe("Confirmed by a person.");
    expect(confirmedWords("judge_only")).toBe(
      "Judge only, not confirmed by a person.",
    );
    expect(confirmedWords("generator_only")).toBe(
      "Generator only, not confirmed by a person.",
    );
  });
  it("builds the cell name in I, P, A order with the source", () => {
    expect(
      cellName({
        code: "RL.6.1",
        lesson_id: "G6.U4.L4",
        roles: ["P", "I"],
        confirmed_by: "person",
        source: "approved",
      }),
    ).toBe(
      "Introduced, Practised. Confirmed by a person. From the approved version.",
    );
  });
});
