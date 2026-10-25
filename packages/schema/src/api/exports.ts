// Mirrors OpenAPI components ExportLesson, HeldBack, ExportVersion, ExportList, ExportCreated, LessonExportFile (export cards).
import { z } from "zod";
import { Sha256, Timestamp } from "./common.ts";

export const ExportLesson = z.object({ lesson_id: z.string(), approved_hash: Sha256 });
export type ExportLesson = z.infer<typeof ExportLesson>;

export const HeldBack = z.object({
  lesson_id: z.string(),
  reason: z.string(),
  waits_on: z.string(),
});
export type HeldBack = z.infer<typeof HeldBack>;

export const ExportVersion = z.object({
  export_id: z.string(),
  version_number: z.number().int(),
  created_at: Timestamp,
  created_by: z.string(),
  lesson_count: z.number().int(),
  payload_hash: Sha256,
});
export type ExportVersion = z.infer<typeof ExportVersion>;

export const ExportList = z.object({
  included: z.array(ExportLesson),
  held_back: z.array(HeldBack),
  exports: z.array(ExportVersion),
});
export type ExportList = z.infer<typeof ExportList>;

export const ExportCreated = z.object({
  export_id: z.string(),
  version_number: z.number().int(),
  same_as_previous: z.boolean(),
  included: z.array(ExportLesson),
  held_back: z.array(HeldBack),
  download_path: z.string(),
});
export type ExportCreated = z.infer<typeof ExportCreated>;

export const LessonExportFile = z.object({
  export_id: z.string(),
  version_number: z.number().int(),
  label: z.literal("Export (no live integration)"),
  payload_hash: Sha256,
  lessons: z.array(
    z.object({
      lesson_id: z.string(),
      content_hash: Sha256,
      lesson: z.record(z.string(), z.unknown()),
    }),
  ),
});
export type LessonExportFile = z.infer<typeof LessonExportFile>;
