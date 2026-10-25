import type { components } from "@/lib/api-types";
import type { Role } from "@/lib/roles";

type BoardRow = components["schemas"]["BoardRow"];

export function lessonHref(unitKey: string, role: Role, row: Pick<BoardRow, "lesson_key" | "state">): string {
  if (role === "approver" && row.state === "submitted") return `/units/${unitKey}/lessons/${row.lesson_key}/approve`;
  return `/units/${unitKey}/lessons/${row.lesson_key}`;
}

export function runHref(unitKey: string, runId: string): string {
  return `/units/${unitKey}/runs/${runId}`;
}

export function validationReportHref(unitKey: string, versionNumber: number): string {
  return `/units/${unitKey}/outlines/${versionNumber}`;
}
