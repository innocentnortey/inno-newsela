import { describe, expect, it } from "vitest";
import { savedMessage, trialMessage } from "@/features/prompt-guidance/copy";

describe("copy", () => {
  it("builds the messages", () => {
    expect(savedMessage(2, 1)).toBe(
      "Guidance v2 saved. Runs already going keep v1.",
    );
    expect(trialMessage(4)).toBe("Candidate made on Lesson 4, not adopted.");
  });
});
