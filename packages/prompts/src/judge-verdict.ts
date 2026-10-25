import { z } from "zod";

export const JudgeVerdict = z.object({ verdict: z.enum(["yes", "no"]) }).strict();
export type JudgeVerdict = z.infer<typeof JudgeVerdict>;
