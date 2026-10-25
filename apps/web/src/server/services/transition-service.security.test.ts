// NL-53 frozen security tests (risk::security), AC-13 and AC-14. Do not edit: hashed in
// docs/plans/frozen-tests/NL-53.manifest.json. Synthetic data; in-memory ports; no network or key.
import { describe, expect, it } from "vitest";
import { DomainRefusal } from "@ls/core/errors";
import { ERROR_STATUS } from "../http/error-status.generated.ts";
import {
  HASH, LID, VEC, approve_body, build, code_of, collab_unavailable, details_of, user_for,
} from "./transition-service.fixtures.ts";

const idx = (log: string[], pred: (s: string) => boolean) => log.map((s, i) => (pred(s) ? i : -1)).filter((i) => i >= 0);

describe("AC-13 [invariant] collaboration call discipline", () => {
  it("collab_calls_per_action: submit makes exactly one lock_and_snapshot with the full command", async () => {
    const t = build({ state: "in_review", submit_title: null });
    const u = user_for("reviewer-token", "req_synthetic_submit");
    await t.transitions.transition(u, LID, { action: "submit", client_state_vector: VEC });
    expect(t.collab.submits).toHaveLength(1);
    expect(t.collab.submits[0]).toMatchObject({
      lesson_id: LID, client_state_vector: VEC, request_id: "req_synthetic_submit",
      actor: { user_id: u.user_id, name: u.name, role: "reviewer", synthetic: true },
    });
    expect(t.collab.modes).toHaveLength(0);
  });
  it("collab_calls_per_action: approve makes zero collaboration calls", async () => {
    const t = build();
    await t.transitions.transition(user_for("approver-token"), LID, approve_body() as never);
    expect(t.collab.all_calls).toBe(0);
    expect(t.w.log.some((s) => s.startsWith("collab:"))).toBe(false);
  });
  it.each([
    ["withdraw", "reviewer-token", "submitted", { action: "withdraw", note: "pulling it back" }, "in_review"],
    ["request_changes", "approver-token", "submitted", { action: "request_changes", tag: "standards", note: "fix the codes" }, "changes_requested"],
    ["reopen", "approver-token", "approved", { action: "reopen", reason: "a rights question came up" }, "reopened"],
  ] as const)("collab_calls_per_action: %s calls set_mode(editable) once, inside the open transaction", async (_n, who, from, body, to) => {
    const t = build({ state: from });
    if (from === "approved") t.w.add_version("approve", "clean", HASH, VEC);
    await t.transitions.transition(user_for(who), LID, body as never);
    const { log } = t.w;
    const modes = idx(log, (s) => s.startsWith("collab:set_mode"));
    expect(modes).toHaveLength(1);
    expect(log[modes[0]!]).toBe(`collab:set_mode:editable:${to}`);
    const begin = idx(log, (s) => s === "begin")[0]!;
    const commit = idx(log, (s) => s === "commit")[0]!;
    expect(begin).toBeLessThan(modes[0]!);
    expect(modes[0]!).toBeLessThan(commit);
    expect(t.collab.submits).toHaveLength(0);
    expect(t.w.lesson?.state).toBe(to);
  });
});

describe("AC-14 [failure/refusal] submit failures from the collaboration server", () => {
  it("submit_passes_collab_refusals_through: CollabUnavailable -> 503, nothing written", async () => {
    const t = build({ state: "in_review", submit_title: null });
    t.collab.submit_behave = async () => { throw collab_unavailable("lock_and_snapshot"); };
    const before = t.w.counts();
    const r = await t.post("reviewer-token", { action: "submit", client_state_vector: VEC });
    expect(r.status).toBe(503);
    expect(code_of(r)).toBe("COLLAB_UNAVAILABLE");
    expect(t.w.counts()).toEqual(before);
    expect(t.w.lesson?.state).toBe("in_review");
    expect(t.w.count_kind("submit")).toBe(0);
  });
  it.each([
    ["NOT_STORED", {}],
    ["BLOCKED", { issues: [{ kind: "quote_without_source", level: "blocking", message: "m", address: "A1" }] }],
    ["LESSON_LOCKED", { state: "submitted" }],
  ] as const)("submit_passes_collab_refusals_through: %s keeps its code, status and details", async (code, details) => {
    const t = build({ state: "in_review", submit_title: null });
    t.collab.submit_behave = async () => { throw new DomainRefusal(code, "refused by collab", details as never); };
    const before = t.w.counts();
    const r = await t.post("reviewer-token", { action: "submit", client_state_vector: VEC });
    expect(r.status).toBe(ERROR_STATUS[code]);
    expect(code_of(r)).toBe(code);
    for (const [k, v] of Object.entries(details)) expect(details_of(r)[k]).toEqual(v);
    expect(t.w.counts()).toEqual(before);
  });
});
