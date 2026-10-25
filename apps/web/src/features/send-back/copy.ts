import type { components } from "@/lib/api-types";
import { lessonKeyFromId } from "@/lib/keys";

type Lesson = components["schemas"]["Lesson"];
export type SendBackTag =
  | "standards"
  | "quotes_and_rights"
  | "eld_support"
  | "content_safety"
  | "ai_spans"
  | "teaching_quality"
  | "other";

export const TAGS: ReadonlyArray<{ value: SendBackTag; label: string }> = [
  { value: "standards", label: "Standards" },
  { value: "quotes_and_rights", label: "Quotes and rights" },
  { value: "eld_support", label: "ELD support" },
  { value: "content_safety", label: "Content safety" },
  { value: "ai_spans", label: "AI spans" },
  { value: "teaching_quality", label: "Teaching quality" },
  { value: "other", label: "Other" },
];

export function lessonLabel(lessonId: string): string {
  const key = lessonKeyFromId(lessonId);
  if (!key) return "this lesson";
  if (key.startsWith("L")) return `Lesson ${key.slice(1)}`;
  if (key.startsWith("F")) return `Flex day ${key.slice(1)}`;
  return "this lesson";
}

export function dependantsSentence(dependantIds: string[], thisId: string): string {
  const names = dependantIds.map(lessonLabel);
  const until = `until ${lessonLabel(thisId)} is approved again.`;
  if (names.length === 1) return `${names[0]} links to this lesson. It will be flagged and held back from export ${until}`;
  const joined = `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${joined} link to this lesson. They will be flagged and held back from export ${until}`;
}

export const NOTE_REQUIRED_TEXT = "Add a note: say what needs to change.";
export const REASON_REQUIRED_TEXT = "Add a reason: say why this lesson is being reopened.";
export const TAG_REQUIRED_TEXT = "Choose a reason.";
export const STALE_TEXT = "This lesson changed since you opened it. Reload.";
export const MOVED_ON_TEXT = "This lesson has already moved on. Showing its current state.";
export const COLLAB_TEXT = "The collaboration service isn't reachable right now. Try again.";
export const DEPENDANTS_UNKNOWN_TEXT = "Couldn't check which lessons depend on this one. Reopening will flag them.";

export function whoSeesIt(lesson: Pick<Lesson, "reviewer" | "last_editor"> | null): string {
  return lesson?.reviewer ?? lesson?.last_editor ?? "the reviewer";
}
export const sentBackToast = (who: string): string => `Sent back to ${who}.`;
export const reopenedToast = (thisId: string, versionNumber: number): string =>
  `${lessonLabel(thisId)} reopened as version ${versionNumber}.`;
export const seesLine = (who: string): string => `${who} will see your tag and note on the board and in the lesson.`;
export function dialogTitle(mode: "request_changes" | "reopen", lessonId: string): string {
  const label = lessonLabel(lessonId);
  return mode === "reopen" ? `Reopen ${label}` : `Request changes to ${label}`;
}

// The one place request bodies are built (contract CON-18 RequestChanges / Reopen: no pin fields; see plan Risks 1).
export function buildRequestChanges(tag: SendBackTag, note: string) {
  return { action: "request_changes" as const, tag, note: note.trim() };
}
export function buildReopen(reason: string) {
  return { action: "reopen" as const, reason: reason.trim() };
}
