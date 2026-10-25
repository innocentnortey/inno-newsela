import { describe, expect, it } from "vitest";
import { DAY_CAP, COLLAB, failedSentence, locked } from "@/features/candidate/copy";
import { alignRows, canAdopt, errorSentence, type Candidate, type Lesson, type Section } from "@/features/candidate/derive";
import type { Role } from "@/lib/roles";

const sec = (address: string, name = address): Section =>
  ({ address, name, minutes: 5, content: { type: "doc", content: [] } }) as unknown as Section;

describe("rows", () => {
  it("rows: aligns by address, candidate order first", () => {
    const rows = alignRows([sec("a"), sec("b"), sec("c")], [sec("c"), sec("a"), sec("b")]);
    expect(rows.map((r) => r.address)).toEqual(["c", "a", "b"]);
    expect(rows.every((r) => r.current && r.candidate)).toBe(true);
  });
  it("rows: current-only and candidate-only sections both appear once", () => {
    const rows = alignRows([sec("a"), sec("x")], [sec("a"), sec("y")]);
    expect(rows.map((r) => [r.address, !!r.current, !!r.candidate])).toEqual([
      ["a", true, true],
      ["y", false, true],
      ["x", true, false],
    ]);
  });
});

const base = { role: "reviewer" as Role, lessonState: "in_review" as Lesson["state"], candidate: { status: "ready", adopted: false } as Pick<Candidate, "status" | "adopted"> };

describe("canAdopt", () => {
  it("canAdopt: reviewer, ready, editable lesson", () => {
    expect(canAdopt(base)).toBe(true);
  });
  const cases: [string, Parameters<typeof canAdopt>[0]][] = [
    ["queued", { ...base, candidate: { status: "queued", adopted: false } }],
    ["drafting", { ...base, candidate: { status: "drafting", adopted: false } }],
    ["failed", { ...base, candidate: { status: "failed", adopted: false } }],
    ["adopted", { ...base, candidate: { status: "ready", adopted: true } }],
    ["submitted", { ...base, lessonState: "submitted" }],
    ["approved", { ...base, lessonState: "approved" }],
    ["exported", { ...base, lessonState: "exported" }],
    ["author", { ...base, role: "author" }],
    ["approver", { ...base, role: "approver" }],
  ];
  it.each(cases)("no adopt controls when: %s", (_n, input) => {
    expect(canAdopt(input)).toBe(false);
  });
});

describe("sentences", () => {
  it("errors: sentence per code", () => {
    expect(errorSentence("LESSON_LOCKED", "Lesson 4")).toBe(locked("Lesson 4"));
    expect(errorSentence("LESSON_LOCKED", "Lesson 4")).toBe("Lesson 4 is submitted. Withdraw it first to regenerate.");
    expect(errorSentence("DAY_CAP_REACHED", "Lesson 4")).toBe(DAY_CAP);
    expect(errorSentence("COLLAB_UNAVAILABLE", "Lesson 4")).toBe(COLLAB);
    expect(errorSentence("NETWORK", "Lesson 4")).toBe("Couldn't reach Lesson Studio. Try again.");
    expect(errorSentence("INVALID_TRANSITION", "Lesson 4")).toBeNull();
  });
  it("failed: sentence strips the trailing period", () => {
    expect(failedSentence([{ message: "Look Back is 3 minutes (needs 5)." }])).toBe(
      "Candidate failed: Look Back is 3 minutes (needs 5). The current lesson is unchanged.",
    );
    expect(failedSentence([{ message: "A" }, { message: "B" }])).toBe("Candidate failed: A; B. The current lesson is unchanged.");
  });
});
