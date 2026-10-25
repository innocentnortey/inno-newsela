// NL-107 AC-1…AC-4: the four invariants, each over a real claim loop, recorder, spend ledger and Postgres.
import { beforeAll, describe, expect, it } from "vitest";
import { run_cap, run_kill, run_rate_limit, run_truncation, type ScenarioResult } from "./s6-scenarios.ts";

const checks = (r: ScenarioResult): Record<string, boolean> => (r.actual as { checks: Record<string, boolean> }).checks;

describe("fault scenarios", () => {
  it("kill_resumes_without_duplicates", async () => {
    const r = await run_kill();
    expect(checks(r)).toMatchObject({ all_ready: true, no_duplicate_versions: true, no_repaid_call: true, lost_calls_counted_equal_in_flight: true, calls_in_flight_at_kill: true });
    expect(r.passed, String(r.failure_category)).toBe(true);
  }, 300_000);

  it("rate_limit_loses_no_lesson", async () => {
    const r = await run_rate_limit();
    expect(checks(r)).toMatchObject({ all_ready: true, none_lost_to_rate_limit: true, retries_visible: true });
    expect(r.passed, String(r.failure_category)).toBe(true);
  }, 300_000);

  describe("truncation", () => {
    let r: ScenarioResult;
    beforeAll(async () => { r = await run_truncation(); }, 300_000);
    it("truncation_one_raised_retry", () => {
      expect(checks(r)).toMatchObject({ a_two_calls: true, a_raised_cap_on_retry: true, a_lesson_ready: true });
    });
    it("truncation_twice_fails_truncated", () => {
      expect(checks(r)).toMatchObject({ b_two_calls_no_third: true, b_failed_truncated: true });
      expect(r.passed, String(r.failure_category)).toBe(true);
    });
  });

  it("cap_never_overshoots", async () => {
    const r = await run_cap();
    expect(checks(r)).toMatchObject({ settled_within_cap: true, run_capped: true, nothing_left_reserved: true, capped_lesson_not_paid: true });
    expect(r.passed, String(r.failure_category)).toBe(true);
  }, 300_000);
});
