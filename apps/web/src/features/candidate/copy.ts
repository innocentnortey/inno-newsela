// Fixed strings of SCR-12 (copy is fixed by the flows). Tests import these.
export { DRAFTING } from "@/features/workspace/actions/copy";

export const HP5_NOTE = "Copying text by hand from the candidate is not tracked as an adoption.";
export const ONLY_REVIEWERS = "Only reviewers adopt candidates";
export const ADOPT_SECTION = "Adopt this section";
export const ADOPT_WHOLE = "Adopt whole candidate";
export const LEAVE = "Leave unadopted";
export const BACK = (label: string): string => `Back to ${label}`;
// CON-16 has no `note` on Candidate, so the spec's "note: <note>" cannot be filled (CHG note in the devlog).
export const META = "From the run's stored plan and pinned prompt";
export const DAY_CAP = "Daily spend cap reached. No candidate was made.";
export const COLLAB = "Nothing changed. Try again.";
export const NETWORK = "Couldn't reach Lesson Studio. Try again.";
export const ADOPT_FALLBACK = "Couldn't adopt. Try again.";
export const NOT_IN_VERSION = "Not in this version.";
export const CURRENT_CAPTION = "Current lesson";
export const locked = (label: string): string => `${label} is submitted. Withdraw it first to regenerate.`;
export const frozenNote = (label: string, state: string): string => `${label} is ${state}. Candidates are read-only.`;
export const adoptedToast = (section: string, version: number): string =>
  `${section} adopted from candidate v${version}. Logged as your edit.`;
export const wholeToast = (version: number): string => `Candidate v${version} adopted. Logged as your edit.`;
export const failedSentence = (reasons: { message: string }[]): string =>
  `Candidate failed: ${reasons.map((r) => r.message.replace(/\.$/, "")).join("; ")}. The current lesson is unchanged.`;
