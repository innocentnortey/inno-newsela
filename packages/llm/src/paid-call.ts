import type Decimal from "decimal.js";
import { InvariantViolation, SpendRefused } from "@ls/core/errors";
import type { UserId, JobId, RunId, ReservationId } from "@ls/core/ports/common";
import type { RecordedCall } from "@ls/core/ports/model-call-log";
import type { StructuredCallRequest } from "@ls/core/ports/model-client";
import type { SpendLedger } from "@ls/core/ports/spend";
import type { Logger } from "@ls/obs/logger";
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
  /** Aborted when the job lease is lost: the reservation is released and the call rejects with the abort reason. */
  signal?: AbortSignal;
}

function abort_reason(s: AbortSignal): Error {
  return s.reason instanceof Error ? s.reason : new Error("aborted");
}

const SETTLE_ATTEMPTS = 3;

// The one reserve -> call -> settle | release protocol.
export class PaidCaller {
  constructor(
    private readonly recorder: Pick<ModelCallRecorder, "call" | "model_id_for">,
    private readonly spend: SpendLedger,
    private readonly prices: PriceLookup,
    private readonly cost: CostMath,
    private readonly logger?: Logger,
  ) {}

  async call(p: PaidCallRequest): Promise<RecordedCall> {
    if (p.signal?.aborted) throw abort_reason(p.signal);
    const price = this.prices.price_for(this.recorder.model_id_for(p.req.alias));
    const amount = this.cost.max_call_cost(price, p.rendered.input_tokens_estimate, p.req.max_output_tokens);
    const decision = await this.spend.reserve({ run_id: p.run_id, job_id: p.job_id, user_id: p.user_id, purpose: p.ctx.purpose, amount_usd: amount });
    if (!decision.allowed) {
      throw new SpendRefused({ refused_by: decision.refused_by ?? "run_cap", scope: decision.scope, amount_usd: amount });
    }
    if (decision.reservation_id === null) throw new InvariantViolation("allowed reservation has no id");
    const reservation_id = decision.reservation_id;
    let recorded: RecordedCall;
    let pending: Promise<RecordedCall> | undefined;
    const signal = p.signal;
    let on_abort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      if (!signal) return; // never settles
      on_abort = () => reject(abort_reason(signal));
      signal.addEventListener("abort", on_abort, { once: true });
    });
    aborted.catch(() => undefined);
    try {
      pending = this.recorder.call({ ...p.ctx, reservation_id }, p.req, p.rendered);
      pending.catch(() => undefined); // an orphaned call must not raise an unhandled rejection
      recorded = await Promise.race([pending, aborted]);
    } catch (e) {
      if (signal?.aborted) {
        // Lease lost: reject now, but the provider call may still be running and may still record a model_call.
        // Never release first and record later: a background continuation settles (call recorded) or releases (not).
        if (pending) void this.finish_after_abort(pending, reservation_id, amount, p);
        else await this.spend.release(reservation_id).catch(() => undefined);
        throw e;
      }
      if (e instanceof UnpricedModelError) {
        // Real spend with an unknown price: settle at the reserved worst case rather than release, then surface the error.
        await this.spend.settle(reservation_id, amount, e.model_call_id).catch(() => undefined);
        throw e;
      }
      // The original error wins over a failing release.
      await this.spend.release(reservation_id).catch(() => undefined);
      throw e;
    } finally {
      if (signal && on_abort) signal.removeEventListener("abort", on_abort);
    }
    // The provider call completed: the money is spent. A settle failure must never release the reservation.
    await this.settle_held(reservation_id, recorded, p);
    await this.spend.release(reservation_id); // no-op after settle
    return recorded;
  }

  private async finish_after_abort(pending: Promise<RecordedCall>, reservation_id: ReservationId, amount: Decimal, p: PaidCallRequest): Promise<void> {
    try {
      let recorded: RecordedCall;
      try {
        recorded = await pending;
      } catch (e) {
        if (e instanceof UnpricedModelError) await this.settle_held(reservation_id, { cost_usd: amount, model_call_id: e.model_call_id }, p);
        else await this.spend.release(reservation_id);
        return;
      }
      await this.settle_held(reservation_id, recorded, p);
    } catch {
      // settle_held already logged ids; a failed release leaves the hold for the expiry sweep. Never raise from here.
    }
  }

  private async settle_held(reservation_id: ReservationId, recorded: Pick<RecordedCall, "cost_usd" | "model_call_id">, p: PaidCallRequest): Promise<void> {
    let last: unknown;
    for (let attempt = 1; attempt <= SETTLE_ATTEMPTS; attempt++) {
      try {
        await this.spend.settle(reservation_id, recorded.cost_usd, recorded.model_call_id);
        return;
      } catch (e) {
        last = e;
      }
    }
    // Still failing: leave the reservation held (worst case stays counted) and surface the error. Ids only.
    this.logger?.error("spend.settle_failed", { run_id: p.run_id, job_id: p.job_id, extra: { reservation_id, model_call_id: recorded.model_call_id } });
    throw last;
  }
}
