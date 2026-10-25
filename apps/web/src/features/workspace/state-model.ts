import type { StatusKey } from "@/components/ui/status";
import type { components } from "@/lib/api-types";
import type { Role } from "@/lib/roles";

type Lesson = components["schemas"]["Lesson"];
type Section = components["schemas"]["Section"];
type SendBackTag = components["schemas"]["SendBackTag"];

export function lessonLabel(lessonKey: string): string {
  const m = /^([LF])(\d+)$/.exec(lessonKey);
  if (!m) return lessonKey;
  return m[1] === "L" ? `Lesson ${m[2]}` : `Flex day ${m[2]}`;
}

export function placeLabel(unitKey: string): string {
  const m = /^g(\d+)-u(\d+)$/.exec(unitKey);
  return m ? `Grade ${m[1]} · Unit ${m[2]}` : unitKey;
}

export function stepFor(state: Lesson["state"]): 1 | 2 | 3 | 4 | 5 {
  switch (state) {
    case "generation_failed":
    case "draft":
      return 1;
    case "in_review":
    case "changes_requested":
    case "reopened":
      return 2;
    case "submitted":
      return 3;
    case "approved":
      return 4;
    case "exported":
      return 5;
  }
}

export function offPathStatus(state: Lesson["state"]): StatusKey | null {
  if (state === "generation_failed") return "lesson.generation_failed";
  if (state === "changes_requested") return "lesson.changes_requested";
  return null;
}

const EDITABLE: readonly Lesson["state"][] = ["draft", "in_review", "changes_requested", "reopened"];

export function isReadOnly(role: Role, state: Lesson["state"]): boolean {
  return !(role === "reviewer" && EDITABLE.includes(state));
}

export function shortHash(h: string): string {
  return `${h.slice(0, 4)}…${h.slice(-4)}`;
}

export const SEND_BACK_TAG_LABEL: Record<SendBackTag, string> = {
  standards: "Standards",
  quotes_and_rights: "Quotes and rights",
  eld_support: "ELD support",
  content_safety: "Content safety",
  ai_spans: "AI spans",
  teaching_quality: "Teaching quality",
  other: "Other",
};

export interface SectionGroup {
  key: string;
  name: string;
  minutes: number;
  parts: Section[];
}

const PART = /\.Part[A-Z]$/;

export function groupSections(sections: Section[]): SectionGroup[] {
  const groups: SectionGroup[] = [];
  for (const s of sections) {
    const isPart = PART.test(s.address);
    const key = isPart ? s.address.replace(PART, "") : s.address;
    const existing = isPart ? groups.find((g) => g.key === key) : undefined;
    if (existing) {
      existing.parts.push(s);
      existing.minutes += s.minutes;
    } else {
      groups.push({
        key,
        name: isPart ? s.name.replace(/\s*Part [A-Z]$/, "") : s.name,
        minutes: s.minutes,
        parts: [s],
      });
    }
  }
  return groups;
}

export function totalMinutes(sections: Section[]): number {
  return sections.reduce((sum, s) => sum + s.minutes, 0);
}
