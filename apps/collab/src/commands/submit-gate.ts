// Pure-ish helper: run the checks on the stored row and turn the findings into a Submit gate decision.
import { DomainRefusal } from "@ls/core/errors";
import { merge_resolutions, submit_gate } from "@ls/core/checks/gates";
import type { GateState } from "@ls/core/checks/types";
import type { StoredLesson } from "@ls/schema/lesson";
import type { CollabCommandHandlerDeps } from "./types.ts";

export async function evaluate_submit_gate(
  deps: Pick<CollabCommandHandlerDeps, "loader" | "rules" | "policy" | "issues">,
  lesson_id: string,
  stored: { lesson: StoredLesson; content_hash: string },
): Promise<void> {
  const ctx = await deps.loader.load(lesson_id, stored.lesson, stored.content_hash as never);
  // The rules alone: the gate needs findings, not the derived alignment run_checks also computes (the stub contexts carry no row).
  const findings = deps.rules.flatMap((rule) => rule.run(ctx, deps.policy));
  const issues = merge_resolutions(findings, await deps.issues.resolutions_for(lesson_id));
  const state: GateState = {
    action: "submit",
    issues,
    pending_check: false,
    pending_suggestions: ctx.pending_suggestions.length,
    open_confirmations: issues.filter((i) => i.level === "confirmation" && !i.resolved).length,
    last_editor_id: null,
    approver_id: null,
    four_eyes_enabled: false,
    dependencies: [],
  };
  const g = submit_gate(state);
  if (!g.allowed) throw new DomainRefusal(g.refusals[0] ?? "BLOCKED", "This lesson cannot be submitted yet", g.details);
}
