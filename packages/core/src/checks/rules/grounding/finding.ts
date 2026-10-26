import type { CheckFinding, CheckKind, IssueLevelName } from "../../types.ts";

/** The one place a grounding finding is built. Messages are fixed sentences: never the matched text. `matched` is the name or page reference that tripped the check. In memory only: not written to issue or finding rows, logs or error text. The repair prompt reads it, and that rendered prompt is stored in model_call.rendered_prompt like every prompt (docs/design/observability.md, Content and redaction, R-48). */
export function make_finding(
  kind: CheckKind,
  level: IssueLevelName,
  message: string,
  address: string | null,
  matched?: string,
): CheckFinding {
  return {
    kind,
    level,
    message,
    address,
    span_anchor: null,
    related_lesson_id: null,
    code: null,
    ...(matched !== undefined ? { matched } : {}),
  };
}
