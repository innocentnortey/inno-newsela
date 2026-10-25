import { describe, expect, it } from "vitest";
import {
  lessonHref,
  lessonTitle,
  planHeading,
  sortByDay,
  splitLinkLabel,
} from "@/features/unit-plan/plan-copy";

const entry = (day: number) => ({
  lesson_id: "G6.U4.L" + day,
  day,
  purpose: "p",
  routines: [],
  hands_forward: "h",
  performance_task_thread: "t",
});

describe("plan-copy", () => {
  it("builds the heading and falls back for an unknown key", () => {
    expect(planHeading("g6-u4")).toBe("Unit plan · Grade 6 · Unit 4");
    expect(planHeading("weird")).toBe("Unit plan · weird");
  });
  it("sorts by day without mutating", () => {
    const input = [entry(3), entry(1), entry(2)];
    expect(sortByDay(input).map((e) => e.day)).toEqual([1, 2, 3]);
    expect(input.map((e) => e.day)).toEqual([3, 1, 2]);
  });
  it("titles and links lessons", () => {
    expect(lessonTitle("G6.U4.L4")).toBe("Lesson 4");
    expect(lessonTitle("G6.U4.F2")).toBe("Flex 2");
    expect(lessonTitle("bad")).toBe("bad");
    expect(lessonHref("g6-u4", "G6.U4.L5")).toBe("/units/g6-u4/lessons/L5");
    expect(lessonHref("g6-u4", "bad")).toBeNull();
  });
  it("splits a link label on the arrow", () => {
    expect(splitLinkLabel("Lesson 4 Homework → Lesson 5 excerpt slot")).toEqual(
      {
        from: "Lesson 4 Homework",
        to: "Lesson 5 excerpt slot",
      },
    );
    expect(splitLinkLabel("no arrow")).toBeNull();
  });
});
