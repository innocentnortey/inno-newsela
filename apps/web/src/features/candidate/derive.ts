import { isReadOnly } from "@/features/workspace/state-model";
import type { ApiErrorCode } from "@/lib/api-client";
import type { components } from "@/lib/api-types";
import type { Role } from "@/lib/roles";
import { COLLAB, DAY_CAP, NETWORK, locked } from "./copy";

export type Lesson = components["schemas"]["Lesson"];
export type Candidate = components["schemas"]["Candidate"];
export type Section = components["schemas"]["Section"];

export interface Row {
  address: string;
  name: string;
  current: Section | null;
  candidate: Section | null;
}

/** Candidate order first, then sections only the current lesson has. Neither side is edited. */
export function alignRows(current: Section[], candidate: Section[]): Row[] {
  const cur = new Map(current.map((s) => [s.address, s]));
  const seen = new Set<string>();
  const rows: Row[] = [];
  for (const c of candidate) {
    if (seen.has(c.address)) continue;
    seen.add(c.address);
    rows.push({ address: c.address, name: c.name, current: cur.get(c.address) ?? null, candidate: c });
  }
  for (const s of current) {
    if (seen.has(s.address)) continue;
    seen.add(s.address);
    rows.push({ address: s.address, name: s.name, current: s, candidate: null });
  }
  return rows;
}

export const FROZEN: readonly Lesson["state"][] = ["submitted", "approved", "exported"];

export function canAdopt(input: {
  role: Role;
  lessonState: Lesson["state"];
  candidate: Pick<Candidate, "status" | "adopted">;
}): boolean {
  const { role, lessonState, candidate } = input;
  return (
    !isReadOnly(role, lessonState) &&
    candidate.status === "ready" &&
    !candidate.adopted &&
    !FROZEN.includes(lessonState)
  );
}

/** null: no sentence of its own (INVALID_TRANSITION reloads the real state; unknown codes get the generic line). */
export function errorSentence(code: ApiErrorCode, lessonLabel: string): string | null {
  switch (code) {
    case "LESSON_LOCKED":
      return locked(lessonLabel);
    case "DAY_CAP_REACHED":
      return DAY_CAP;
    case "COLLAB_UNAVAILABLE":
      return COLLAB;
    case "NETWORK":
      return NETWORK;
    default:
      return null;
  }
}

export const candidateLabel = (version: number): string => `Candidate v${version}`;
