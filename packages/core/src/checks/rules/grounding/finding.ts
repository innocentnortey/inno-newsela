import type { CheckFinding, CheckKind, IssueLevelName } from "../../types.ts";

/** The one place a grounding finding is built. Messages are fixed sentences: never the matched text. */
export function make_finding(
  kind: CheckKind,
  level: IssueLevelName,
  message: string,
  address: string | null,
): CheckFinding {
  return {
    kind,
    level,
    message,
    address,
    span_anchor: null,
    related_lesson_id: null,
    code: null,
  };
}
