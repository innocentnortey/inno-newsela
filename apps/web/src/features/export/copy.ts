export const COPY = {
  title: "Export (no live integration)",
  onlyApprovers: "Only approvers can export.",
  snapshotsCaption: "Approved snapshots",
  versionsCaption: "Export versions",
  heldBackLabel: "Held back",
  empty: "No approved lessons to export yet.",
  create: "Create export",
  creating: "Creating…",
  createFailed: "Nothing was written. Try again.",
  download: "Download",
  lessonCol: "Lesson",
  hashCol: "Approved hash",
  versionCol: "Version",
  dateCol: "Date",
  lessonsCol: "Lessons",
  earlier: "Earlier export versions",
} as const;

/** "G6.U4.L31" -> "Lesson 31"; an id without a trailing L<n> is shown as it is. */
export function lessonLabel(id: string): string {
  const m = /L(\d+)$/.exec(id);
  return m ? `Lesson ${m[1]}` : id;
}

export const heldBackText = (lessonId: string, waitsOn: string) =>
  `${lessonLabel(lessonId)} waits on ${lessonLabel(waitsOn)}`;

export const lessonCount = (k: number) =>
  `${k} ${k === 1 ? "lesson" : "lessons"}`;

export const writtenMessage = (version: number, count: number) =>
  `Export v${version} written · ${lessonCount(count)}`;

export const sameMessage = (version: number) =>
  `Same lesson payloads as the last export (v${version}).`;

export const downloadFailed = (version: number) =>
  `Couldn't download export v${version}. Try again.`;

export const versionLabel = (n: number) => `Export v${n}`;

export const exportDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { timeZone: "UTC" });
