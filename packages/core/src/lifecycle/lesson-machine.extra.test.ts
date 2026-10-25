// NL-21 non-frozen tests (AC-4, AC-5, AC-6).
import { describe, expect, it } from "vitest";
import { decide_transition, is_editable, transition_roles } from "./lesson-machine.ts";

describe("decision_fields", () => {
  it("refusals are inert", () => {
    const d = decide_transition({ action: "approve", role: "author", from_state: "submitted" });
    expect(d).toEqual({
      allowed: false,
      to_state: null,
      refusal: "ROLE_FORBIDDEN",
      writes_snapshot: null,
      collab_mode_after: null,
    });
  });
  it("allowed fields", () => {
    expect(decide_transition({ action: "submit", role: "reviewer", from_state: "in_review" })).toEqual({
      allowed: true,
      to_state: "submitted",
      refusal: null,
      writes_snapshot: "submit",
      collab_mode_after: "read_only",
    });
    expect(
      decide_transition({ action: "approve", role: "approver", from_state: "submitted", rating: "rewritten" }),
    ).toMatchObject({ to_state: "approved", writes_snapshot: "approve", collab_mode_after: null });
  });
  it("blank note and reason are missing; tag ignored", () => {
    expect(
      decide_transition({ action: "request_changes", role: "approver", from_state: "submitted", note: "  " }).refusal,
    ).toBe("NOTE_REQUIRED");
    expect(
      decide_transition({ action: "reopen", role: "approver", from_state: "exported", reason: "", tag: "x" }).refusal,
    ).toBe("REASON_REQUIRED");
  });
});

describe("transition_roles", () => {
  it.each([
    ["start_review", "reviewer"],
    ["submit", "reviewer"],
    ["withdraw", "reviewer"],
    ["approve", "approver"],
    ["request_changes", "approver"],
    ["reopen", "approver"],
  ] as const)("%s -> %s", (a, r) => {
    expect(transition_roles(a)).toEqual([r]);
    expect(transition_roles(a)).not.toBe(transition_roles(a));
  });
});

describe("is_editable", () => {
  const states = [
    "generation_failed", "draft", "in_review", "submitted",
    "changes_requested", "approved", "reopened", "exported",
  ] as const;
  it("exactly 3 of 24 true, reviewer only", () => {
    const hits: string[] = [];
    for (const s of states)
      for (const r of ["author", "reviewer", "approver"] as const)
        if (is_editable(s, r)) hits.push(`${r}:${s}`);
    expect(hits.sort()).toEqual(["reviewer:changes_requested", "reviewer:in_review", "reviewer:reopened"]);
  });
});
