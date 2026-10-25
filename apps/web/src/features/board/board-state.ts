import { STATUS_SPECS, type StatusKey } from "@/components/ui/status";
import type { components } from "@/lib/api-types";

export type LessonState = components["schemas"]["LessonState"];

export const FILTER_PARAM_TO_STATE: Record<string, LessonState> = {
  draft: "draft",
  in_review: "in_review",
  submitted: "submitted",
  approved: "approved",
  failed: "generation_failed",
  changes_requested: "changes_requested",
  reopened: "reopened",
};

export function stateFromParam(v: string | null): LessonState | null {
  if (!v) return null;
  return Object.prototype.hasOwnProperty.call(FILTER_PARAM_TO_STATE, v) ? FILTER_PARAM_TO_STATE[v]! : null;
}

export function paramFromState(s: LessonState | null): string | null {
  if (!s) return null;
  const hit = Object.entries(FILTER_PARAM_TO_STATE).find(([, v]) => v === s);
  return hit ? hit[0] : null;
}

export const ROLLUP_ORDER = ["draft", "in_review", "submitted", "approved", "generation_failed"] as const;

/** The only sum the board allows: the server's counts added up (R-25). */
export function totalLessons(rollup: Record<string, number>): number {
  return Object.values(rollup).reduce((a, b) => a + b, 0);
}

export function stateLabel(s: LessonState): string {
  return STATUS_SPECS[`lesson.${s}` as StatusKey].label;
}

export function runIsActive(state: string | undefined): boolean {
  return state === "planning" || state === "running";
}
