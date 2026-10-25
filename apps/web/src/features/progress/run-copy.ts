import type { components } from "@/lib/api-types";
import { unitIdFromKey } from "@/lib/keys";

type RunProgress = components["schemas"]["RunProgress"];
type Tile = components["schemas"]["Tile"];
type RunState = components["schemas"]["RunState"];
export type ControlAction = "cancel" | "retry_failed" | "resume";

export function formatUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

/** Matches the OpenAPI text on controlRun. */
export function availableControls(state: RunState): ControlAction[] {
  switch (state) {
    case "planning":
    case "running":
      return ["cancel"];
    case "paused":
      return ["resume", "cancel"];
    case "partial":
      return ["retry_failed"];
    default:
      return [];
  }
}

export function failureLine(tile: Tile): string {
  const reasons = tile.failure_reasons;
  if (reasons.length === 0) return "Failed";
  if (reasons[0]?.check === "truncated") {
    return tile.truncation_retry_used
      ? "Failed: truncated (retried once with a bigger limit)"
      : "Failed: truncated";
  }
  return (
    (tile.repair_used ? "Failed after 1 repair: " : "Failed: ") +
    reasons.map((r) => r.message).join("; ")
  );
}

export function pausedSentence(p: RunProgress): string {
  const reason = p.paused_reason;
  const n = reason?.lesson_ids.length ?? 0;
  const first = p.tiles.find((t) => reason?.lesson_ids.includes(t.lesson_id));
  const why = first?.failure_reasons[0]?.message ?? reason?.check ?? "";
  return `Run paused: ${n} lessons in a row failed the same check (${why}). Read the failures, then resume.`;
}

export function controlErrorText(action: ControlAction): string {
  if (action === "cancel")
    return "Couldn't cancel. Nothing changed. Try again.";
  if (action === "retry_failed")
    return "Couldn't retry. Nothing changed. Try again.";
  return "Couldn't resume. Nothing changed. Try again.";
}

export function unitLabel(unitKey: string): string {
  const id = unitIdFromKey(unitKey);
  const m = id ? /^G(\d+)\.U(\d+)$/.exec(id) : null;
  return m ? `Grade ${m[1]} · Unit ${m[2]}` : unitKey;
}
