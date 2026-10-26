// NL-109 (S3): cost guards. Pure. Constants are from ticket NL-109 and docs/analysis/spikes/SP-1-one-call-draft.md:
// $0.182 mean per lesson including repairs, about $0.17 per unit-plan call for a run, default ceiling $5.
import Decimal from "decimal.js";
import { InvariantViolation } from "@ls/core/errors";

export const SP1_USD_PER_LESSON = "0.182";
export const PLAN_USD_PER_RUN = "0.17";
export const DEFAULT_MAX_USD = 5;
export const DEFAULT_PD29_CEILING_USD = 75;
export const REAL_MAX_OUTPUT = 32000;
export const RETRY_MAX_OUTPUT = 48000;
export const STOP_BEFORE_NEXT_USD = "0.40";
export const PER_RUN_CAP_USD = "1.50";

/** Expected (not worst-case) cost of `repeat` runs over `cases` cases: the worst-case reservation sum alone exceeds $5. */
export function estimate_usd(cases: number, repeat: number): Decimal {
  return new Decimal(cases).times(repeat).times(new Decimal(SP1_USD_PER_LESSON).plus(PLAN_USD_PER_RUN));
}

export interface GuardLimit { limit: Decimal; note: string }

/** limit = min(--max-usd or $5, BUILD_SPEND_CEILING_USD). No project-total settled reader exists, so PD-29 headroom is not subtracted. */
export function guard_limit(max_usd: number | null | undefined, env: Record<string, string | undefined>): GuardLimit {
  const raw = env["BUILD_SPEND_CEILING_USD"];
  const ceiling = raw !== undefined && /^\d+(\.\d+)?$/.test(raw) ? new Decimal(raw) : new Decimal(DEFAULT_PD29_CEILING_USD);
  const asked = new Decimal(max_usd ?? DEFAULT_MAX_USD);
  return { limit: Decimal.min(asked, ceiling), note: "PD-29 headroom not read (no total reader)" };
}

export function guard_line(cases: number, repeat: number, g: GuardLimit): string {
  return `S3 guard: estimated reservation $${estimate_usd(cases, repeat).toFixed(2)} for ${cases * repeat} runs; limit $${g.limit.toFixed(2)} (min of --max-usd, PD-29 ceiling); ${g.note}`;
}

/** G3: refuse before the eval run starts when the estimate exceeds the limit. Applies to real mode or whenever --max-usd is given. */
export function check_estimate(opts: { provider_mode: "real" | "stub"; max_usd?: number | null }, cases: number, repeat: number, env: Record<string, string | undefined>): void {
  if (opts.provider_mode !== "real" && (opts.max_usd === undefined || opts.max_usd === null)) return;
  const g = guard_limit(opts.max_usd, env);
  const est = estimate_usd(cases, repeat);
  if (est.gt(g.limit)) {
    throw new InvariantViolation(`S3 cost guard: estimated $${est.toFixed(2)} exceeds the limit $${g.limit.toFixed(2)} (--max-usd / PD-29 ceiling); no model call was made`);
  }
}

/** G4 (real mode): stop before the next case when what is left under the limit is at most $0.40. */
export function check_running(spent: Decimal, limit: Decimal): void {
  if (limit.minus(spent).lte(STOP_BEFORE_NEXT_USD)) {
    throw new InvariantViolation(`S3 cost guard: running total $${spent.toFixed(2)} reached the limit $${limit.toFixed(2)}; stopped before the next case`);
  }
}

/** The per-run cap passed to RunService.start in real mode. */
export function run_cap(spent: Decimal, limit: Decimal): number {
  return Decimal.min(new Decimal(PER_RUN_CAP_USD), limit.minus(spent)).toNumber();
}
