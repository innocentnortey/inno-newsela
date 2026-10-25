// CHG-3 frozen service-level security tests (risk::security): pin check inside the locked transaction,
// half-pin refusal at the service, and the collab call discipline. Do not edit: hashed in
// docs/plans/frozen-tests/CHG-3-4.manifest.json. Synthetic data; in-memory ports; no DB.
import { describe, expect, it } from "vitest";
import {
  HASH, HASH2, LID, VEC, VEC2, build, user_for,
} from "./transition-service.fixtures.ts";

const refusal = async (p: Promise<unknown>) => {
  try { await p; } catch (e) { return e as { code?: string }; }
  return null;
};

describe("CHG-3 service pin check", () => {
  it("stale_pin_refused_inside_tx: request_changes rolls back, no set_mode, STALE_PIN", async () => {
    const t = build();
    const before = t.w.counts();
    const e = await refusal(t.transitions.transition(user_for("approver-token"), LID,
      { action: "request_changes", tag: "standards", note: "n", snapshot_hash: HASH2, snapshot_state_vector: VEC } as never));
    expect(e?.code).toBe("STALE_PIN");
    expect(t.w.counts()).toEqual(before);
    expect(t.w.log.some((s) => s.startsWith("collab:set_mode"))).toBe(false);
  });
  it("stale_pin_refused_inside_tx: reopen leaves no reopen snapshot", async () => {
    const t = build({ state: "approved" });
    t.w.add_version("approve", "clean", HASH, VEC);
    const before = t.w.counts();
    const e = await refusal(t.transitions.transition(user_for("approver-token"), LID,
      { action: "reopen", reason: "r", snapshot_hash: HASH, snapshot_state_vector: VEC2 } as never));
    expect(e?.code).toBe("STALE_PIN");
    expect(t.w.counts()).toEqual(before);
    expect(t.w.count_kind("reopen")).toBe(0);
  });
  it("half_pin_rejected at the service: INVALID_REQUEST, nothing written", async () => {
    const t = build();
    const before = t.w.counts();
    const e = await refusal(t.transitions.transition(user_for("approver-token"), LID,
      { action: "request_changes", tag: "standards", note: "n", snapshot_hash: HASH } as never));
    expect(e?.code).toBe("INVALID_REQUEST");
    expect(t.w.counts()).toEqual(before);
  });
  it("matching pin: request_changes still calls set_mode(editable) once", async () => {
    const t = build();
    await t.transitions.transition(user_for("approver-token"), LID,
      { action: "request_changes", tag: "standards", note: "n", snapshot_hash: HASH, snapshot_state_vector: VEC } as never);
    expect(t.w.log.filter((s) => s.startsWith("collab:set_mode"))).toEqual(["collab:set_mode:editable:changes_requested"]);
    expect(t.w.lesson?.state).toBe("changes_requested");
  });
});
