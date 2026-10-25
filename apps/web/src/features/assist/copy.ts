// SCR-13 sentences. The first block is the spec; the second is extra copy that needs UX sign-off (NL-72 plan, step 2).
import type { ApiErrorCode } from "@/lib/api-client";

export const TITLE = "Rewrite selection";
export const WARN = "Don't paste student work.";
export const ASK = "Ask for a suggestion";
export const PENDING_REASON = "Accept or reject the AI suggestion first";
export const ANCHOR_CHANGED_TEXT = "Text changed, ask again.";
export const MODEL_UNAVAILABLE_TEXT = "Couldn't get a suggestion. Nothing changed.";
export const ACCEPTED_TOAST = "Applied as your edit (AI-assisted).";
export const REJECTED_TOAST = "Discarded.";

export const COLLAB_TEXT = "The collaboration service isn't reachable right now. Your suggestion is still waiting. Try again.";
export const NO_SELECTION_TEXT = "Select some text in the lesson first.";
export const TOO_LONG_TEXT = "Select a shorter passage (up to 2000 characters).";
export const LOCKED_TEXT = "AI help isn't available on this lesson right now.";
export const MOVED_ON_TEXT = "This suggestion was already decided. Showing the current state.";
export const NETWORK_TEXT = "Couldn't reach Lesson Studio. Try again.";

/** The sentence for a CON-17 error code; `serverMessage` is used where the server's words are the spec (ROLE_FORBIDDEN). */
export function errorText(code: ApiErrorCode, serverMessage?: string): string | null {
  switch (code) {
    case "ANCHOR_CHANGED": return ANCHOR_CHANGED_TEXT;
    case "MODEL_UNAVAILABLE": return MODEL_UNAVAILABLE_TEXT;
    case "LESSON_LOCKED": return LOCKED_TEXT;
    case "COLLAB_UNAVAILABLE": return COLLAB_TEXT;
    case "INVALID_TRANSITION": return MOVED_ON_TEXT;
    case "NETWORK": return NETWORK_TEXT;
    case "ROLE_FORBIDDEN": return serverMessage || "You can't do that on this lesson.";
    default: return null;
  }
}
