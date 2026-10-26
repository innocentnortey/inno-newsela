import type { components } from "@/lib/api-types";

export type Cell = components["schemas"]["CoverageMatrix"]["cells"][number];
export type CoverageLesson =
  components["schemas"]["CoverageMatrix"]["lessons"][number];
type Role = Cell["roles"][number];

export const COPY = {
  title: "Coverage",
  caption: "Coverage matrix",
  standardCol: "Standard",
  empty: "No lessons yet",
  noStandards: "No standards linked yet.",
  loading: "Loading coverage",
  neverAssessed: "Never assessed",
  notTaught: "Not taught here.",
} as const;

/** "G6.U4.L31" -> "Lesson 31"; an id without a trailing L<n> is shown as it is. */
export function lessonLabel(id: string): string {
  const m = /L(\d+)$/.exec(id);
  return m ? `Lesson ${m[1]}` : id;
}

export function lessonColumnLabel(lesson: CoverageLesson): string {
  return lesson.number === null
    ? lessonLabel(lesson.lesson_id)
    : `Lesson ${lesson.number}`;
}

export const ROLE_ORDER: readonly Role[] = ["I", "P", "A"];

export const ROLE_WORDS: Record<Role, string> = {
  I: "Introduced",
  P: "Practised",
  A: "Assessed",
};

export function confirmedMark(kind: Cell["confirmed_by"]): string {
  if (kind === "person") return "Person";
  if (kind === "judge_only") return "Judge only";
  return "Generator only";
}

export function confirmedWords(kind: Cell["confirmed_by"]): string {
  if (kind === "person") return "Confirmed by a person.";
  if (kind === "judge_only") return "Judge only, not confirmed by a person.";
  return "Generator only, not confirmed by a person.";
}

export function sourceWords(source: Cell["source"]): string {
  return source === "approved"
    ? "From the approved version."
    : "From the working draft.";
}

/** Roles present, in the fixed I, P, A order. */
export function orderedRoles(roles: readonly Role[]): Role[] {
  return ROLE_ORDER.filter((r) => roles.includes(r));
}

/** The full-words text a screen reader gets for one cell. */
export function cellName(cell: Cell): string {
  const roles = orderedRoles(cell.roles)
    .map((r) => ROLE_WORDS[r])
    .join(", ");
  return `${roles}. ${confirmedWords(cell.confirmed_by)} ${sourceWords(cell.source)}`;
}

/** Lessons by number ascending, null last, stable by lesson_id. */
export function sortLessons(
  lessons: readonly CoverageLesson[],
): CoverageLesson[] {
  return [...lessons].sort((a, b) => {
    if (a.number === null && b.number === null)
      return a.lesson_id.localeCompare(b.lesson_id);
    if (a.number === null) return 1;
    if (b.number === null) return -1;
    return a.number - b.number || a.lesson_id.localeCompare(b.lesson_id);
  });
}
