import type { ApiError } from "@/lib/api-client";

export const RESOLVE_TITLE = "Record a resolution";
export const CLEAR_TITLE = "Clear safety flag";
export const REASON_LABEL = "Reason (required)";
export const NOTE_LABEL = "Note (required)";
export const REASON_HELP = "e.g. quote inserted from class copy, rights: short-quote-commentary";
export const NOT_A_FIX = "Counted as a resolution, not a fix.";
export const LOGGED_LINE = "Your name, note and the time are logged and shown on the approver's checklist.";
export const REASON_REQUIRED = "A resolution needs a reason. Say what was done and where.";
export const NOTE_REQUIRED = "Clearing a safety flag needs a note. Say what you checked.";
export const NETWORK = "Couldn't save. Your text is kept. Try again.";
export const CLEAR_FORBIDDEN = "Only reviewers and approvers can clear a flag.";
export const RESOLVE_FORBIDDEN = "Only reviewers can record a resolution.";
export const CANCEL = "Cancel";
export const CLOSE = "Close";
export const RESOLVE_BUTTON = "Record resolution";
export const CLEAR_BUTTON = "Clear flag";
export const clearedToast = "Safety flag cleared.";
export const resolvedToast = (by: string) => `Issue resolved by ${by}.`;

export function errorSentence(mode: "resolve" | "clear_flag", e: ApiError): string {
  switch (e.code) {
    case "REASON_REQUIRED":
      return REASON_REQUIRED;
    case "NOTE_REQUIRED":
      return NOTE_REQUIRED;
    case "NOT_RESOLVABLE": {
      const use = typeof e.details.use === "string" ? e.details.use : null;
      return use ? `This issue can't be resolved with a reason. Use "${use}" instead.` : e.message;
    }
    case "LESSON_LOCKED": {
      const state = typeof e.details.state === "string" ? e.details.state : null;
      return `This lesson is ${state ?? "locked"}, so nothing was saved. Withdraw or reopen it first.`;
    }
    case "ROLE_FORBIDDEN":
      return mode === "resolve" ? RESOLVE_FORBIDDEN : CLEAR_FORBIDDEN;
    case "NETWORK":
      return NETWORK;
    default:
      return e.message;
  }
}
