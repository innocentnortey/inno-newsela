import type { LessonId, ModelCallId, Sha256 } from "./common.ts";

export interface NewJudgeVerdict {
  lesson_id: LessonId;
  content_hash: Sha256;
  address: string;
  code: string;
  question: "teaches_standard" | "eld_keeps_task";
  verdict: "yes" | "no";
  model_call_id: ModelCallId;
  served_model: string;
}

export interface JudgeVerdictRow {
  verdict_id: string;
  lesson_id: LessonId;
  code: string;
  verdict: "yes" | "no";
  served_model: string;
  created_at: Date;
}

export interface JudgeRepo {
  insert_verdict(v: NewJudgeVerdict): Promise<JudgeVerdictRow>;
}
