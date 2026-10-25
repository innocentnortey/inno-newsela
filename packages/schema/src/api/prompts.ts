// Mirrors OpenAPI components GuidanceVersion, PromptVersions, SaveGuidanceRequest (prompt guidance cards).
import { z } from "zod";
import { Timestamp } from "./common.ts";

export const GuidanceVersion = z.object({
  version_id: z.string(),
  number: z.number().int(),
  author: z.string(),
  created_at: Timestamp,
  reason: z.string(),
  diff: z.string(),
  pinned_by_runs: z.array(z.string()),
});
export type GuidanceVersion = z.infer<typeof GuidanceVersion>;

export const PromptVersions = z.object({
  current_prompt_version_id: z.string(),
  locked_layer: z.object({ version_id: z.string(), text: z.string() }),
  guidance_versions: z.array(GuidanceVersion),
});
export type PromptVersions = z.infer<typeof PromptVersions>;

export const SaveGuidanceRequest = z
  .object({
    base_version_id: z.string(),
    guidance_text: z.string().max(8000),
    reason: z.string(),
  })
  .strict();
export type SaveGuidanceRequest = z.infer<typeof SaveGuidanceRequest>;
