import { describe, expect, it } from "vitest";
import { run_checks } from "./registry.ts";
import type { CheckRule, CheckFinding } from "./types.ts";
import {
  DEFAULT_POLICY,
  finding,
  make_ctx,
  reading_lesson,
} from "./test-helpers.ts";

const rule = (kind: CheckRule["kind"], fs: CheckFinding[]): CheckRule => ({
  kind,
  level: "blocking",
  run: () => fs,
});
const ctx = make_ctx(reading_lesson());

describe("run_checks", () => {
  it("orders findings by kind then address", () => {
    const rules = [
      rule("section_missing", [
        finding("section_missing", { address: "b" }),
        finding("section_missing", { address: "a" }),
      ]),
      rule("cross_lesson_link", [
        finding("cross_lesson_link", { address: "z" }),
      ]),
    ];
    const r = run_checks(ctx, rules, DEFAULT_POLICY);
    expect(r.findings.map((f) => `${f.kind}:${f.address}`)).toEqual([
      "cross_lesson_link:z",
      "section_missing:a",
      "section_missing:b",
    ]);
  });

  it("counts 2 blocking, 1 confirmation, 3 advisory", () => {
    const rules = [
      rule("section_missing", [
        finding("section_missing"),
        finding("section_missing", { address: "x" }),
      ]),
      rule("standard_confirmation", [
        finding("standard_confirmation", { level: "confirmation" }),
      ]),
      rule("arc_repeat", [
        finding("arc_repeat", { level: "advisory" }),
        finding("arc_repeat", { level: "advisory", address: "1" }),
        finding("arc_repeat", { level: "advisory", address: "2" }),
      ]),
    ];
    const r = run_checks(ctx, rules, DEFAULT_POLICY);
    expect([r.blocking, r.confirmation, r.advisory]).toEqual([2, 1, 3]);
    expect(r.content_hash).toBe(ctx.content_hash);
  });

  it("first_failing_kind is the first blocking kind, or null", () => {
    const rules = [
      rule("arc_repeat", [finding("arc_repeat", { level: "advisory" })]),
      rule("schema_invalid", [finding("schema_invalid")]),
      rule("minutes_out_of_range", [finding("minutes_out_of_range")]),
    ];
    expect(run_checks(ctx, rules, DEFAULT_POLICY).first_failing_kind).toBe(
      "minutes_out_of_range",
    );
    expect(
      run_checks(ctx, [rules[0] as CheckRule], DEFAULT_POLICY)
        .first_failing_kind,
    ).toBeNull();
  });

  it("propagates a rule's exception", () => {
    const boom: CheckRule = {
      kind: "judge_no",
      level: "advisory",
      run: () => {
        throw new Error("rule failed");
      },
    };
    expect(() => run_checks(ctx, [boom], DEFAULT_POLICY)).toThrow(
      "rule failed",
    );
  });
});
