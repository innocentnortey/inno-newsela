// Test doubles for the claim loop. Test support only.
import type { JobId } from "@ls/core/ports/common";
import type { ClaimedJob, JobOutcome } from "@ls/core/ports/job-queue";
import type { SpendLedger } from "@ls/core/ports/spend";
import type { LessonJobPort, StopSignal, UnitPlanJobPort, UnitPlanOutcomeView } from "./claim-loop.ts";

export class Deferred<T> {
  readonly promise: Promise<T>;
  resolve!: (v: T) => void;
  reject!: (e: unknown) => void;
  constructor() {
    this.promise = new Promise<T>((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }
}

export async function flush(): Promise<void> {
  for (let i = 0; i < 3; i++) await new Promise<void>((r) => setImmediate(r));
}

export class StopFlag implements StopSignal {
  private flag = false;
  set(): void {
    this.flag = true;
  }
  is_set(): boolean {
    return this.flag;
  }
}

export function outcome_for(job: ClaimedJob): JobOutcome {
  return { job_id: job.job_id, status: "ready", tile_state: "ready", failure_reasons: [], brakes_fired: [] } as unknown as JobOutcome;
}

export class ControllableRunner implements LessonJobPort {
  peak = 0;
  current = 0;
  readonly started: JobId[] = [];
  readonly signals = new Map<JobId, AbortSignal | undefined>();
  private readonly gates = new Map<JobId, Deferred<void>>();
  throw_on_start: unknown = null;

  async run(job: ClaimedJob, signal?: AbortSignal): Promise<JobOutcome> {
    if (this.throw_on_start !== null) throw this.throw_on_start;
    this.started.push(job.job_id);
    this.signals.set(job.job_id, signal);
    this.current += 1;
    this.peak = Math.max(this.peak, this.current);
    const gate = new Deferred<void>();
    this.gates.set(job.job_id, gate);
    const onabort = (): void => gate.reject(signal?.reason);
    signal?.addEventListener("abort", onabort);
    try {
      await gate.promise;
      return outcome_for(job);
    } finally {
      this.current -= 1;
      signal?.removeEventListener("abort", onabort);
    }
  }
  release(job_id: JobId): void {
    this.gates.get(job_id)?.resolve();
  }
  release_all(): void {
    for (const g of this.gates.values()) g.resolve();
  }
}

export class StubUnitPlans implements UnitPlanJobPort {
  next: UnitPlanOutcomeView | null = null;
  async run(job: ClaimedJob): Promise<UnitPlanOutcomeView> {
    if (!this.next) throw new Error("no outcome queued");
    return { ...this.next, run_id: job.run_id };
  }
}

export class StubSpend {
  released = 0;
  constructor(private readonly log: string[]) {}
  async release_for_jobs(_ids: readonly JobId[]): Promise<number> {
    this.log.push("release_for_jobs");
    return this.released;
  }
  as_ledger(): SpendLedger {
    return this as unknown as SpendLedger;
  }
}
