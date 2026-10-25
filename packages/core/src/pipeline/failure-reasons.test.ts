import { describe, expect, it } from "vitest";
import { FailureReason } from "@ls/schema/api/runs";
import { FAILURE_MESSAGES, failure_reasons_for } from "./failure-reasons.ts";
import type { BrakeName, CheckKind, FailureInput } from "./state.ts";

const base: FailureInput = {
  brakes_fired: [],
  provider_error: null,
  schema_valid: true,
  compile_error: null,
  first_failing_kind: null,
};
const checks = (i: Partial<FailureInput>): string[] =>
  failure_reasons_for({ ...base, ...i }).map((r) => r.check);
const brake = (b: BrakeName): Partial<FailureInput> => ({ brakes_fired: [b] });
const kind: CheckKind = "minutes_out_of_range";

describe("single rows", () => {
  it.each<[string, Partial<FailureInput>, string[]]>([
    ["cancelled", brake("cancelled"), ["cancelled"]],
    ["spend_run_cap", brake("spend_run_cap"), ["capped"]],
    ["spend_day_cap", brake("spend_day_cap"), ["capped"]],
    ["spend_project_cap", brake("spend_project_cap"), ["capped"]],
    ["job_wall_clock", brake("job_wall_clock"), ["timeout"]],
    ["truncation_retry", brake("truncation_retry"), ["truncated"]],
    ["rate_limited", { provider_error: "rate_limited" }, ["rate_limited"]],
    ["overloaded", { provider_error: "overloaded" }, ["rate_limited"]],
    ["provider timeout", { provider_error: "timeout" }, ["timeout"]],
    ["auth", { provider_error: "auth" }, ["provider_error"]],
    ["compile error", { compile_error: "" }, ["compile_error"]],
    ["invalid schema", { schema_valid: false }, ["schema_invalid"]],
    ["failing kind", { first_failing_kind: kind }, ["check_failed"]],
    ["circuit_breaker only", brake("circuit_breaker"), []],
  ])("%s", (_n, input, want) => {
    expect(checks(input)).toEqual(want);
  });
});

describe("combinations", () => {
  it("capped + schema_invalid", () => {
    expect(checks({ ...brake("spend_run_cap"), schema_valid: false })).toEqual([
      "capped",
      "schema_invalid",
    ]);
  });
  it("cancelled + compile_error", () => {
    expect(checks({ ...brake("cancelled"), compile_error: "x" })).toEqual([
      "cancelled",
      "compile_error",
    ]);
  });
  it("wall clock + provider timeout yields timeout once", () => {
    expect(
      checks({ ...brake("job_wall_clock"), provider_error: "timeout" }),
    ).toEqual(["timeout"]);
  });
});

describe("messages_fixed", () => {
  it("never carries model text and maps to OpenAPI enum", () => {
    const rs = failure_reasons_for({
      ...base,
      brakes_fired: ["circuit_breaker", "repair_round"],
      compile_error: "RAW-MODEL-TEXT-2f9",
      first_failing_kind: kind,
    });
    expect(JSON.stringify(rs)).not.toContain("RAW-MODEL-TEXT-2f9");
    expect(rs.map((r) => r.check)).toEqual(["compile_error", "check_failed"]);
    expect(rs.map((r) => r.check_kind)).toEqual([null, kind]);
    for (const m of Object.values(FAILURE_MESSAGES))
      expect(m).not.toMatch(/[{}]/);
    const options = FailureReason.shape.check.options as readonly string[];
    for (const c of Object.keys(FAILURE_MESSAGES)) expect(options).toContain(c);
    for (const r of rs) expect(options).toContain(r.check);
  });
});
