import { z } from "zod";
import type { SecretStr } from "@ls/config/secret";
import { ProviderError } from "@ls/core/errors";
import type { JudgeClient, JudgeRequest, JudgeVerdictResult } from "@ls/core/ports/judge-client";

// NL-89. The only module that calls OpenRouter. Only four inputs leave the box (rubric, question,
// standard text, activity text). Every error message is a fixed string: never a body, URL, header or key.
export const JUDGE_MAX_OUTPUT_TOKENS = 300;
export const JUDGE_RUBRIC_V1 =
  "You are a strict curriculum reviewer. Answer yes only if the activity, as written, has students do what the standard asks; otherwise answer no. Reply with JSON only: {\"verdict\": \"yes\" | \"no\", \"rationale\": \"one or two sentences\"}.";

const QUESTIONS: Record<JudgeRequest["question"], string> = {
  teaches_standard: "Does this activity, as written, teach the standard?",
  eld_keeps_task: "Does the English-language-development support keep the original task intact?",
};

const ResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string(),
  choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
  usage: z.object({ prompt_tokens: z.number(), completion_tokens: z.number() }),
});
const ContentSchema = z.object({ verdict: z.enum(["yes", "no"]), rationale: z.string().max(2000) }).strict();

export interface OpenRouterJudgeAdapterInit {
  api_key: SecretStr;
  model_id: string;
  timeout_ms: number;
  base_url?: string; // tests only
  fetch_impl?: typeof fetch; // tests only
}

export class OpenRouterJudgeAdapter implements JudgeClient {
  constructor(private readonly init: OpenRouterJudgeAdapterInit) {}

  async verdict(req: JudgeRequest): Promise<JudgeVerdictResult> {
    const body = {
      model: this.init.model_id,
      messages:
        req.rendered_prompt !== undefined
          ? [{ role: "user", content: req.rendered_prompt }]
          : [
              { role: "system", content: JUDGE_RUBRIC_V1 },
              {
                role: "user",
                content: JSON.stringify({
                  rubric: JUDGE_RUBRIC_V1,
                  question: QUESTIONS[req.question],
                  standard_text: req.standard_text,
                  activity_text: req.activity_text,
                }),
              },
            ],
      temperature: 0,
      max_tokens: JUDGE_MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
    };
    const do_fetch = this.init.fetch_impl ?? fetch;
    let res: Response;
    try {
      res = await do_fetch(`${this.init.base_url ?? "https://openrouter.ai/api/v1"}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.init.api_key.reveal()}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.init.timeout_ms),
      });
    } catch (e) {
      const name = (e as { name?: unknown } | null)?.name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new ProviderError({ kind: "timeout", message: "judge request timed out" });
      }
      throw new ProviderError({ kind: "connection", message: "judge request failed to connect" });
    }

    const header_id = res.headers.get("x-request-id");
    const fail = (kind: ConstructorParameters<typeof ProviderError>[0]["kind"], message: string, retry_after_s?: number) =>
      new ProviderError({ kind, message, http_status: res.status, retry_after_s: retry_after_s ?? null, provider_request_id: header_id });

    if (res.status === 429) {
      const ra = Number(res.headers.get("retry-after"));
      throw fail("rate_limited", "judge provider rate limited", Number.isFinite(ra) && res.headers.get("retry-after") !== null ? ra : undefined);
    }
    if (res.status === 401 || res.status === 403) throw fail("auth", "judge provider rejected credentials");
    if (res.status >= 500) throw fail("server_error", "judge provider server error");
    if (res.status < 200 || res.status >= 300) throw fail("bad_request", "judge provider rejected the request");

    const unparsable = () => fail("server_error", "unparsable judge output");
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      throw unparsable();
    }
    const parsed = ResponseSchema.safeParse(json);
    if (!parsed.success) throw unparsable();
    const raw_text = parsed.data.choices[0]!.message.content;
    let content: z.infer<typeof ContentSchema>;
    try {
      const c = ContentSchema.safeParse(JSON.parse(raw_text));
      if (!c.success) throw unparsable();
      content = c.data;
    } catch (e) {
      if (e instanceof ProviderError) throw e;
      throw unparsable();
    }
    return {
      verdict: content.verdict,
      rationale: content.rationale,
      served_model: parsed.data.model,
      usage: {
        input_tokens: parsed.data.usage.prompt_tokens,
        output_tokens: parsed.data.usage.completion_tokens,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
      },
      raw_text,
      provider_request_id: header_id ?? parsed.data.id ?? null,
    };
  }
}
