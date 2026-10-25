// NL-21 frozen tests (AC-1, AC-2, AC-3). Written first from the ticket's CON-18 move table.
// The oracle below is deliberately independent of the implementation: literal rows, no shared constants.
import { describe, expect, it } from "vitest";
import { decide_transition } from "./lesson-machine.ts";

const ACTIONS = ["start_review", "submit", "withdraw", "approve", "request_changes", "reopen"] as const;
const STATES = [
  "generation_failed",
  "draft",
  "in_review",
  "submitted",
  "changes_requested",
  "approved",
  "reopened",
  "exported",
] as const;
const ROLES = ["author", "reviewer", "approver"] as const;

type Action = (typeof ACTIONS)[number];
type State = (typeof STATES)[number];
type RoleName = (typeof ROLES)[number];
type Need = "rating" | "note" | "reason" | null;

interface Row {
  action: Action;
  role: RoleName;
  from: State;
  to: State;
  snapshot: "submit" | "approve" | "reopen" | null;
  mode: "editable" | "read_only" | null;
  need: Need;
}

// The 9 allowed rows of CON-18, one per (role, action, from-state).
const ORACLE: Row[] = [
  { action: "start_review", role: "reviewer", from: "draft", to: "in_review", snapshot: null, mode: null, need: null },
  { action: "submit", role: "reviewer", from: "in_review", to: "submitted", snapshot: "submit", mode: "read_only", need: null },
  { action: "submit", role: "reviewer", from: "changes_requested", to: "submitted", snapshot: "submit", mode: "read_only", need: null },
  { action: "submit", role: "reviewer", from: "reopened", to: "submitted", snapshot: "submit", mode: "read_only", need: null },
  { action: "withdraw", role: "reviewer", from: "submitted", to: "in_review", snapshot: null, mode: "editable", need: null },
  { action: "approve", role: "approver", from: "submitted", to: "approved", snapshot: "approve", mode: null, need: "rating" },
  { action: "request_changes", role: "approver", from: "submitted", to: "changes_requested", snapshot: null, mode: "editable", need: "note" },
  { action: "reopen", role: "approver", from: "approved", to: "reopened", snapshot: "reopen", mode: "editable", need: "reason" },
  { action: "reopen", role: "approver", from: "exported", to: "reopened", snapshot: "reopen", mode: "editable", need: "reason" },
];

const ROLE_OF: Record<Action, RoleName> = {
  start_review: "reviewer",
  submit: "reviewer",
  withdraw: "reviewer",
  approve: "approver",
  request_changes: "approver",
  reopen: "approver",
};

type Refusal = "ROLE_FORBIDDEN" | "INVALID_TRANSITION" | "NOTE_REQUIRED" | "REASON_REQUIRED" | "RATING_REQUIRED";
const MISSING_CODE: Record<Exclude<Need, null>, Refusal> = {
  rating: "RATING_REQUIRED",
  note: "NOTE_REQUIRED",
  reason: "REASON_REQUIRED",
};

const REFUSED = (refusal: Refusal) => ({
  allowed: false,
  to_state: null,
  refusal,
  writes_snapshot: null,
  collab_mode_after: null,
});

function oracle(action: Action, role: RoleName, from: State, supplied: boolean) {
  if (ROLE_OF[action] !== role) return REFUSED("ROLE_FORBIDDEN");
  const row = ORACLE.find((r) => r.action === action && r.role === role && r.from === from);
  if (!row) return REFUSED("INVALID_TRANSITION");
  if (row.need !== null && !supplied) return REFUSED(MISSING_CODE[row.need]);
  return {
    allowed: true,
    to_state: row.to,
    refusal: null,
    writes_snapshot: row.snapshot,
    collab_mode_after: row.mode,
  };
}

const SUPPLIED = { note: "Tighten the exit ticket.", reason: "Standards changed.", rating: "usable_with_edits" } as const;

describe("exhaustive [invariant]", () => {
  it("covers 6 actions x 8 states x 3 roles, with and without the missing input, matching the oracle", () => {
    let rows = 0;
    let allowed = 0;
    for (const action of ACTIONS) {
      for (const from_state of STATES) {
        for (const role of ROLES) {
          for (const supplied of [false, true]) {
            const input = supplied
              ? { action, role, from_state, ...SUPPLIED }
              : { action, role, from_state };
            const got = decide_transition(input);
            expect(got, `${action}/${role}/${from_state}/supplied=${supplied}`).toEqual(oracle(action, role, from_state, supplied));
            rows += 1;
            if (supplied && got.allowed) allowed += 1;
          }
        }
      }
    }
    expect(rows).toBe(288);
    expect(allowed).toBe(9);
  });

  it("allows exactly the 9 (role, action, from-state) rows, with the input supplied", () => {
    const allowedRows: string[] = [];
    for (const action of ACTIONS)
      for (const from_state of STATES)
        for (const role of ROLES)
          if (decide_transition({ action, role, from_state, ...SUPPLIED }).allowed)
            allowedRows.push(`${role}:${action}:${from_state}`);
    expect(allowedRows.sort()).toEqual(ORACLE.map((r) => `${r.role}:${r.action}:${r.from}`).sort());
  });

  it("never leads to generation_failed or exported, and never returns service-owned codes", () => {
    const serviceCodes = ["PIN_MISMATCH", "FOUR_EYES", "BLOCKING_COMMENTS", "DEPENDENCY_UNMET", "STALE_VERSION"];
    for (const action of ACTIONS)
      for (const from_state of STATES)
        for (const role of ROLES) {
          const d = decide_transition({ action, role, from_state, ...SUPPLIED });
          expect(["generation_failed", "exported"]).not.toContain(d.to_state);
          expect(serviceCodes).not.toContain(d.refusal);
          expect([null, "ROLE_FORBIDDEN", "INVALID_TRANSITION", "NOTE_REQUIRED", "REASON_REQUIRED", "RATING_REQUIRED"]).toContain(d.refusal);
        }
  });
});

describe("role_first [failure/refusal]", () => {
  // Wrong role is refused first, even when the state is also wrong or the input is missing.
  const cases: Array<[string, Action, RoleName, State]> = [
    ["reviewer asks approve (right state, no rating)", "approve", "reviewer", "submitted"],
    ["reviewer asks approve (wrong state, no rating)", "approve", "reviewer", "draft"],
    ["approver asks start_review (right state)", "start_review", "approver", "draft"],
    ["approver asks submit (wrong state)", "submit", "approver", "approved"],
    ["author asks start_review", "start_review", "author", "draft"],
    ["author asks approve (no rating)", "approve", "author", "submitted"],
    ["author asks reopen (wrong state, no reason)", "reopen", "author", "draft"],
    ["author asks withdraw", "withdraw", "author", "submitted"],
  ];
  it.each(cases)("%s -> ROLE_FORBIDDEN", (_name, action, role, from_state) => {
    expect(decide_transition({ action, role, from_state })).toEqual(REFUSED("ROLE_FORBIDDEN"));
  });
});

describe("precedence [failure/refusal]", () => {
  it("approve on in_review with no rating -> INVALID_TRANSITION, not RATING_REQUIRED", () => {
    expect(decide_transition({ action: "approve", role: "approver", from_state: "in_review" })).toEqual(REFUSED("INVALID_TRANSITION"));
  });
  it("approve on submitted with no rating -> RATING_REQUIRED", () => {
    expect(decide_transition({ action: "approve", role: "approver", from_state: "submitted" })).toEqual(REFUSED("RATING_REQUIRED"));
  });
  it("request_changes on submitted with a blank note -> NOTE_REQUIRED", () => {
    expect(decide_transition({ action: "request_changes", role: "approver", from_state: "submitted", note: "   \n\t" })).toEqual(REFUSED("NOTE_REQUIRED"));
  });
  it("reopen on approved with a blank reason -> REASON_REQUIRED", () => {
    expect(decide_transition({ action: "reopen", role: "approver", from_state: "approved", reason: "  " })).toEqual(REFUSED("REASON_REQUIRED"));
  });
  it("reopen on exported with an empty reason -> REASON_REQUIRED", () => {
    expect(decide_transition({ action: "reopen", role: "approver", from_state: "exported", reason: "" })).toEqual(REFUSED("REASON_REQUIRED"));
  });
  it("a second approve on an approved lesson -> INVALID_TRANSITION", () => {
    expect(decide_transition({ action: "approve", role: "approver", from_state: "approved", rating: "rewritten" })).toEqual(REFUSED("INVALID_TRANSITION"));
  });
  it("start_review on an in_review lesson -> INVALID_TRANSITION", () => {
    expect(decide_transition({ action: "start_review", role: "reviewer", from_state: "in_review" })).toEqual(REFUSED("INVALID_TRANSITION"));
  });
});
