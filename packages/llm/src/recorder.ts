import type { ModelSettings } from "@ls/config/settings";
import { InvariantViolation, ProviderError } from "@ls/core/errors";
import type { Clock } from "@ls/core/ports/clock";
import type {
  CallPurpose, JobId, LessonId, ModelAlias, ModelCallId, ModelPrice, ReservationId, RequestId, RunId, TokenUsage, Usd,
} from "@ls/core/ports/common";
import type { ModelCallLog, RecordedCall } from "@ls/core/ports/model-call-log";
import type { ModelClient, StructuredCallRequest } from "@ls/core/ports/model-client";
import type { Logger } from "@ls/obs/logger";
import Decimal from "decimal.js";

// Structural types (DO-4): the real cost math, price table and rendered prompt satisfy these.
export interface CostMath {
  settle_cost(price: ModelPrice, usage: TokenUsage): Usd;
  max_call_cost(price: ModelPrice, input_tokens_estimate: number, output_cap: number): Usd;
}
export interface PriceLookup {
  price_for(model_id: string): ModelPrice;
}
export interface RenderedPromptLike {
  text: string;
  input_tokens_estimate: number;
}
export interface ModelCallContext {
  run_id: RunId | null;
  lesson_id: LessonId | null;
  job_id: JobId | null;
  attempt: number;
  purpose: CallPurpose;
  request_id: RequestId | null;
  experiment_id: string | null;
  reservation_id: ReservationId | null;
}
export interface RecorderExtras {
  logger?: Logger;
  random?: () => number;
}
// Not on the NL-12 port: the row's retries counter. A log without it simply does not persist retries.
type RetryAwareLog = ModelCallLog & { record_retry?(id: ModelCallId): Promise<void> };

const RETRY_AFTER_CAP_S = 120;

// Thrown after the raw output is saved when the served model has no price: the provider was paid but the cost is unknown.
/** A reason safe to store and log: a class name, or a `safe_reason` an error carries; never `e.message`. */
export function safe_reason(e: unknown): string {
  if (typeof e === "object" && e !== null && typeof (e as { safe_reason?: unknown }).safe_reason === "string") {
    return (e as { safe_reason: string }).safe_reason;
  }
  return e instanceof Error ? e.name : "unknown";
}

export class UnpricedModelError extends InvariantViolation {
  constructor(readonly model_call_id: ModelCallId) {
    super("no price for served model", { model_call_id });
  }
}

export class ModelCallRecorder {
  private readonly random: () => number;
  private readonly logger: Logger | undefined;

  constructor(
    private readonly client: ModelClient,
    private readonly log: RetryAwareLog,
    private readonly clock: Clock,
    private readonly prices: PriceLookup,
    private readonly settings: ModelSettings,
    private readonly cost: CostMath,
    extras: RecorderExtras = {},
  ) {
    this.random = extras.random ?? Math.random;
    this.logger = extras.logger;
  }

  model_id_for(alias: ModelAlias): string {
    switch (alias) {
      case "GENERATION": return this.settings.model_generation_id;
      case "REPAIR": return this.settings.model_repair_id;
      case "ASSIST": return this.settings.model_assist_id;
      default: throw new InvariantViolation("judge alias has no recorder model");
    }
  }

  checkpoint(job_id: JobId, purpose: CallPurpose, attempt: number): Promise<RecordedCall | null> {
    return this.log.completed_for(job_id, purpose, attempt);
  }

  async call(ctx: ModelCallContext, req: StructuredCallRequest, rendered: RenderedPromptLike): Promise<RecordedCall> {
    if (!(req.timeout_ms > 0)) throw new InvariantViolation("timeout_ms must be positive");
    const requested_model = this.model_id_for(req.alias);
    // No send without a committed row.
    const id = await this.log.insert_sent({
      run_id: ctx.run_id, lesson_id: ctx.lesson_id, job_id: ctx.job_id, attempt: ctx.attempt, purpose: ctx.purpose,
      alias: req.alias, requested_model, rendered_prompt: rendered.text, request_id: ctx.request_id,
      experiment_id: ctx.experiment_id, reservation_id: ctx.reservation_id,
    });

    let retries = 0;
    for (;;) {
      let resp;
      try {
        resp = await this.client.complete(req);
      } catch (e) {
        if (!(e instanceof ProviderError)) {
          await this.safe_fail(id, { kind: "server_error", http_status: null, message: "unexpected client error: " + safe_reason(e), retry_after_s: null });
          this.emit_failed(ctx, req, id, retries, "unexpected", null, safe_reason(e));
          throw e;
        }
        if (e.retryable && retries < this.settings.provider_max_retries) {
          const delay_ms = e.retry_after_s !== null
            ? Math.min(e.retry_after_s, RETRY_AFTER_CAP_S) * 1000
            : 1000 * 2 ** retries * (1 + (this.random() * 0.4 - 0.2));
          retries += 1;
          if (this.log.record_retry !== undefined) await this.log.record_retry(id);
          await this.clock.sleep(delay_ms);
          continue;
        }
        // The message is the kind name only: no provider text is stored.
        await this.safe_fail(id, { kind: e.kind, http_status: e.http_status, message: e.kind, retry_after_s: e.retry_after_s });
        this.emit_failed(ctx, req, id, retries, e.kind, e.http_status);
        throw e;
      }

      // Raw output is persisted before anything can parse or reject it.
      let cost_usd: Usd | null;
      try {
        cost_usd = this.cost.settle_cost(this.prices.price_for(resp.served_model), resp.usage);
      } catch {
        cost_usd = null;
      }
      await this.log.complete(id, {
        raw_output: resp.raw_text, stop_reason: resp.stop_reason, usage: resp.usage, cost_usd: cost_usd ?? new Decimal(0),
        served_model: resp.served_model, provider_request_id: resp.provider_request_id, latency_ms: resp.latency_ms,
      });
      if (cost_usd === null) {
        this.logger?.error("model_call.unpriced", { request_id: ctx.request_id, run_id: ctx.run_id, lesson_id: ctx.lesson_id, job_id: ctx.job_id, extra: { model_call_id: id } });
        throw new UnpricedModelError(id);
      }
      this.logger?.info("model_call", {
        request_id: ctx.request_id, run_id: ctx.run_id, lesson_id: ctx.lesson_id, job_id: ctx.job_id, duration_ms: resp.latency_ms,
        extra: {
          model_call_id: id, purpose: ctx.purpose, alias: req.alias, served_model: resp.served_model,
          input_tokens: resp.usage.input_tokens, output_tokens: resp.usage.output_tokens,
          cache_read_tokens: resp.usage.cache_read_tokens, cache_write_tokens: resp.usage.cache_write_tokens,
          cost_usd: cost_usd.toFixed(6), latency_ms: resp.latency_ms, retries, status: "completed",
        },
      });
      return {
        model_call_id: id, purpose: ctx.purpose, attempt: ctx.attempt, raw_output: resp.raw_text, stop_reason: resp.stop_reason,
        usage: resp.usage, cost_usd, served_model: resp.served_model, retries,
      };
    }
  }

  private async safe_fail(id: ModelCallId, e: Parameters<ModelCallLog["fail"]>[1]): Promise<void> {
    try {
      await this.log.fail(id, e);
    } catch {
      this.logger?.error("model_call.fail_write_failed", { extra: { model_call_id: id } });
    }
  }

  private emit_failed(ctx: ModelCallContext, req: StructuredCallRequest, id: ModelCallId, retries: number, error_kind: string, http_status: number | null, reason?: string): void {
    this.logger?.info("model_call", {
      request_id: ctx.request_id, run_id: ctx.run_id, lesson_id: ctx.lesson_id, job_id: ctx.job_id,
      extra: { model_call_id: id, purpose: ctx.purpose, alias: req.alias, retries, status: "failed", error_kind, http_status, ...(reason === undefined ? {} : { reason }) },
    });
  }
}
