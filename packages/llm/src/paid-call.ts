import { InvariantViolation, SpendRefused } from "@ls/core/errors";
import type { UserId, JobId, RunId } from "@ls/core/ports/common";
import type { RecordedCall } from "@ls/core/ports/model-call-log";
import type { StructuredCallRequest } from "@ls/core/ports/model-client";
import type { SpendLedger } from "@ls/core/ports/spend";
import { UnpricedModelError } from "./recorder.ts";
import type { CostMath, ModelCallContext, ModelCallRecorder, PriceLookup, RenderedPromptLike } from "./recorder.ts";

export type { CostMath } from "./recorder.ts";

export interface PaidCallRequest {
  ctx: ModelCallContext;
  req: StructuredCallRequest;
  rendered: RenderedPromptLike;
  run_id: RunId | null;
  job_id: JobId | null;
  user_id: UserId;
}

// The one reserve -> call -> settle | release protocol.
export class PaidCaller {
  constructor(
    private readonly recorder: Pick<ModelCallRecorder, "call" | "model_id_for">,
    private readonly spend: SpendLedger,
    private readonly prices: PriceLookup,
    private readonly cost: CostMath,
  ) {}

  async call(p: PaidCallRequest): Promise<RecordedCall> {
    const price = this.prices.price_for(this.recorder.model_id_for(p.req.alias));
    const amount = this.cost.max_call_cost(price, p.rendered.input_tokens_estimate, p.req.max_output_tokens);
    const decision = await this.spend.reserve({ run_id: p.run_id, job_id: p.job_id, user_id: p.user_id, purpose: p.ctx.purpose, amount_usd: amount });
    if (!decision.allowed) {
      throw new SpendRefused({ refused_by: decision.refused_by ?? "run_cap", scope: decision.scope, amount_usd: amount });
    }
    if (decision.reservation_id === null) throw new InvariantViolation("allowed reservation has no id");
    const reservation_id = decision.reservation_id;
    let recorded: RecordedCall;
    try {
      recorded = await this.recorder.call({ ...p.ctx, reservation_id }, p.req, p.rendered);
      await this.spend.settle(reservation_id, recorded.cost_usd, recorded.model_call_id);
    } catch (e) {
      if (e instanceof UnpricedModelError) {
        // Real spend with an unknown price: settle at the reserved worst case rather than release, then surface the error.
        await this.spend.settle(reservation_id, amount, e.model_call_id).catch(() => undefined);
        throw e;
      }
      // The original error wins over a failing release.
      await this.spend.release(reservation_id).catch(() => undefined);
      throw e;
    }
    await this.spend.release(reservation_id); // no-op after settle
    return recorded;
  }
}
