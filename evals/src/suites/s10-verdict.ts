// NL-92: the single source of the S10 thresholds (DO-5). rate = caught / n.
export type S10Status = "meets" | "reported" | "fail(floor)" | "fail(guard)";
export interface S10Verdict {
  caught: number;
  n: number;
  rate: number;
  status: S10Status;
}

export const MEETS_RATE = 0.9;
export const GUARD_RATE = 0.7;

// Order matters: the wrong-code floor first, then the guard, then the aspiration.
export function verdict_of(caught: number, n: number, wrong_code_caught: boolean): S10Verdict {
  const rate = n === 0 ? 0 : caught / n;
  const status: S10Status = !wrong_code_caught ? "fail(floor)" : rate < GUARD_RATE ? "fail(guard)" : rate >= MEETS_RATE ? "meets" : "reported";
  return { caught, n, rate, status };
}

export function verdict(results: readonly { kind: string; caught: boolean }[]): S10Verdict {
  const wrong = results.filter((r) => r.kind === "wrong_standard_code");
  return verdict_of(results.filter((r) => r.caught).length, results.length, wrong.length > 0 && wrong.every((r) => r.caught));
}

// The CLI exit code for S10 comes from here, not from the generic floor table.
export function s10_floor_met(passed: number, total: number, wrong_code_caught: boolean): boolean {
  return !verdict_of(passed, total, wrong_code_caught).status.startsWith("fail");
}
