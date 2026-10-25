// NL-53 frozen security tests (risk::security), AC-1..AC-12, AC-15..AC-17. Do not edit: hashed in
// docs/plans/frozen-tests/NL-53.manifest.json. Synthetic data; in-memory ports; no network, key or DB.
import { afterEach, describe, expect, it } from "vitest";
import { ERROR_STATUS } from "@/server/http/error-status.generated";
import {
  APPROVER_ID, HASH, HASH2, KEY_MARK, LID, NOTE_MARK, REVIEWER_ID, RESOLVE_Q, RESOLVE_R, RESOLVE_S,
  SRC_HASH, SRC_LID, UNKNOWN_LID, VEC, VEC2, approve_body, build, code_of, details_of,
} from "@/server/services/transition-service.fixtures";

const st = (c: keyof typeof ERROR_STATUS) => ERROR_STATUS[c];
const SUBMIT = { action: "submit", client_state_vector: VEC };
const saved_key = process.env["ANTHROPIC_API_KEY"];
afterEach(() => {
  if (saved_key === undefined) delete process.env["ANTHROPIC_API_KEY"];
  else process.env["ANTHROPIC_API_KEY"] = saved_key;
});

describe("AC-1 [failure/refusal] role gate", () => {
  it("approve_by_reviewer_forbidden", async () => {
    const t = build();
    const before = t.w.counts();
    const r = await t.post("reviewer-token", approve_body());
    expect(r.status).toBe(403);
    expect(code_of(r)).toBe("ROLE_FORBIDDEN");
    expect(t.w.counts()).toEqual(before);
    expect(t.w.counts().state).toBe("submitted");
    expect(t.collab.all_calls).toBe(0);
  });
  it("approve_by_reviewer_forbidden: an approver cannot submit, a reviewer cannot request changes, an author cannot approve", async () => {
    const t = build();
    const before = t.w.counts();
    const rs = [
      await t.post("approver-token", SUBMIT),
      await t.post("reviewer-token", { action: "request_changes", tag: "standards", note: "why" }),
      await t.post("author-token", approve_body()),
    ];
    for (const r of rs) expect(code_of(r)).toBe("ROLE_FORBIDDEN");
    expect(t.w.counts()).toEqual(before);
  });
});

describe("AC-2 [failure/refusal] unknown lesson and wrong state", () => {
  it("unknown_and_wrong_state", async () => {
    const unknown = build({ state: null });
    const r1 = await unknown.post("approver-token", approve_body(), { lesson: UNKNOWN_LID });
    expect(r1.status).toBe(404);
    expect(code_of(r1)).toBe("NOT_FOUND");

    const in_review = build({ state: "in_review" });
    const before = in_review.w.counts();
    const r2 = await in_review.post("approver-token", approve_body());
    expect(r2.status).toBe(409);
    expect(code_of(r2)).toBe("INVALID_TRANSITION");
    expect(in_review.w.counts()).toEqual(before);

    const t = build();
    expect((await t.post("approver-token", approve_body())).status).toBe(200);
    const after_first = t.w.counts();
    const r3 = await t.post("approver2-token", approve_body());
    expect(r3.status).toBe(409);
    expect(code_of(r3)).toBe("INVALID_TRANSITION");
    expect(t.w.counts()).toEqual(after_first);
  });
});

describe("AC-3 [failure/refusal] missing input ranks after INVALID_TRANSITION and before STALE_PIN", () => {
  it("missing_input_codes_before_pin", async () => {
    const a = build();
    const ba = a.w.counts();
    const { rating: _r, ...no_rating } = approve_body({ snapshot_hash: HASH2 });
    const r1 = await a.post("approver-token", no_rating); // stale pin AND no rating -> RATING_REQUIRED
    expect(r1.status).toBe(st("RATING_REQUIRED"));
    expect(code_of(r1)).toBe("RATING_REQUIRED");
    const r1b = await a.post("approver-token", approve_body({ rating: null }));
    expect(code_of(r1b)).toBe("RATING_REQUIRED");
    expect(a.w.counts()).toEqual(ba);

    const wrong_state = build({ state: "in_review" });
    const { rating: _x, ...nr } = approve_body();
    expect(code_of(await wrong_state.post("approver-token", nr))).toBe("INVALID_TRANSITION");

    const b = build();
    const bb = b.w.counts();
    const r2 = await b.post("approver-token", { action: "request_changes", tag: "standards", note: "" });
    expect(r2.status).toBe(st("NOTE_REQUIRED"));
    expect(code_of(r2)).toBe("NOTE_REQUIRED");
    expect(b.w.counts()).toEqual(bb);
    expect(b.collab.all_calls).toBe(0);

    const c = build({ state: "approved" });
    c.w.add_version("approve", "clean", HASH, VEC);
    const bc = c.w.counts();
    const r3 = await c.post("approver-token", { action: "reopen" });
    expect(r3.status).toBe(st("REASON_REQUIRED"));
    expect(code_of(r3)).toBe("REASON_REQUIRED");
    expect(c.w.counts()).toEqual(bc);
    expect(c.collab.all_calls).toBe(0);
  });
});

describe("AC-4 [failure/refusal] the pin must match hash and state vector", () => {
  it("stale_hash_and_stale_vector_refused", async () => {
    const t = build();
    const before = t.w.counts();
    const r1 = await t.post("approver-token", approve_body({ snapshot_hash: HASH2 }));
    expect(r1.status).toBe(409);
    expect(code_of(r1)).toBe("STALE_PIN");
    expect(details_of(r1)["request_id"]).toBe(r1.headers["X-Request-Id"]);
    const r2 = await t.post("approver-token", approve_body({ snapshot_state_vector: VEC2 }));
    expect(r2.status).toBe(409);
    expect(code_of(r2)).toBe("STALE_PIN");
    expect(details_of(r2)["request_id"]).toBe(r2.headers["X-Request-Id"]);
    expect(t.w.counts()).toEqual(before);
    expect(t.w.lesson?.state).toBe("submitted");
  });
  it("stale_hash_and_stale_vector_refused: the pin is the latest snapshot, never an older submit", async () => {
    const t = build();
    t.w.add_version("submit", "clean", HASH2, VEC2); // a newer submit supersedes the one at HASH
    const r = await t.post("approver-token", approve_body());
    expect(code_of(r)).toBe("STALE_PIN");
  });
});

describe("AC-5 [failure/refusal] precedence and the four-eyes toggle", () => {
  it("precedence_and_four_eyes_toggle", async () => {
    const t = build({ four_eyes: true });
    t.w.lesson!.last_editor_id = APPROVER_ID;
    const before = t.w.counts();
    const r1 = await t.post("approver-token", approve_body({ snapshot_hash: HASH2 }));
    expect(code_of(r1)).toBe("STALE_PIN"); // stale pin AND four-eyes breach
    const r2 = await t.post("approver-token", approve_body()); // role alone is not enough
    expect(r2.status).toBe(st("FOUR_EYES"));
    expect(code_of(r2)).toBe("FOUR_EYES");
    expect(t.w.counts()).toEqual(before);
    // another approver is fine
    expect((await t.post("approver2-token", approve_body())).status).toBe(200);

    const off = build({ four_eyes: false });
    off.w.lesson!.last_editor_id = APPROVER_ID;
    const r3 = await off.post("approver-token", approve_body());
    expect(r3.status).toBe(200);
    expect(code_of(r3)).toBeUndefined();
  });
});

describe("AC-6 [failure/refusal] gate order: suggestion, blocked, confirmation", () => {
  it("suggestion_blocked_confirmation_order", async () => {
    const a = build({ submit_title: "clean" });
    a.w.pending_suggestions = 1;
    const ba = a.w.counts();
    const r1 = await a.post("approver-token", approve_body());
    expect(r1.status).toBe(st("SUGGESTION_PENDING"));
    expect(code_of(r1)).toBe("SUGGESTION_PENDING");
    expect(a.w.counts()).toEqual(ba);

    const mixed = build({ submit_title: "[Q][C]" });
    mixed.w.pending_suggestions = 1; // suggestion outranks blocked
    expect(code_of(await mixed.post("approver-token", approve_body()))).toBe("SUGGESTION_PENDING");

    const b = build({ submit_title: "[Q][C]" });
    const r2 = await b.post("approver-token", approve_body());
    expect(r2.status).toBe(st("BLOCKED"));
    expect(code_of(r2)).toBe("BLOCKED");
    const levels = (details_of(r2)["issues"] as Array<{ level: string }>).map((i) => i.level).sort();
    expect(levels).toEqual(["blocking", "confirmation"]);

    const c = build({ submit_title: "[C]" });
    const bc = c.w.counts();
    const r3 = await c.post("approver-token", approve_body());
    expect(r3.status).toBe(st("CONFIRMATION_OPEN"));
    expect(code_of(r3)).toBe("CONFIRMATION_OPEN");
    expect(c.w.counts()).toEqual(bc);
  });
});

describe("AC-7 [invariant] checks run on the snapshot; resolutions carry; unresolvable kinds still block", () => {
  it("resolutions_carry_to_rerun_on_snapshot", async () => {
    const a = build({ submit_title: "[Q]" });
    expect(code_of(await a.post("approver-token", approve_body()))).toBe("BLOCKED");
    const b = build({ submit_title: "[Q]" });
    b.w.recorded = [RESOLVE_Q];
    const r = await b.post("approver-token", approve_body());
    expect(r.status).toBe(200);
    // the loader (and so run_checks) was given the snapshot lesson and its hash, not a live document
    expect(b.loader.calls).toHaveLength(1);
    expect(b.loader.calls[0]!.lesson.title).toBe("[Q]");
    expect(b.loader.calls[0]!.content_hash).toBe(HASH);
    expect(b.loader.calls[0]!.lesson_id).toBe(LID);

    const s = build({ submit_title: "[S]" });
    s.w.recorded = [RESOLVE_S]; // safety_flag_open cannot be resolved (WP-4)
    const rs = await s.post("approver-token", approve_body());
    expect(code_of(rs)).toBe("BLOCKED");
  });
  it("resolutions_carry_to_rerun_on_snapshot: a flaw only in the live text does not block (snapshot, not live)", async () => {
    const t = build({ submit_title: "clean" });
    t.w.live.title = "[Q] edited after the submit";
    expect((await t.post("approver-token", approve_body())).status).toBe(200);
  });
});

describe("AC-8 [failure/refusal] dependency order and rights", () => {
  it("dependency_unapproved_and_rights", async () => {
    const a = build();
    a.w.deps = [{ direction: "waits_on", lesson_id: SRC_LID, slot_id: "slot-L5-text", source_state: "in_review", slot_filled: true, source_approved_hash: null }];
    const ba = a.w.counts();
    const r1 = await a.post("approver-token", approve_body());
    expect(r1.status).toBe(st("DEPENDENCY_UNAPPROVED"));
    expect(code_of(r1)).toBe("DEPENDENCY_UNAPPROVED");
    expect(JSON.stringify(details_of(r1))).toContain(SRC_LID);
    expect(a.w.counts()).toEqual(ba);

    const b = build({ submit_title: "[R]" });
    b.w.recorded = [RESOLVE_R]; // rights_to_clear is not resolvable
    const r2 = await b.post("approver-token", approve_body());
    expect(code_of(r2)).toBe("BLOCKED");
  });
});

describe("AC-9 / AC-17 [invariant, capture] submit then approve, and a stale-pin approve", () => {
  it("test_transition_capture", async () => {
    const t = build({ state: "in_review", submit_title: null });
    t.w.live = { title: "clean", hash: HASH, vector: VEC };
    const rs = await t.post("reviewer-token", SUBMIT);
    expect(rs.status).toBe(200);
    expect(t.w.count_kind("submit")).toBe(1);
    expect(t.w.events).toHaveLength(1);
    const snap = t.w.versions.find((v) => v.kind === "submit")!;

    // stale pin: refused, no row, one log line with request_id and STALE_PIN
    const before = t.w.counts();
    const stale = await t.post("approver-token", approve_body({ snapshot_hash: HASH2 }));
    expect(code_of(stale)).toBe("STALE_PIN");
    expect(t.w.counts()).toEqual(before);
    const refused = t.lines.filter((l) => l.includes("route.refused"));
    expect(refused).toHaveLength(1);
    expect(refused[0]).toContain(String(stale.headers["X-Request-Id"]));
    expect(refused[0]).toContain("STALE_PIN");

    const ok = await t.post("approver-token", approve_body({ snapshot_hash: snap.content_hash, snapshot_state_vector: snap.state_vector }));
    expect(ok.status).toBe(200);
    const body = ok.body as Record<string, any>;
    expect(body["from_state"]).toBe("submitted");
    expect(body["to_state"]).toBe("approved");
    expect(body["metrics_row_written"]).toBe(true);
    expect(body["version"]["content_hash"]).toBe(HASH);
    expect(t.w.count_kind("approve")).toBe(1);
    expect(t.w.events).toHaveLength(2); // one review_event per move
    expect(t.w.lesson?.state).toBe("approved");
    expect(t.w.metrics).toHaveLength(1);
    const ap = t.w.versions.find((v) => v.kind === "approve")!;
    expect(t.w.metrics[0]).toMatchObject({ rating: "usable_with_edits", version_id: ap.version_id });
    expect(body["version"]["version_id"]).toBe(ap.version_id);
  });
  it("test_transition_capture: approval is by a named person, other than the last editor", async () => {
    const t = build();
    expect(t.w.lesson?.last_editor_id).toBe(REVIEWER_ID);
    const r = await t.post("approver-token", approve_body());
    expect(r.status).toBe(200);
    expect(t.w.events.at(-1)!.actor_id).toBe(APPROVER_ID);
  });
});

describe("AC-10 [invariant] audit id and dependency record", () => {
  it("audit_id_and_dependency_record", async () => {
    const t = build();
    t.w.deps = [{ direction: "waits_on", lesson_id: SRC_LID, slot_id: "slot-L5-text", source_state: "approved", slot_filled: true, source_approved_hash: SRC_HASH }];
    const r = await t.post("approver-token", approve_body());
    expect(r.status).toBe(200);
    const body = r.body as Record<string, any>;
    expect(body["audit_id"]).toBe(t.w.events.at(-1)!.review_event_id);
    expect(t.w.audit_events).toHaveLength(0);
    expect(body["dependency_record"]).toEqual([{ lesson_id: SRC_LID, approved_hash: SRC_HASH }]);
    expect(t.w.versions.find((v) => v.kind === "approve")!.dependency_record).toEqual([{ lesson_id: SRC_LID, approved_hash: SRC_HASH }]);
  });
});

describe("AC-11 [invariant] the first approval's metrics row stays frozen across reopen", () => {
  it("second_approval_keeps_frozen_row", async () => {
    const t = build();
    expect((await t.post("approver-token", approve_body())).status).toBe(200);
    const frozen = JSON.stringify(t.w.metrics);
    const first_approve = t.w.versions.find((v) => v.kind === "approve")!;

    const re = await t.post("approver-token", { action: "reopen", reason: "needs a rewrite of Part A" });
    expect(re.status).toBe(200);
    const reopen = t.w.versions.find((v) => v.kind === "reopen")!;
    expect((reopen.provenance as unknown as { derived_from_version_id: string }).derived_from_version_id).toBe(first_approve.version_id);

    t.w.live = { title: "clean v2", hash: HASH2, vector: VEC2 };
    expect((await t.post("reviewer-token", SUBMIT)).status).toBe(200);
    const r = await t.post("approver-token", approve_body({ snapshot_hash: HASH2, snapshot_state_vector: VEC2 }));
    expect(r.status).toBe(200);
    expect((r.body as Record<string, unknown>)["metrics_row_written"]).toBe(false);
    expect(JSON.stringify(t.w.metrics)).toBe(frozen);
    expect(t.w.metrics).toHaveLength(1);
    expect(t.w.count_kind("approve")).toBe(2);
  });
});

describe("AC-12 [invariant] concurrent approves: one winner", () => {
  it("concurrent_approve_single_winner", async () => {
    const t = build({ four_eyes: false });
    const [a, b] = await Promise.all([
      t.post("approver-token", approve_body()),
      t.post("approver2-token", approve_body()),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect(code_of(loser)).toBe("INVALID_TRANSITION");
    expect(t.w.count_kind("approve")).toBe(1);
    expect(t.w.metrics).toHaveLength(1);
    expect(t.w.events).toHaveLength(1);
  });
});

describe("AC-15 [failure/refusal] origin and session", () => {
  it("foreign_origin_and_no_session", async () => {
    const t = build();
    const before = t.w.counts();
    const foreign = await t.post("approver-token", approve_body(), { origin: "https://evil.example" });
    expect(foreign.status).toBe(401);
    expect(code_of(foreign)).toBe("UNAUTHENTICATED");
    const none = await t.post(null, approve_body());
    expect(none.status).toBe(401);
    expect(code_of(none)).toBe("UNAUTHENTICATED");
    const missing_origin = await t.post("approver-token", approve_body(), { origin: null });
    expect(code_of(missing_origin)).toBe("UNAUTHENTICATED");
    expect(t.w.counts()).toEqual(before);
    expect(t.collab.all_calls).toBe(0);
  });
});

describe("AC-16 [negative] no key or note leaks", () => {
  it("no_secrets_in_responses_or_logs", async () => {
    process.env["ANTHROPIC_API_KEY"] = KEY_MARK;
    const t = build();
    const rs = [
      await t.post("reviewer-token", { action: "withdraw", note: `${NOTE_MARK} withdraw` }),
      await t.post("approver-token", approve_body()), // refused: back in_review
    ];
    const t2 = build();
    rs.push(
      await t2.post("approver-token", { action: "request_changes", tag: "standards", note: `${NOTE_MARK} send back` }),
      await t2.post("approver-token", approve_body({ snapshot_hash: HASH2 })),
    );
    expect(t.w.events.some((e) => e.note?.includes(NOTE_MARK))).toBe(true);
    expect(t2.w.events.some((e) => e.note?.includes(NOTE_MARK))).toBe(true);
    const everywhere = JSON.stringify(rs) + t.lines.join("\n") + t2.lines.join("\n") + t.w.dump() + t2.w.dump();
    expect(everywhere).not.toContain(KEY_MARK);
    // the note lives only in review_event.note: not in responses, logs, versions, lesson or metrics rows
    expect(everywhere).not.toContain(NOTE_MARK);
  });
});
