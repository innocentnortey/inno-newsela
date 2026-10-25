import { lessonKeyFromId, unitIdFromKey } from "@/lib/keys";
import type { components } from "@/lib/api-types";

type PlanEntry = components["schemas"]["PlanEntry"];

export const PLANNING_TEXT =
  "The plan is being written (one call). It appears here before any lesson is drafted.";
export const EMPTY_TEXT = "No plan yet. A run writes the plan first.";
export const FAILED_TEXT =
  "The plan couldn't be written, so the run is paused. Resume the run from its progress page to try again.";
export const NO_LINKS_TEXT = "No links between lessons.";

function gradeUnit(unitKey: string): string | null {
  const id = unitIdFromKey(unitKey);
  const m = id ? /^G(\d+)\.U(\d+)$/.exec(id) : null;
  return m ? `Grade ${m[1]} · Unit ${m[2]}` : null;
}

export function unitLabel(unitKey: string): string {
  return gradeUnit(unitKey) ?? unitKey;
}

export function planHeading(unitKey: string): string {
  return `Unit plan · ${unitLabel(unitKey)}`;
}

export function sortByDay(entries: PlanEntry[]): PlanEntry[] {
  return [...entries].sort((a, b) => a.day - b.day);
}

export function lessonTitle(lessonId: string): string {
  const key = lessonKeyFromId(lessonId);
  if (!key) return lessonId;
  if (key.startsWith("L")) return `Lesson ${key.slice(1)}`;
  if (key.startsWith("F")) return `Flex ${key.slice(1)}`;
  return lessonId;
}

export function lessonHref(unitKey: string, lessonId: string): string | null {
  const key = lessonKeyFromId(lessonId);
  return key ? `/units/${unitKey}/lessons/${key}` : null;
}

export function splitLinkLabel(
  label: string,
): { from: string; to: string } | null {
  const i = label.indexOf(" → ");
  if (i < 0) return null;
  return { from: label.slice(0, i), to: label.slice(i + 3) };
}
