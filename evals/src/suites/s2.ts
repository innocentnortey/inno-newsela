// NL-85: S2 check golden. One failing fixture per blocking rule of R-19, a clean pass, the WP-1..WP-4
// placeholder counts and the Approve refusal. Deterministic: no model call, no database.
import { readFileSync } from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import Decimal from "decimal.js";
import { approve_gate, merge_resolutions } from "@ls/core/checks/gates";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { CHECK_RULES, run_checks } from "@ls/core/checks/registry";
import { gate_state } from "@ls/core/checks/test-helpers";
import type { CheckFinding, CheckRuleList } from "@ls/core/checks/types";
import type { JsonValue } from "@ls/core/ports/common";
import type { CaseOutcome, EvalCase, EvalSuite, ProviderMode } from "../types.ts";
import { RECIPES } from "./s2-fixtures.ts";

type Issue = { kind: string; level: string; blocks: boolean; address: string | null; code?: string };
type RawCase = {
  case_id: string; provenance: EvalCase["provenance"]; source: string; guards: string;
  recipe: string; focus_kinds: string[]; expected: { [k: string]: JsonValue };
};
const FILES = ["rules.json", "placeholders.json"];
const PLACEHOLDER_KINDS = ["quote_placeholder_open", "excerpt_slot_open"];

function load(): { raw: RawCase; input_path: string }[] {
  return FILES.flatMap((f) => {
    const text = readFileSync(path.join(import.meta.dirname, "../../cases/s2", f), "utf8");
    return (JSON.parse(text) as { cases: RawCase[] }).cases.map((raw) => ({ raw, input_path: `evals/cases/s2/${f}` }));
  });
}

const to_issue = (f: CheckFinding): Issue => ({
  kind: f.kind, level: f.level, blocks: f.level === "blocking", address: f.address,
  ...(f.code === null ? {} : { code: f.code }),
});
const order = (a: Issue, b: Issue): number =>
  (a.address ?? "").localeCompare(b.address ?? "") || (a.code ?? "").localeCompare(b.code ?? "") || a.kind.localeCompare(b.kind);

export function make_s2(_provider_mode: ProviderMode, rules: CheckRuleList = CHECK_RULES): EvalSuite {
  const all = load();
  const by_id = new Map(all.map((x) => [x.raw.case_id, x.raw]));
  return {
    name: "S2",
    cases: () =>
      all.map(({ raw, input_path }) => ({
        case_id: raw.case_id, provenance: raw.provenance, source: raw.source, guards: raw.guards,
        input_path, expected: structuredClone(raw.expected) as JsonValue,
      })),
    async score(c): Promise<CaseOutcome> {
      const raw = by_id.get(c.case_id);
      if (raw === undefined) throw new Error(`unknown S2 case ${c.case_id}`);
      const recipe = RECIPES[raw.recipe];
      if (recipe === undefined) throw new Error(`no recipe ${raw.recipe}`);
      const result = run_checks(recipe(), rules, CHECK_POLICY);
      const done = (passed: boolean, failure_category: string | null, actual: JsonValue): CaseOutcome => ({
        case_id: c.case_id, passed, failure_category, actual, cost_usd: new Decimal(0),
      });
      const expected = raw.expected;

      if ("blocking" in expected) {
        const ok = result.blocking === expected.blocking;
        return done(ok, ok ? null : "unexpected_blocking", { blocking: result.blocking, first_failing_kind: result.first_failing_kind });
      }

      if ("open_placeholders" in expected) {
        const found = result.findings.filter((f) => PLACEHOLDER_KINDS.includes(f.kind));
        const count = found.length;
        if (count !== expected.open_placeholders) return done(false, "wrong_count", { open_placeholders: count });
        const want = expected.approve as { allowed: boolean; first_refusal: string; kinds: string[] } | undefined;
        if (want === undefined) return done(true, null, { open_placeholders: count });
        const decision = approve_gate(gate_state({ action: "approve", issues: merge_resolutions(result.findings, []) }));
        const listed = ((decision.details as { issues?: { kind: string }[] }).issues ?? []).map((i) => i.kind);
        const ok = decision.allowed === want.allowed && decision.refusals[0] === want.first_refusal
          && want.kinds.every((k) => listed.includes(k));
        return done(ok, ok ? null : "gate_allowed", { open_placeholders: count, allowed: decision.allowed, refusals: decision.refusals });
      }

      const want = (expected.issues as unknown as Issue[]).slice().sort(order);
      const got = result.findings.filter((f) => raw.focus_kinds.includes(f.kind)).map(to_issue).sort(order);
      if (got.length === 0) return done(false, "missing_finding", []);
      const ok = isDeepStrictEqual(got, want);
      return done(ok, ok ? null : "wrong_finding", got as unknown as JsonValue);
    },
  };
}
