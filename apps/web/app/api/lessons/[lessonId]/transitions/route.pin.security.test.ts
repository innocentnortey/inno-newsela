// CHG-3 frozen security tests (risk::security), F1-F9 of docs/plans/fanout/2026-10-25-w4/CHG-3-4.md section 7.
// Do not edit: hashed in docs/plans/frozen-tests/CHG-3-4.manifest.json. Synthetic data; in-memory ports; no DB.
// Kept in a new file so the NL-53 frozen route.security.test.ts stays byte-for-byte (F8).
import { describe, expect, it } from "vitest";
import {
  HASH, HASH2, VEC, VEC2, approve_body, build, code_of, details_of,
} from "@/server/services/transition-service.fixtures";

const PIN = { snapshot_hash: HASH, snapshot_state_vector: VEC };
const RC = (over: Record<string, unknown> = {}) => ({ action: "request_changes", tag: "standards", note: "fix the codes", ...over });
const RO = (over: Record<string, unknown> = {}) => ({ action: "reopen", reason: "a rights question came up", ...over });
const approved = (state: "approved" | "exported" = "approved") => {
  const t = build({ state });
  t.w.add_version("approve", "clean", HASH, VEC);
  return t;
};

describe("F1 [invariant] request_changes with a stale pin is refused", () => {
  it("request_changes_stale_hash_refused", async () => {
    const t = build();
    const before = t.w.counts();
    const r = await t.post("approver-token", RC({ ...PIN, snapshot_hash: HASH2 }));
    expect(r.status).toBe(409);
    expect(code_of(r)).toBe("STALE_PIN");
    expect(details_of(r)["request_id"]).toBe(r.headers["X-Request-Id"]);
    expect(t.w.counts()).toEqual(before);
    expect(t.w.counts().state).toBe("submitted");
  });
  it("request_changes_stale_vector_refused", async () => {
    const t = build();
    const before = t.w.counts();
    const r = await t.post("approver-token", RC({ ...PIN, snapshot_state_vector: VEC2 }));
    expect(r.status).toBe(409);
    expect(code_of(r)).toBe("STALE_PIN");
    expect(details_of(r)["request_id"]).toBe(r.headers["X-Request-Id"]);
    expect(t.w.counts()).toEqual(before);
    expect(t.w.counts().state).toBe("submitted");
  });
});

describe("F2 [invariant] reopen with a stale pin is refused", () => {
  it.each(["approved", "exported"] as const)("reopen_stale_pin_refused (%s)", async (state) => {
    const t = approved(state);
    const before = t.w.counts();
    for (const over of [{ ...PIN, snapshot_hash: HASH2 }, { ...PIN, snapshot_state_vector: VEC2 }]) {
      const r = await t.post("approver-token", RO(over));
      expect(r.status).toBe(409);
      expect(code_of(r)).toBe("STALE_PIN");
      expect(details_of(r)["request_id"]).toBe(r.headers["X-Request-Id"]);
    }
    expect(t.w.counts()).toEqual(before);
    expect(t.w.counts().state).toBe(state);
    expect(t.w.count_kind("reopen")).toBe(0);
    expect(t.collab.all_calls).toBe(0);
    expect(t.w.log.some((s) => s.startsWith("collab:set_mode"))).toBe(false);
  });
  it("request_changes_stale_pin_refused: no set_mode call, no event", async () => {
    const t = build();
    const r = await t.post("approver-token", RC({ ...PIN, snapshot_hash: HASH2 }));
    expect(code_of(r)).toBe("STALE_PIN");
    expect(t.collab.all_calls).toBe(0);
    expect(t.w.events).toHaveLength(0);
  });
});

describe("F3 [boundary] a matching pin succeeds", () => {
  it("pin_matches_request_changes_succeeds", async () => {
    const t = build();
    const r = await t.post("approver-token", RC(PIN));
    expect(r.status).toBe(200);
    expect((r.body as Record<string, unknown>)["to_state"]).toBe("changes_requested");
    expect(t.w.lesson?.state).toBe("changes_requested");
  });
  it("pin_matches_reopen_succeeds", async () => {
    const t = approved();
    const r = await t.post("approver-token", RO(PIN));
    expect(r.status).toBe(200);
    expect((r.body as Record<string, unknown>)["to_state"]).toBe("reopened");
    expect(t.w.count_kind("reopen")).toBe(1);
  });
});

describe("F4 [regression] no pin: behaviour unchanged", () => {
  it("no_pin_unchanged", async () => {
    const a = build();
    const ra = await a.post("approver-token", RC());
    expect(ra.status).toBe(200);
    expect((ra.body as Record<string, unknown>)["to_state"]).toBe("changes_requested");
    const b = approved();
    const rb = await b.post("approver-token", RO());
    expect(rb.status).toBe(200);
    expect((rb.body as Record<string, unknown>)["to_state"]).toBe("reopened");
  });
});

describe("F5 [invariant] precedence: role, state and missing input outrank a stale pin", () => {
  const STALE = { ...PIN, snapshot_hash: HASH2 };
  it("stale_pin_with_empty_note_is_note_required", async () => {
    const t = build();
    const before = t.w.counts();
    const r = await t.post("approver-token", RC({ ...STALE, note: "" }));
    expect(code_of(r)).toBe("NOTE_REQUIRED");
    expect(t.w.counts()).toEqual(before);
  });
  it("stale_pin_with_empty_reason_is_reason_required", async () => {
    const t = approved();
    const before = t.w.counts();
    const r = await t.post("approver-token", RO({ ...STALE, reason: "" }));
    expect(code_of(r)).toBe("REASON_REQUIRED");
    expect(t.w.counts()).toEqual(before);
  });
  it("stale_pin_in_wrong_state_is_invalid_transition", async () => {
    const t = build({ state: "in_review" });
    expect(code_of(await t.post("approver-token", RC(STALE)))).toBe("INVALID_TRANSITION");
    const u = build(); // submitted lesson cannot be reopened
    expect(code_of(await u.post("approver-token", RO(STALE)))).toBe("INVALID_TRANSITION");
  });
  it("stale_pin_by_reviewer_is_role_forbidden", async () => {
    const t = build();
    const before = t.w.counts();
    const r = await t.post("reviewer-token", RC(STALE));
    expect(r.status).toBe(403);
    expect(code_of(r)).toBe("ROLE_FORBIDDEN");
    expect(t.w.counts()).toEqual(before);
  });
});

describe("F6 [invariant] a newer snapshot supersedes the pin", () => {
  it("newer_submit_makes_old_pin_stale", async () => {
    const t = build();
    t.w.add_version("submit", "clean", HASH2, VEC2);
    const before = t.w.counts();
    const r = await t.post("approver-token", RC(PIN));
    expect(code_of(r)).toBe("STALE_PIN");
    expect(t.w.counts()).toEqual(before);
    expect((await t.post("approver-token", RC({ snapshot_hash: HASH2, snapshot_state_vector: VEC2 }))).status).toBe(200);
  });
});

describe("F7 [boundary] a pin with no snapshot is stale, not a 500", () => {
  it("null_snapshot_is_stale", async () => {
    const t = build({ submit_title: null });
    expect(t.w.versions).toHaveLength(0);
    const r = await t.post("approver-token", RC(PIN));
    expect(r.status).toBe(409);
    expect(code_of(r)).toBe("STALE_PIN");
    expect(t.w.counts().state).toBe("submitted");
    const o = build({ state: "approved", submit_title: null });
    const r2 = await o.post("approver-token", RO(PIN));
    expect(r2.status).toBe(409);
    expect(code_of(r2)).toBe("STALE_PIN");
  });
});

describe("F8 [regression] approve is still strict", () => {
  it("approve_still_strict", async () => {
    const t = build();
    const before = t.w.counts();
    expect(code_of(await t.post("approver-token", approve_body({ snapshot_hash: HASH2 })))).toBe("STALE_PIN");
    expect(code_of(await t.post("approver-token", approve_body({ snapshot_state_vector: VEC2 })))).toBe("STALE_PIN");
    expect(t.w.counts()).toEqual(before);
    expect((await t.post("approver-token", approve_body())).status).toBe(200);
  });
});

describe("F9 [boundary] half a pin is rejected; unknown fields still are", () => {
  it.each([
    ["request_changes hash only", () => build(), () => RC({ snapshot_hash: HASH })],
    ["request_changes vector only", () => build(), () => RC({ snapshot_state_vector: VEC })],
    ["reopen hash only", () => approved(), () => RO({ snapshot_hash: HASH })],
    ["reopen vector only", () => approved(), () => RO({ snapshot_state_vector: VEC })],
  ])("half_pin_rejected: %s", async (_n, mk, body) => {
    const t = mk();
    const before = t.w.counts();
    const r = await t.post("approver-token", body());
    expect(r.status).toBe(400);
    expect(code_of(r)).toBe("INVALID_REQUEST");
    expect(t.w.counts()).toEqual(before);
    expect(t.collab.all_calls).toBe(0);
  });
  it("half_pin_rejected: a full pin plus an unknown field is still 400", async () => {
    const t = build();
    const before = t.w.counts();
    const r = await t.post("approver-token", RC({ ...PIN, extra_field: 1 }));
    expect(r.status).toBe(400);
    expect(code_of(r)).toBe("INVALID_REQUEST");
    expect(t.w.counts()).toEqual(before);
  });
});
