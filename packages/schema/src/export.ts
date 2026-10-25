import { z } from "zod";
import { Sha256, Timestamp, UnitId, VersionId, LessonId } from "./ids.ts";
import { StoredLesson } from "./lesson.ts";

export const ExportedLessonRecord = z
  .object({
    lesson_id: LessonId,
    version_id: VersionId,
    content_hash: Sha256,
    approved_by: z.string(),
    approved_at: Timestamp,
    lesson: StoredLesson,
  })
  .strict();
export type ExportedLessonRecord = z.infer<typeof ExportedLessonRecord>;

export const ExportBundleFile = z
  .object({
    export_version: z.literal(1),
    unit_id: UnitId,
    generated_at: Timestamp,
    lessons: z.array(ExportedLessonRecord),
  })
  .strict();
export type ExportBundleFile = z.infer<typeof ExportBundleFile>;

export const EmittedSchema = z.object({ name: z.string(), path: z.string(), sha256: Sha256 });
export type EmittedSchema = z.infer<typeof EmittedSchema>;
