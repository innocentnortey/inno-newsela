import { z } from "zod";
import { LessonId } from "./ids.ts";

export const DRAFT_ROLES = [
  "routine_heading", "teacher_talk", "sample_response", "callout_purpose", "callout_say",
  "callout_watch", "support_table", "cfu_item", "quick_write", "text_evidence_needed",
  "excerpt_slot", "teacher_tip", "homework", "paragraph", "list",
] as const;
export const DraftRole = z.enum(DRAFT_ROLES);
export type DraftRole = z.infer<typeof DraftRole>;

export const CfuItemDraft = z
  .object({
    stem: z.string(),
    options: z.array(z.string()).min(2),
    key_index: z.int().min(0),
    rationales: z.array(z.string()),
    standard_code: z.string(),
  })
  .superRefine((c, ctx) => {
    if (c.key_index >= c.options.length) {
      ctx.addIssue({ code: "custom", path: ["key_index"], message: "key_index out of range" });
    }
    if (c.rationales.length !== c.options.length) {
      ctx.addIssue({ code: "custom", path: ["rationales"], message: "rationales must match options" });
    }
  });
export type CfuItemDraft = z.infer<typeof CfuItemDraft>;

export const DraftBlock = z
  .object({
    role: DraftRole,
    section: z.string(),
    part: z.string().nullable(),
    text: z.string(),
    standard_codes: z.array(z.string()),
    code_origins: z.array(z.enum(["outline", "narrowed", "added"])),
    cfu: CfuItemDraft.nullable(),
    minutes: z.int().nullable(),
  })
  .superRefine((b, ctx) => {
    if (b.role === "cfu_item" && b.cfu === null) {
      ctx.addIssue({ code: "custom", path: ["cfu"], message: "cfu_item requires cfu" });
    }
    if (b.role !== "cfu_item" && b.cfu !== null) {
      ctx.addIssue({ code: "custom", path: ["cfu"], message: "cfu only on cfu_item" });
    }
    if (b.code_origins.length !== b.standard_codes.length) {
      ctx.addIssue({ code: "custom", path: ["code_origins"], message: "code_origins must match standard_codes" });
    }
  });
export type DraftBlock = z.infer<typeof DraftBlock>;

export const TextCardRecord = z.object({
  title: z.string(),
  author: z.string().nullable(),
  edition: z.string().nullable(),
  chapter: z.string().nullable(),
  pages: z.string().nullable(),
  kind: z.enum(["off-platform-text", "newsela-article", "public-domain"]),
  content_available: z.boolean(),
});
export type TextCardRecord = z.infer<typeof TextCardRecord>;

export const LessonDraft = z.object({
  lesson_id: LessonId,
  title: z.string(),
  blocks: z.array(DraftBlock),
  text_cards: z.array(TextCardRecord),
});
export type LessonDraft = z.infer<typeof LessonDraft>;

/** Issue paths only: never messages or offending values (they may carry model output). */
export function zod_issue_paths(error: z.ZodError): string[] {
  const out: string[] = [];
  for (const issue of error.issues) {
    let s = "";
    for (const seg of issue.path) {
      if (typeof seg === "number") s += `[${seg}]`;
      else s += s === "" ? String(seg) : `.${String(seg)}`;
    }
    const p = s === "" ? "$" : s;
    if (!out.includes(p)) out.push(p);
  }
  return out;
}
