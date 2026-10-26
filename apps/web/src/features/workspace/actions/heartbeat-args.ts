// Arguments for useReviewHeartbeat from a loaded lesson. The version id is CON-11's `version_id` (CHG-7);
// a lesson that is not loaded, or has no version yet, sends nothing, and no id is ever made up (S-18).
export function heartbeatArgs(
  lesson: { lesson_id: string; version_id: string | null } | null,
): { lessonId: string; versionId: string; enabled: boolean } {
  const versionId = lesson?.version_id ?? null;
  return { lessonId: lesson?.lesson_id ?? "", versionId: versionId ?? "", enabled: lesson !== null && versionId !== null };
}
