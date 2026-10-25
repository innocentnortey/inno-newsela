import { describe, expect, it } from "vitest";
import { submitReasons } from "@/features/workspace/actions/submit-reasons";
import type { components } from "@/lib/api-types";

type Issue = components["schemas"]["Issue"];
const issue = (o: Partial<Issue>): Issue =>
  ({ issue_id: "i", level: "blocking", blocks: ["submit"], resolvable: false, kind: "section_missing", message: "m", address: null, span_anchor: null, related_lesson_id: null, resolution: null, ...o }) as Issue;
const list = (...issues: Issue[]) => ({ lesson_id: "G6.U4.L4", issues }) as components["schemas"]["IssueList"];

describe("submit reasons", () => {
  it("lists each reason on its own entry in spec order", () => {
    const l = list(
      issue({ issue_id: "1" }), issue({ issue_id: "2" }), issue({ issue_id: "3" }),
      issue({ issue_id: "4", level: "confirmation", kind: "standard_confirmation" }),
      issue({ issue_id: "5", kind: "suggestion_pending" }),
    );
    expect(submitReasons(l, "saving")).toEqual([
      "3 blocking issues", "1 standard to confirm", "Accept or reject the AI suggestion first", "Saving",
    ]);
  });
  it("resolved and approve-only issues add no reason", () => {
    const l = list(
      issue({ resolution: { by: "x", reason: "r", at: "2026-10-25T00:00:00Z" } }),
      issue({ issue_id: "2", blocks: ["approve"] }),
    );
    expect(submitReasons(l, "stored")).toEqual([]);
  });
  it("empty when nothing blocks and the editor is stored", () => {
    expect(submitReasons(list(), "stored")).toEqual([]);
    expect(submitReasons(list(), "synced")).toEqual([]);
  });
  it("string and object client states", () => {
    const l = list();
    expect(submitReasons(l, "connecting")).toEqual(["Saving"]);
    expect(submitReasons(l, "DISCONNECTED")).toEqual(["Saving"]);
    expect(submitReasons(l, { state: "synced", state_vector: "v", stored: false })).toEqual(["Saving"]);
    expect(submitReasons(l, { state: "stored", state_vector: "v", stored: true })).toEqual([]);
    expect(submitReasons(l, "stored", true)).toEqual(["Saving"]);
    expect(submitReasons(list(issue({})), "stored")).toEqual(["1 blocking issue"]);
  });
});
