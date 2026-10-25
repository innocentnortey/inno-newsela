// Fixed strings of SCR-9 (copy is fixed by the flows). Tests import these.
export const DISCLOSURE = "Active review time on this lesson is recorded and shown only as unit totals.";
export const REVIEWER_NOTE = "You're the reviewer for this lesson.";
export const COLLAB_DOWN = "Couldn't reach the editor server. Nothing changed. Try again.";
export const DRAFTING = "Drafting a candidate… The current lesson is unchanged.";
export const UNDO_GONE = "Undo is no longer available. Make the opposite decision instead.";
export const REGEN_LOCKED = "This lesson is locked. Withdraw it first to regenerate.";
export const REGEN_CAP = "Daily spend cap reached. Regenerate is off until tomorrow.";

interface Labelled {
  number?: number | null;
  lesson_key: string;
}
export const lessonLabel = (l: Labelled): string => `Lesson ${l.number ?? l.lesson_key}`;
export const submittedToast = (l: Labelled): string => `${lessonLabel(l)} submitted for approval.`;
export const withdrawnToast = (l: Labelled): string => `${lessonLabel(l)} withdrawn. It's back in review.`;
export const refusedBanner = (message: string): string => `Submit refused: ${message}`;
