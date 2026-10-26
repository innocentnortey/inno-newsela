import { describe, expect, it } from "vitest";
import {
  TAGS, buildReopen, buildRequestChanges, dependantsSentence, dialogTitle, lessonLabel, reopenedToast, sentBackToast, whoSeesIt,
} from "@/features/send-back/copy";

describe("send-back copy", () => {
  it("tags are the seven in order", () => {
    expect(TAGS.map((t) => t.label)).toEqual([
      "Standards", "Quotes and rights", "ELD support", "Content safety", "AI spans", "Teaching quality", "Other",
    ]);
    expect(TAGS.map((t) => t.value)).toEqual([
      "standards", "quotes_and_rights", "eld_support", "content_safety", "ai_spans", "teaching_quality", "other",
    ]);
  });
  it("lessonLabel", () => {
    expect(lessonLabel("G6.U4.L5")).toBe("Lesson 5");
    expect(lessonLabel("G6.U4.F3")).toBe("Flex day 3");
    expect(lessonLabel("nonsense")).toBe("this lesson");
  });
  it("dependantsSentence one", () => {
    expect(dependantsSentence(["G6.U4.L4"], "G6.U4.L5")).toBe(
      "Lesson 4 links to this lesson. It will be flagged and held back from export until Lesson 5 is approved again.",
    );
  });
  it("dependantsSentence several", () => {
    expect(dependantsSentence(["G6.U4.L4", "G6.U4.L6"], "G6.U4.L5")).toBe(
      "Lesson 4 and Lesson 6 link to this lesson. They will be flagged and held back from export until Lesson 5 is approved again.",
    );
    expect(dependantsSentence(["G6.U4.L2", "G6.U4.L4", "G6.U4.L6"], "G6.U4.L5")).toContain("Lesson 2, Lesson 4 and Lesson 6 link");
  });
  it("dialogTitle", () => {
    expect(dialogTitle("request_changes", "G6.U4.L5")).toBe("Request changes to Lesson 5");
    expect(dialogTitle("reopen", "G6.U4.L5")).toBe("Reopen Lesson 5");
  });
  it("toasts", () => {
    expect(sentBackToast("J. Rivera")).toBe("Sent back to J. Rivera.");
    expect(reopenedToast("G6.U4.L5", 3)).toBe("Lesson 5 reopened as version 3.");
  });
  it("request bodies carry no extra keys", () => {
    expect(buildRequestChanges("standards", "  x ")).toEqual({ action: "request_changes", tag: "standards", note: "x" });
    expect(buildReopen(" y ")).toEqual({ action: "reopen", reason: "y" });
  });

  it("whoSeesIt prefers the reviewer name", () => {
    expect(whoSeesIt({ reviewer: "J. Rivera", last_editor: "A. Other" })).toBe("J. Rivera");
    expect(whoSeesIt({ reviewer: null, last_editor: "A. Other" })).toBe("A. Other");
    expect(whoSeesIt(null)).toBe("the reviewer");
  });
});
