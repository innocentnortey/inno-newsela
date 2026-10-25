import { z } from "zod";

export const AssistRewrite = z.object({ suggested_text: z.string() }).strict();
export type AssistRewrite = z.infer<typeof AssistRewrite>;
