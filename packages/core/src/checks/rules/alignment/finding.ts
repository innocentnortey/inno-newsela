import type { CheckFinding, CheckKind, IssueLevelName } from "../../types.ts";

export function make_finding(
  kind: CheckKind,
  level: IssueLevelName,
  message: string,
  o: Partial<Pick<CheckFinding, "address" | "span_anchor" | "related_lesson_id" | "code">> = {},
): CheckFinding {
  return { kind, level, message, address: null, span_anchor: null, related_lesson_id: null, code: null, ...o };
}
