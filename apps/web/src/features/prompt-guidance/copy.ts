export const COPY = {
  title: "Prompt guidance",
  railTitle: "Guidance versions",
  onlyAuthors: "Only authors edit guidance.",
  firstVersion: "First version.",
  lockedTitle: "Locked rules (read-only)",
  guidanceLabel: "Guidance text",
  guidancePlaceholder: "Write guidance for the generator",
  reasonLabel: "Reason",
  reasonRequired: "A version needs a reason.",
  save: "Save as new version",
  saving: "Saving…",
  staleBanner:
    "Someone saved a newer version first. Review it below, then save again.",
  saveFailed: "Nothing was saved. Try again.",
  trialTitle: "Try on one lesson",
  lessonLabel: "Lesson",
  lessonPlaceholder: "Choose a lesson",
  trialButton: "Try on one lesson",
  trialRunning: "Starting…",
  lessonsFailed: "Couldn't load lessons.",
  retry: "Retry",
  noOutline: "No outline uploaded yet.",
  selectLatest: "Select the latest version to try it.",
  compare: "Compare the candidate",
  trialFailed: "No candidate was made. Try again.",
  trialSlow: "The candidate is still being made. Check the lesson's history.",
  openHistory: "Open the lesson's history",
} as const;

export const changesHeading = (n: number) => `Changes from v${n - 1}`;
export const versionHeading = (n: number) => `Guidance v${n}`;
export const savedMessage = (n: number, base: number) =>
  `Guidance v${n} saved. Runs already going keep v${base}.`;
export const trialMessage = (lessonNumber: number) =>
  `Candidate made on Lesson ${lessonNumber}, not adopted.`;
export const makingMessage = (lessonNumber: number) =>
  `Making a candidate on Lesson ${lessonNumber}…`;
export const capMessage = (remaining: number | null) =>
  typeof remaining === "number"
    ? `The day's spend cap would be passed. Remaining: $${remaining}.`
    : COPY.trialFailed;
export const charsLeft = (k: number) => `${k} characters left`;
