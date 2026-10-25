import { ConfigError } from "@ls/config/errors";
import type { WorkerSettings } from "@ls/config/settings";
import type { JudgeClient } from "@ls/core/ports/judge-client";
import { OpenRouterJudgeAdapter } from "@ls/llm/openrouter-judge";
import { StubJudgeClient } from "@ls/llm/stub";

// NL-89. Stub mode never touches the key; the adapter exists only in real mode with key and model.
export function build_judge_client(
  s: Pick<WorkerSettings, "model" | "openrouter_api_key" | "model_judge_id">,
  opts: { stub_verdicts?: ConstructorParameters<typeof StubJudgeClient>[0]; timeout_ms?: number } = {},
): JudgeClient {
  if (s.model.model_provider_mode === "stub") return new StubJudgeClient(opts.stub_verdicts ?? []);
  if (s.openrouter_api_key === null) throw new ConfigError("OPENROUTER_API_KEY", "required when MODEL_PROVIDER_MODE=real");
  if (s.model_judge_id === null) throw new ConfigError("MODEL_JUDGE_ID", "required when MODEL_PROVIDER_MODE=real");
  return new OpenRouterJudgeAdapter({ api_key: s.openrouter_api_key, model_id: s.model_judge_id, timeout_ms: opts.timeout_ms ?? 30000 });
}
