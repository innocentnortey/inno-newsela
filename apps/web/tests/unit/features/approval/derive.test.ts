import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api-client";
import { approveDisabledReason, checklistRows, screenMode, shortHash, viewFromError, type Issue, type Lesson } from "@/features/approval/derive";
import { lesson4Submitted, lesson5Submitted } from "../../../../e2e/approval/fixtures";

const err = (code: ApiError["code"], details: Record<string, unknown> = {}) => new ApiError({ status: 422, code, message: "m " + code, details });
const issue = (kind: Issue["kind"], message: string): Issue => ({
  issue_id: "i", level: "blocking", blocks: ["approve"], resolvable: false, kind, message, address: null, span_anchor: null, related_lesson_id: null, resolution: null,
});

describe("derive", () => {
  it("shortHash keeps four and four with an ellipsis", () => {
    expect(shortHash("9f3c" + "0".repeat(56) + "a21e")).toBe("9f3c…a21e");
  });

  it("screenMode by state", () => {
    const l = lesson5Submitted();
    expect(screenMode(l)).toBe("decide");
    expect(screenMode({ ...l, snapshot: null })).toBe("not_submitted");
    expect(screenMode({ ...l, state: "in_review" })).toBe("not_submitted");
    expect(screenMode({ ...l, state: "approved" })).toBe("frozen");
    expect(screenMode({ ...l, state: "exported" })).toBe("frozen");
  });

  it("viewFromError maps every named code", () => {
    expect(viewFromError(err("STALE_PIN")).kind).toBe("stale");
    expect(viewFromError(err("RATING_REQUIRED")).kind).toBe("rating");
    expect(viewFromError(err("FOUR_EYES")).kind).toBe("four_eyes");
    expect(viewFromError(err("NETWORK")).kind).toBe("network");
    expect(viewFromError(err("ROLE_FORBIDDEN")).kind).toBe("forbidden");
    expect(viewFromError(new Error("x")).kind).toBe("network");
    expect(viewFromError(err("DEPENDENCY_UNAPPROVED", { lesson_id: "G6.U4.L5" }))).toEqual({ kind: "dependency", lessonIds: ["G6.U4.L5"] });
    expect(viewFromError(err("BLOCKED", { issues: [issue("standard_not_checked", "RL.6.2 has no checking item")] }))).toMatchObject({ kind: "blocked", message: "RL.6.2 has no checking item" });
    expect(viewFromError(err("NOT_FOUND"))).toEqual({ kind: "other", message: "m NOT_FOUND" });
  });

  it("checklistRows overlays blocking issues and adds the dependency row", () => {
    const l = lesson4Submitted();
    const rows = checklistRows({ lesson: l, issues: null, blockedIssues: [issue("standard_not_checked", "RL.6.2 has no checking item"), issue("judge_no", "Judge said no")], unitKey: "g6-u4" });
    expect(rows.find((r) => r.key === "standards")).toMatchObject({ state: "blocking", stateWord: "Blocking", evidence: "RL.6.2 has no checking item" });
    expect(rows.find((r) => r.key === "dependencies")).toMatchObject({ title: "Homework text — Lesson 5 must be approved first", link: { href: "/units/g6-u4/lessons/L5/approve" } });
    expect(rows.at(-1)).toMatchObject({ key: "other", title: "Other blocking issues" });
    expect(rows.find((r) => r.key === "quotes_and_rights")?.state).toBe("ok");
  });

  it("approveDisabledReason never uses the rating", () => {
    const l = lesson5Submitted();
    expect(approveDisabledReason({ lesson: l, view: null })).toBeNull();
    expect(approveDisabledReason({ lesson: l, view: { kind: "rating" } })).toBeNull();
    expect(approveDisabledReason({ lesson: l, view: { kind: "stale" } })).toBe("Reload to continue");
    expect(approveDisabledReason({ lesson: l, view: { kind: "four_eyes" } })).toBe("Someone else must approve");
    expect(approveDisabledReason({ lesson: lesson4Submitted(), view: null })).toBe("Lesson 5 must be approved first");
  });

  it("evidence line falls back to the refs", () => {
    const l: Lesson = { ...lesson5Submitted(), front_matter: { standards: [] }, text_cards: [] };
    const rows = checklistRows({ lesson: l, issues: null, blockedIssues: [], unitKey: "g6-u4" });
    expect(rows[0]?.evidence).toBe("G6.U4.L5.LearningInAction.PartA");
    expect(rows.find((r) => r.key === "content_safety")?.evidence).toBe("No issues found");
    expect(rows[0]?.jump?.href).toBe("#sec-G6.U4.L5.LearningInAction.PartA");
  });
});
