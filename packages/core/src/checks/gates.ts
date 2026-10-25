import type {
  ApiErrorCode,
  CheckFinding,
  CheckKind,
  GateDecision,
  GateIssue,
  GateState,
  JsonValue,
  RecordedResolution,
} from "./types.ts";

// CON-13: these kinds cannot be resolved by a recorded resolution.
export const NON_RESOLVABLE: ReadonlySet<CheckKind> = new Set<CheckKind>([
  "suggestion_pending",
  "standard_confirmation",
  "safety_flag_open",
  "safety_note_without_tip",
  "safety_text_in_student_block",
  "rights_to_clear",
  "cross_lesson_link",
]);

export function merge_resolutions(
  findings: readonly CheckFinding[],
  recorded: readonly RecordedResolution[],
): GateIssue[] {
  return findings.map((f) => {
    const resolved =
      !NON_RESOLVABLE.has(f.kind) &&
      recorded.some(
        (r) =>
          r.kind === f.kind &&
          r.address === f.address &&
          (r.code ?? null) === (f.code ?? null),
      );
    return {
      kind: f.kind,
      level: f.level,
      message: f.message,
      address: f.address,
      code: f.code ?? null,
      related_lesson_id: f.related_lesson_id,
      resolved,
    };
  });
}

function issue_json(i: GateIssue): JsonValue {
  return {
    kind: i.kind,
    level: i.level,
    message: i.message,
    address: i.address,
    code: i.code,
    related_lesson_id: i.related_lesson_id,
    resolved: i.resolved,
  };
}

function details_for(code: ApiErrorCode, state: GateState): JsonValue {
  const unresolved = state.issues.filter((i) => !i.resolved);
  switch (code) {
    case "BLOCKED":
      return {
        issues: unresolved
          .filter((i) => i.level === "blocking" || i.level === "confirmation")
          .map(issue_json),
      };
    case "CONFIRMATION_OPEN":
      return {
        issues: unresolved
          .filter((i) => i.level === "confirmation")
          .map(issue_json),
      };
    case "SUGGESTION_PENDING":
      return { count: state.pending_suggestions };
    case "FOUR_EYES":
      return { user_id: state.approver_id };
    case "DEPENDENCY_UNAPPROVED": {
      const ids = unresolved_dependencies(state).map((d) => d.lesson_id);
      return {
        source_lesson_ids: ids,
        message: `${ids.join(", ")} must be approved first`,
      };
    }
    default:
      return {};
  }
}

function unresolved_dependencies(state: GateState): GateState["dependencies"] {
  return state.dependencies.filter(
    (d) =>
      d.direction === "waits_on" &&
      (d.source_state !== "approved" || !d.slot_filled),
  );
}

function decide(
  state: GateState,
  order: readonly [ApiErrorCode, boolean][],
): GateDecision {
  const refusals = order.filter(([, hit]) => hit).map(([code]) => code);
  const first = refusals[0];
  return {
    allowed: refusals.length === 0,
    refusals,
    details: first === undefined ? {} : details_for(first, state),
  };
}

function shared_conditions(state: GateState): {
  pending: boolean;
  blocked: boolean;
  confirm_open: boolean;
} {
  return {
    pending: state.pending_suggestions > 0,
    blocked: state.issues.some((i) => i.level === "blocking" && !i.resolved),
    confirm_open: state.open_confirmations > 0,
  };
}

export function submit_gate(state: GateState): GateDecision {
  const c = shared_conditions(state);
  return decide(state, [
    ["SUGGESTION_PENDING", c.pending],
    ["BLOCKED", c.blocked],
    ["CONFIRMATION_OPEN", c.confirm_open],
  ]);
}

export function approve_gate(state: GateState): GateDecision {
  const c = shared_conditions(state);
  const four_eyes =
    state.four_eyes_enabled &&
    state.last_editor_id !== null &&
    state.last_editor_id === state.approver_id;
  return decide(state, [
    ["FOUR_EYES", four_eyes],
    ["SUGGESTION_PENDING", c.pending],
    ["BLOCKED", c.blocked],
    ["CONFIRMATION_OPEN", c.confirm_open],
    ["DEPENDENCY_UNAPPROVED", unresolved_dependencies(state).length > 0],
  ]);
}
