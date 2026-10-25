import type { components } from "@/lib/api-types";
import { isSaving, type ClientStateInput } from "./client-state";

type IssueList = components["schemas"]["IssueList"];

export const firstIssueSelector = "[data-issue-card]";

function counts(issues: IssueList) {
  const open = issues.issues.filter((i) => i.resolution === null);
  return {
    blocking: open.filter((i) => i.level === "blocking" && i.blocks.includes("submit") && i.kind !== "suggestion_pending").length,
    confirm: open.filter((i) => i.level === "confirmation").length,
    suggestion: open.filter((i) => i.kind === "suggestion_pending").length,
  };
}

export const blockingCount = (issues: IssueList): number => counts(issues).blocking;

/** Why Submit is off, one string per reason, in spec order. Empty means enabled. */
export function submitReasons(issues: IssueList, clientState: ClientStateInput, forceSaving = false): string[] {
  const c = counts(issues);
  const out: string[] = [];
  if (c.blocking > 0) out.push(`${c.blocking} blocking issue${c.blocking === 1 ? "" : "s"}`);
  if (c.confirm > 0) out.push(`${c.confirm} standard${c.confirm === 1 ? "" : "s"} to confirm`);
  if (c.suggestion > 0) out.push("Accept or reject the AI suggestion first");
  if (isSaving(clientState) || forceSaving) out.push("Saving");
  return out;
}
