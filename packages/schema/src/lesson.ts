import { z } from "zod";
import { TextCardRecord } from "./lesson-draft.ts";
import { LessonId } from "./ids.ts";

export type PMMark = { type: string; attrs?: Record<string, unknown> | undefined };
export type PMNode = {
  type: string;
  attrs?: Record<string, unknown> | undefined;
  content?: PMNode[] | undefined;
  marks?: PMMark[] | undefined;
  text?: string | undefined;
};

export const ProseMirrorNode: z.ZodType<PMNode> = z.lazy(() =>
  z.object({
    type: z.string(),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(ProseMirrorNode).optional(),
    marks: z
      .array(z.object({ type: z.string(), attrs: z.record(z.string(), z.unknown()).optional() }))
      .optional(),
    text: z.string().optional(),
  }),
);

export const ProseMirrorDoc = z.object({
  type: z.literal("doc"),
  attrs: z.record(z.string(), z.unknown()).optional(),
  content: z.array(ProseMirrorNode).optional(),
});
export type ProseMirrorDoc = z.infer<typeof ProseMirrorDoc>;

export const Standard = z.object({
  code: z.string(),
  role: z.enum(["focus", "supporting", "eld"]),
  origin: z.enum(["outline", "outline-fixed", "narrowed", "added"]),
  official_text: z.string(),
  asserted_by: z.enum(["outline", "generator", "judge", "reviewer"]),
  confirmation: z.enum(["open", "confirmed", "removed"]).nullable(),
});
export type Standard = z.infer<typeof Standard>;

export const Section = z.object({
  address: z.string(),
  name: z.string(),
  minutes: z.int(),
  content: ProseMirrorDoc,
});
export type Section = z.infer<typeof Section>;

export const FrontMatterRecord = z.object({
  standards: z.array(Standard),
  minutes_total: z.int(),
  vocabulary: z.array(z.string()),
});
export type FrontMatterRecord = z.infer<typeof FrontMatterRecord>;

export const StoredLesson = z.object({
  lesson_id: LessonId,
  schema_version: z.int().min(1),
  title: z.string(),
  type: z.string(),
  front_matter: FrontMatterRecord,
  sections: z.array(Section),
  text_cards: z.array(TextCardRecord),
});
export type StoredLesson = z.infer<typeof StoredLesson>;
