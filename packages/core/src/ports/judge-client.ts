import type { LessonId, Sha256, TokenUsage } from "./common.ts";

export interface JudgeRequest {
  lesson_id: LessonId;
  content_hash: Sha256;
  address: string;
  code: string;
  standard_text: string;
  activity_text: string;
  question: "teaches_standard" | "eld_keeps_task";
  rubric_version: string;
  /** The exact rendered prompt logged as model_call.rendered_prompt (NL-110 AC-10); adapters send it when present. */
  rendered_prompt?: string;
}

export interface JudgeVerdictResult {
  verdict: "yes" | "no";
  rationale: string;
  served_model: string;
  usage: TokenUsage;
  raw_text: string;
  provider_request_id: string | null;
}

export interface JudgeClient {
  verdict(req: JudgeRequest): Promise<JudgeVerdictResult>;
}
