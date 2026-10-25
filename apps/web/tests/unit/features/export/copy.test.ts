import { describe, expect, it } from "vitest";
import {
  heldBackText,
  lessonLabel,
  writtenMessage,
} from "@/features/export/copy";

describe("export copy", () => {
  it("parses the lesson number from the id", () => {
    expect(lessonLabel("G6.U4.L31")).toBe("Lesson 31");
    expect(lessonLabel("odd")).toBe("odd");
  });
  it("words the written message, singular and plural", () => {
    expect(writtenMessage(2, 3)).toBe("Export v2 written · 3 lessons");
    expect(writtenMessage(2, 1)).toBe("Export v2 written · 1 lesson");
  });
  it("words a held back lesson", () => {
    expect(heldBackText("G6.U4.L4", "G6.U4.L5")).toBe(
      "Lesson 4 waits on Lesson 5",
    );
  });
});
