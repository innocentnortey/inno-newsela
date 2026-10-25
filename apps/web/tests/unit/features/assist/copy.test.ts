import { describe, expect, it } from "vitest";
import * as C from "@/features/assist/copy";

describe("assist copy", () => {
  it("strings are the spec sentences", () => {
    expect(C.TITLE).toBe("Rewrite selection");
    expect(C.WARN).toBe("Don't paste student work.");
    expect(C.ASK).toBe("Ask for a suggestion");
    expect(C.PENDING_REASON).toBe("Accept or reject the AI suggestion first");
    expect(C.ANCHOR_CHANGED_TEXT).toBe("Text changed, ask again.");
    expect(C.MODEL_UNAVAILABLE_TEXT).toBe("Couldn't get a suggestion. Nothing changed.");
    expect(C.ACCEPTED_TOAST).toBe("Applied as your edit (AI-assisted).");
    expect(C.REJECTED_TOAST).toBe("Discarded.");
  });
  it("errorText maps every CON-17 code", () => {
    expect(C.errorText("ANCHOR_CHANGED")).toBe(C.ANCHOR_CHANGED_TEXT);
    expect(C.errorText("MODEL_UNAVAILABLE")).toBe(C.MODEL_UNAVAILABLE_TEXT);
    expect(C.errorText("LESSON_LOCKED")).toBe(C.LOCKED_TEXT);
    expect(C.errorText("COLLAB_UNAVAILABLE")).toBe(C.COLLAB_TEXT);
    expect(C.errorText("INVALID_TRANSITION")).toBe(C.MOVED_ON_TEXT);
    expect(C.errorText("NETWORK")).toBe("Couldn't reach Lesson Studio. Try again.");
    expect(C.errorText("ROLE_FORBIDDEN", "Only reviewers can ask.")).toBe("Only reviewers can ask.");
    expect(C.errorText("NOT_FOUND")).toBeNull();
  });
});
