import { isApiError } from "@/lib/api-client";

export type FillFailure = { target: "text" | "source" | "banner"; message: string };

export const TEXT_REQUIRED_MSG = "Add the quote text.";
export const SOURCE_REQUIRED_MSG = "A quote needs a source: add the book and page, or the URL.";
const RETRY = "Couldn't insert. Your text is kept. Try again.";

export function mapFillError(e: unknown, wordCount: number): FillFailure {
  if (!isApiError(e) || e.code === "NETWORK" || e.code === "COLLAB_UNAVAILABLE") return { target: "banner", message: RETRY };
  switch (e.code) {
    case "SOURCE_REQUIRED":
      return { target: "source", message: SOURCE_REQUIRED_MSG };
    case "INVALID_REQUEST": {
      const f = e.details.fields;
      const fields = Array.isArray(f) ? f.filter((x): x is string => typeof x === "string") : [];
      if (fields.some((x) => x.endsWith("text"))) return { target: "text", message: TEXT_REQUIRED_MSG };
      if (fields.some((x) => x.includes("source_ref"))) return { target: "source", message: SOURCE_REQUIRED_MSG };
      return { target: "banner", message: RETRY };
    }
    case "QUOTE_TOO_LONG": {
      const d = e.details.word_count;
      const n = typeof d === "number" && Number.isFinite(d) ? d : wordCount;
      return { target: "text", message: `${n} of 12 words: a short-quote-commentary quote is 12 words or fewer. Shorten it or choose another rights status.` };
    }
    case "ROLE_FORBIDDEN":
      return { target: "banner", message: "Only reviewers insert quotes." };
    case "LESSON_LOCKED":
      return { target: "banner", message: "This lesson is locked. Withdraw it first to insert a quote." };
    case "NOT_FOUND":
      return { target: "banner", message: "This slot is no longer in the lesson. Close this and reload." };
    default:
      return { target: "banner", message: e.message };
  }
}
