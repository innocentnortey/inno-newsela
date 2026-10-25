import Decimal from "decimal.js";
import { InvariantViolation, ProviderError } from "@ls/core/errors";
import type { Clock } from "@ls/core/ports/clock";
import type { LessonId, ModelPrice, Sha256, TokenUsage, Usd } from "@ls/core/ports/common";
import type { JudgeClient } from "@ls/core/ports/judge-client";
import type { JudgeRepo } from "@ls/core/ports/judge";
import type { ModelCallLog } from "@ls/core/ports/model-call-log";
import type { SpendLedger } from "@ls/core/ports/spend";
import type { PromptRenderer } from "@ls/prompts/render";
import type { JudgePairSource } from "./pair-source.ts";

// Structural copies of @ls/llm/recorder's PriceLookup and CostMath (NL-33 forbids importing the recorder here).
export interface JudgePriceLookup {
  price_for(model_id: string): ModelPrice;
}
export interface JudgeCostMath {
  settle_cost(price: ModelPrice, usage: TokenUsage): Usd;
  max_call_cost(price: ModelPrice, input_tokens_estimate: number, output_cap: number): Usd;
}

// NL-89. Advisory only: writes verdict rows and model_call rows, never an issue, never touches Approve.
export interface JudgeRunReport {
  lesson_id: LessonId;
  pairs: number;
  verdicts_no: number;
  skipped: number;
  failed: number;
  cost_usd: Usd;
}
export interface JudgeJobConfig {
  expected_locked_hash: string;
  rubric_version: string;
  judge_model_id: string;
  max_output_tokens: number;
}

export class JudgeJob {
  constructor(
    private readonly judge: JudgeClient,
    private readonly calls: ModelCallLog,
    private readonly verdicts: JudgeRepo,
    private readonly renderer: Pick<PromptRenderer, "render_judge">,
    private readonly spend: SpendLedger,
    private readonly prices: JudgePriceLookup,
    private readonly cost: JudgeCostMath,
    private readonly source: JudgePairSource,
    private readonly config: JudgeJobConfig,
    private readonly clock: Clock,
  ) {}

  async run(lesson_id: LessonId, content_hash: Sha256): Promise<JudgeRunReport> {
    const ctx = await this.source.load(lesson_id, content_hash);
    let verdicts_no = 0;
    let skipped = 0;
    let failed = 0;
    let total: Usd = new Decimal(0);

    for (const [index, pair] of ctx.pairs.entries()) {
      const rendered = this.renderer.render_judge({
        standard_text: pair.standard_text,
        activity_text: pair.activity_text,
        question: pair.question,
        rubric_version: this.config.rubric_version,
        expected_locked_hash: this.config.expected_locked_hash,
      });
      const amount = this.cost.max_call_cost(
        this.prices.price_for(this.config.judge_model_id),
        rendered.input_tokens_estimate,
        this.config.max_output_tokens,
      );
      const decision = await this.spend.reserve({
        run_id: ctx.run_id,
        job_id: null,
        user_id: ctx.user_id,
        purpose: "judge",
        amount_usd: amount,
      });
      if (!decision.allowed) {
        skipped++;
        continue;
      }
      const reservation_id = decision.reservation_id;
      if (reservation_id === null) throw new InvariantViolation("allowed reservation without an id");

      const id = await this.calls.insert_sent({
        run_id: ctx.run_id,
        lesson_id,
        job_id: null,
        attempt: index + 1,
        purpose: "judge",
        alias: "JUDGE",
        requested_model: this.config.judge_model_id,
        rendered_prompt: rendered.text,
        request_id: null,
        experiment_id: null,
        reservation_id,
      });

      const started = performance.now();
      let res;
      try {
        res = await this.judge.verdict({
          lesson_id,
          content_hash,
          address: pair.address,
          code: pair.code,
          standard_text: pair.standard_text,
          activity_text: pair.activity_text,
          question: pair.question,
          rubric_version: this.config.rubric_version,
          rendered_prompt: rendered.text,
        });
      } catch (e) {
        if (e instanceof ProviderError) {
          await this.calls.fail(id, { kind: e.kind, http_status: e.http_status, message: e.kind, retry_after_s: e.retry_after_s });
          await this.spend.release(reservation_id);
          failed++;
          continue;
        }
        await this.calls.fail(id, { kind: "server_error", http_status: null, message: "unexpected judge client error", retry_after_s: null });
        await this.spend.release(reservation_id);
        throw e;
      }

      let cost_usd: Usd;
      try {
        cost_usd = this.cost.settle_cost(this.prices.price_for(res.served_model), res.usage);
      } catch {
        cost_usd = amount; // unpriced served model: settle at the reserved worst case, as PaidCaller does
      }
      try {
        await this.calls.complete(id, {
          raw_output: res.raw_text,
          stop_reason: "end_turn",
          usage: res.usage,
          cost_usd,
          served_model: res.served_model,
          provider_request_id: res.provider_request_id,
          latency_ms: Math.round(performance.now() - started),
        });
        await this.spend.settle(reservation_id, cost_usd, id);

        await this.verdicts.insert_verdict({
          lesson_id,
          content_hash,
          address: pair.address,
          code: pair.code,
          question: pair.question,
          verdict: res.verdict,
          model_call_id: id,
          served_model: res.served_model,
        });
      } finally {
        await this.spend.release(reservation_id);
      }
      if (res.verdict === "no") verdicts_no++;
      total = total.add(cost_usd);
    }
    return { lesson_id, pairs: ctx.pairs.length, verdicts_no, skipped, failed, cost_usd: total };
  }
}
