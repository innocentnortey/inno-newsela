// NL-85
import { CHECK_RULES } from "@ls/core/checks/registry";
import { describe, expect, it } from "vitest";
import type { CaseOutcome, EvalOptions } from "../types.ts";
import { make_s2 } from "./s2.ts";

const OPTS: EvalOptions = { repeat: 1, provider_mode: "stub", git_sha: "x", unit: null };
const BLOCKING_KINDS = [...CHECK_RULES.filter((r) => r.level === "blocking").map((r) => r.kind)];
const score_all = async (suite = make_s2("stub")): Promise<Map<string, CaseOutcome>> => {
  const m = new Map<string, CaseOutcome>();
  for (const c of suite.cases()) m.set(c.case_id, await suite.score(c, OPTS));
  return m;
};

describe("S2 check golden", () => {
  it("one_case_per_blocking_kind", () => {
    expect(BLOCKING_KINDS).toHaveLength(21);
    const ids = make_s2("stub").cases().map((c) => c.case_id);
    for (const kind of BLOCKING_KINDS) expect(ids.filter((id) => id === `s2-rule-${kind}`)).toHaveLength(1);
  });

  it("all_rule_cases_pass", async () => {
    const all = await score_all();
    expect(all.size).toBe(28);
    for (const o of all.values()) expect({ id: o.case_id, passed: o.passed, why: o.failure_category }).toEqual({ id: o.case_id, passed: true, why: null });
  });

  it("mutation_turns_each_rule_red", async () => {
    for (const kind of BLOCKING_KINDS) {
      const all = await score_all(make_s2("stub", CHECK_RULES.filter((r) => r.kind !== kind)));
      const rule_cases_red = [...all.values()].filter((o) => o.case_id.startsWith("s2-rule-") && !o.passed).map((o) => o.case_id);
      expect(rule_cases_red, kind).toEqual([`s2-rule-${kind}`]);
      expect(all.get(`s2-rule-${kind}`)?.failure_category).toBe("missing_finding");
    }
  }, 120_000);

  it("placeholder_counts_per_pair", async () => {
    const all = await score_all();
    const n = (id: string) => (all.get(id)?.actual as { open_placeholders: number }).open_placeholders;
    expect([n("s2-placeholders-wp1"), n("s2-placeholders-wp2"), n("s2-placeholders-wp3"), n("s2-placeholders-wp4")]).toEqual([2, 1, 0, 1]);
    const refused = all.get("s2-approve-refused-wp1");
    expect(refused?.passed).toBe(true);
    expect(refused?.actual).toMatchObject({ allowed: false, refusals: ["BLOCKED"] });
  });

  it("clean_case_has_no_blocking", async () => {
    const o = (await score_all()).get("s2-clean-lesson");
    expect(o).toMatchObject({ passed: true, actual: { blocking: 0 } });
  });

  it("standard_confirmation_does_not_block", async () => {
    const o = (await score_all()).get("s2-rule-standard_confirmation");
    expect(o?.passed).toBe(true);
    expect(o?.actual).toMatchObject([{ kind: "standard_confirmation", level: "confirmation", blocks: false }]);
  });
});
