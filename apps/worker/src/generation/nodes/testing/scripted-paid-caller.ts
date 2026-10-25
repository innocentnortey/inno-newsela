import Decimal from "decimal.js";
import { ProviderError, SpendRefused, type ProviderErrorKind } from "@ls/core/errors";
import type { CallPurpose, CapName, JobId, ModelCallId } from "@ls/core/ports/common";
import type { RecordedCall } from "@ls/core/ports/model-call-log";
import type { CheckpointPort, PaidCallRequest, PaidCallerPort } from "../collaborators.ts";

export type Step =
  | { raw: string; stop_reason?: string; cost?: string; served_model?: string; retries?: number; on_call?: () => void }
  | { refuse: CapName }
  | { provider_error: ProviderErrorKind };

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function ulid_body(n: number): string {
  let out = "";
  let v = n;
  do {
    out = CROCKFORD[v % 32]! + out;
    v = Math.floor(v / 32);
  } while (v > 0);
  return out.padStart(26, "0");
}

/** Scripted PaidCaller + checkpoint store. An unexpected extra call throws. */
export class ScriptedPaidCaller implements PaidCallerPort, CheckpointPort {
  readonly requests: PaidCallRequest[] = [];
  private readonly done = new Map<string, RecordedCall>();
  private counter = 0;

  constructor(private readonly script: Step[]) {}

  private key(job_id: JobId, purpose: CallPurpose, attempt: number): string {
    return `${job_id}|${purpose}|${attempt}`;
  }

  seed_completed(job_id: JobId, purpose: CallPurpose, attempt: number, raw: string, stop_reason = "end_turn"): RecordedCall {
    const call = this.make(purpose, attempt, { raw, stop_reason });
    this.done.set(this.key(job_id, purpose, attempt), call);
    return call;
  }

  private make(purpose: CallPurpose, attempt: number, step: { raw: string; stop_reason?: string; cost?: string; served_model?: string; retries?: number }): RecordedCall {
    this.counter += 1;
    return {
      model_call_id: `mc_${ulid_body(this.counter)}` as ModelCallId,
      purpose,
      attempt,
      raw_output: step.raw,
      stop_reason: step.stop_reason ?? "end_turn",
      usage: { input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_write_tokens: 0 },
      cost_usd: new Decimal(step.cost ?? "0.10"),
      served_model: step.served_model ?? "claude-test-1",
      retries: step.retries ?? 0,
    };
  }

  async call(p: PaidCallRequest): Promise<RecordedCall> {
    this.requests.push(p);
    const step = this.script.shift();
    if (step === undefined) throw new Error(`unexpected model call: ${p.ctx.purpose}`);
    if ("refuse" in step) throw new SpendRefused({ refused_by: step.refuse, scope: null, amount_usd: new Decimal("1") });
    if ("provider_error" in step) throw new ProviderError({ kind: step.provider_error });
    step.on_call?.();
    const call = this.make(p.ctx.purpose, p.ctx.attempt, step);
    this.done.set(this.key(p.ctx.job_id!, p.ctx.purpose, p.ctx.attempt), call);
    return call;
  }

  async checkpoint(job_id: JobId, purpose: CallPurpose, attempt: number): Promise<RecordedCall | null> {
    return this.done.get(this.key(job_id, purpose, attempt)) ?? null;
  }
}
