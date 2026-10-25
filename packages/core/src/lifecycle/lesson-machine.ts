// Lesson state machine (CON-18). Pure: no clock, no IO, no randomness.
// Callers (WriteGuard, apply_edit) use is_editable; pin, four-eyes, blocking and
// dependency refusals belong to services and are never returned here.
import type { Role } from "@ls/schema/api/session";
import type { LessonState } from "@ls/schema/api/board";
import type { ErrorCode } from "@ls/schema/api/common";
import type { Approve } from "@ls/schema/api/transition";

export type TransitionAction =
  | "start_review"
  | "submit"
  | "withdraw"
  | "approve"
  | "request_changes"
  | "reopen";

type CollabMode = "editable" | "read_only";

export interface TransitionInput {
  action: TransitionAction;
  role: Role;
  from_state: LessonState;
  note?: string | null;
  reason?: string | null;
  tag?: string | null;
  rating?: Approve["rating"] | null;
}

export interface TransitionDecision {
  allowed: boolean;
  to_state: LessonState | null;
  refusal: Extract<
    ErrorCode,
    "ROLE_FORBIDDEN" | "INVALID_TRANSITION" | "NOTE_REQUIRED" | "REASON_REQUIRED" | "RATING_REQUIRED"
  > | null;
  writes_snapshot: "submit" | "approve" | "reopen" | null;
  collab_mode_after: CollabMode | null;
}

interface Move {
  role: Role;
  from: readonly LessonState[];
  to: LessonState;
  snapshot: TransitionDecision["writes_snapshot"];
  mode: CollabMode | null;
  need?: "rating" | "note" | "reason";
}

const MOVES: Record<TransitionAction, Move> = {
  start_review: { role: "reviewer", from: ["draft"], to: "in_review", snapshot: null, mode: null },
  submit: {
    role: "reviewer",
    from: ["in_review", "changes_requested", "reopened"],
    to: "submitted",
    snapshot: "submit",
    mode: "read_only",
  },
  withdraw: { role: "reviewer", from: ["submitted"], to: "in_review", snapshot: null, mode: "editable" },
  approve: {
    role: "approver",
    from: ["submitted"],
    to: "approved",
    snapshot: "approve",
    mode: null,
    need: "rating",
  },
  request_changes: {
    role: "approver",
    from: ["submitted"],
    to: "changes_requested",
    snapshot: null,
    mode: "editable",
    need: "note",
  },
  reopen: {
    role: "approver",
    from: ["approved", "exported"],
    to: "reopened",
    snapshot: "reopen",
    mode: "editable",
    need: "reason",
  },
};

const EDITABLE_STATES: readonly LessonState[] = ["in_review", "changes_requested", "reopened"];

function refuse(refusal: NonNullable<TransitionDecision["refusal"]>): TransitionDecision {
  return { allowed: false, to_state: null, refusal, writes_snapshot: null, collab_mode_after: null };
}

function blank(v: unknown): boolean {
  return typeof v !== "string" || v.trim() === "";
}

// Precedence: role, then state, then missing input.
export function decide_transition(i: TransitionInput): TransitionDecision {
  const move = MOVES[i.action];
  if (i.role !== move.role) return refuse("ROLE_FORBIDDEN");
  if (!move.from.includes(i.from_state)) return refuse("INVALID_TRANSITION");
  if (move.need === "rating" && i.rating == null) return refuse("RATING_REQUIRED");
  if (move.need === "note" && blank(i.note)) return refuse("NOTE_REQUIRED");
  if (move.need === "reason" && blank(i.reason)) return refuse("REASON_REQUIRED");
  return {
    allowed: true,
    to_state: move.to,
    refusal: null,
    writes_snapshot: move.snapshot,
    collab_mode_after: move.mode,
  };
}

export function transition_roles(action: TransitionAction): Role[] {
  return [MOVES[action].role];
}

export function is_editable(state: LessonState, role: Role): boolean {
  return role === "reviewer" && EDITABLE_STATES.includes(state);
}
