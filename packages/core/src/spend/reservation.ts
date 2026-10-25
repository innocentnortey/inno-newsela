// NL-35: pure spend math (DO-4 section 8). No I/O; money is Decimal end to end.
import Decimal from "decimal.js";
import { InvariantViolation } from "../errors.ts";
import type { CapName, DayCapScope, ModelPrice, TokenUsage, Usd } from "../ports/common.ts";
import type { ReservationDecision, SpendSnapshot } from "../ports/spend.ts";

const MTOK = new Decimal(1_000_000);

/** Worst-case cost of one call: the dearer of input and cache-write price on the input estimate, plus the output cap at the output price. Rounded up to 6 places. */
export function max_call_cost(price: ModelPrice, input_tokens_estimate: number, output_cap: number): Usd {
  const in_price = Decimal.max(price.input_per_mtok, price.cache_write_per_mtok);
  return in_price
    .times(input_tokens_estimate)
    .plus(price.output_per_mtok.times(output_cap))
    .div(MTOK)
    .toDecimalPlaces(6, Decimal.ROUND_UP);
}

/** Actual cost of a finished call from its token usage, rounded half up to 6 places. */
export function settle_cost(price: ModelPrice, usage: TokenUsage): Usd {
  return price.input_per_mtok
    .times(usage.input_tokens)
    .plus(price.output_per_mtok.times(usage.output_tokens))
    .plus(price.cache_read_per_mtok.times(usage.cache_read_tokens))
    .plus(price.cache_write_per_mtok.times(usage.cache_write_tokens))
    .div(MTOK)
    .toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
}

/** Per-run cap: cost per lesson x lessons x multiplier + unit plan cost, rounded up to the next whole dollar. */
export function run_cap_for(cost_per_lesson: Usd, lessons: number, multiplier: Decimal, unit_plan_cost: Usd): Usd {
  return cost_per_lesson
    .times(lessons)
    .times(multiplier)
    .plus(unit_plan_cost)
    .toDecimalPlaces(0, Decimal.ROUND_UP);
}

export function user_day_cap_for(run_cap_default: Usd, multiplier: Decimal): Usd {
  return run_cap_default.times(multiplier).toDecimalPlaces(6, Decimal.ROUND_HALF_UP);
}

interface CapCheck {
  name: CapName;
  scope: DayCapScope | null;
  used: Usd;
  cap: Usd;
}

/** Refuses at the first cap (run, day, project) that would be exceeded; a cap is inclusive. Returns the snapshot object unchanged. */
export function decide_reservation(snapshot: SpendSnapshot, amount_usd: Usd): ReservationDecision {
  if (amount_usd.lte(0)) {
    throw new InvariantViolation("reservation amount must be positive", { amount_usd: amount_usd.toString() });
  }
  const checks: CapCheck[] = [];
  if (snapshot.run_cap_usd !== null) {
    checks.push({
      name: "run_cap",
      scope: null,
      used: snapshot.run_settled_usd.plus(snapshot.run_reserved_usd),
      cap: snapshot.run_cap_usd,
    });
  }
  checks.push({
    name: "day_cap",
    scope: "user",
    used: snapshot.user_day_settled_usd.plus(snapshot.user_day_reserved_usd),
    cap: snapshot.user_day_cap_usd,
  });
  checks.push({
    name: "project_cap",
    scope: "project",
    used: snapshot.project_settled_usd.plus(snapshot.project_reserved_usd),
    cap: snapshot.project_ceiling_usd,
  });
  for (const c of checks) {
    if (c.used.plus(amount_usd).gt(c.cap)) {
      return {
        allowed: false,
        reservation_id: null,
        refused_by: c.name,
        scope: c.scope,
        remaining_usd: Decimal.max(0, c.cap.minus(c.used)),
        snapshot,
      };
    }
  }
  return { allowed: true, reservation_id: null, refused_by: null, scope: null, remaining_usd: null, snapshot };
}
