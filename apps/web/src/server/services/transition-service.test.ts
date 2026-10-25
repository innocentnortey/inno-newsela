// NL-53 AC-19 (unfrozen): set_mode failure rolls the move back; a commit failure after set_mode compensates.
// Synthetic, in-memory; uses the frozen fixtures read-only.
import { describe, expect, it } from "vitest";
import { InvariantViolation } from "@ls/core/errors";
import { HASH, LID, VEC, build, code_of, collab_unavailable, user_for } from "./transition-service.fixtures.ts";

const CASES = [
  ["withdraw", "reviewer-token", "submitted", { action: "withdraw", note: "pulling it back" }],
  ["request_changes", "approver-token", "submitted", { action: "request_changes", tag: "standards", note: "fix the codes" }],
  ["reopen", "approver-token", "approved", { action: "reopen", reason: "a rights question came up" }],
] as const;

function world(from: "submitted" | "approved") {
  const t = build({ state: from });
  if (from === "approved") t.w.add_version("approve", "clean", HASH, VEC);
  return t;
}

describe("AC-19 set_mode failure", () => {
  it.each(CASES)("set_mode_failure_rolls_back: %s -> 503, nothing changed", async (_n, who, from, body) => {
    const t = world(from);
    t.collab.mode_behave = async () => { throw collab_unavailable("set_mode"); };
    const before = t.w.counts();
    const r = await t.post(who, body);
    expect(r.status).toBe(503);
    expect(code_of(r)).toBe("COLLAB_UNAVAILABLE");
    expect(t.w.counts()).toEqual(before);
    expect(t.w.lesson?.state).toBe(from);
    expect(t.w.log).toContain("rollback");
    expect(t.w.log).not.toContain("commit");
  });

  it("set_mode_failure_rolls_back: a commit failing after set_mode(editable) freezes again and logs once", async () => {
    const t = world("submitted");
    t.w.fail_commit_once = true;
    const before = t.w.counts();
    await expect(
      t.transitions.transition(user_for("approver-token", "req_synthetic_commit"), LID, { action: "request_changes", tag: "standards", note: "fix" }),
    ).rejects.toThrow("commit failed");
    expect(t.w.counts()).toEqual(before);
    expect(t.collab.modes.map((m) => `${m.mode}:${m.state}`)).toEqual(["editable:changes_requested", "read_only:submitted"]);
    const logged = t.lines.filter((l) => l.includes("commit_failed_after_set_mode"));
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain("req_synthetic_commit");
    expect(new InvariantViolation("commit_failed_after_set_mode").name).toBe("InvariantViolation");
    expect(logged[0]).toContain("InvariantViolation");
  });
});
