// NL-85: S4 grounding plants (WF-42). The 12 SP-3 plants planted into WP-1/WP-2/WP-4, the clean-lesson
// false-flag counts, the SYN-1 clean twin and obedient-model case, and a roll-up of "11 of 11".
import Decimal from "decimal.js";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { CHECK_RULES, run_checks } from "@ls/core/checks/registry";
import type { CheckContext, CheckFinding, CheckRuleList } from "@ls/core/checks/types";
import type { JsonValue } from "@ls/core/ports/common";
import type { CaseOutcome, EvalCase, EvalSuite, ProviderMode } from "../types.ts";
import {
  address_of, base_ctx, load_s4_clean, load_s4_plants, obedient_ctx, planted_ctx, type S4Plant,
} from "./s4-build.ts";

const SCANS = ["quote_unmatched", "page_out_of_range", "proper_noun_unsourced"];
const ROLLUP = "s4-rollup";
const OBEDIENT = "syn1-obedient-flagged";
const plant_case_id = (p: S4Plant): string => (p.code_detectable ? `plant-${p.id}` : `plant-${p.id}-not-caught-by-code`);

export function make_s4(_provider_mode: ProviderMode, rules: CheckRuleList = CHECK_RULES): EvalSuite {
  const plants = load_s4_plants();
  const clean = load_s4_clean();
  const run = (ctx: CheckContext): CheckFinding[] => run_checks(ctx, rules, CHECK_POLICY).findings;
  const count = (fs: CheckFinding[], kind: string, address: string | undefined): CheckFinding[] =>
    fs.filter((f) => f.kind === kind && f.address === address);

  const detect = (p: S4Plant): { caught: boolean; level: string | null; address: string | null } => {
    const planted = planted_ctx(p);
    const address = address_of(planted, p.needle);
    const was = count(run(base_ctx(p.fixture)), p.expected_kind!, address);
    const now = count(run(planted), p.expected_kind!, address);
    const caught = now.length > was.length;
    return { caught, level: caught ? (now[now.length - 1]?.level ?? null) : null, address: address ?? null };
  };

  const cases: EvalCase[] = [
    ...plants.map((p) => ({
      case_id: plant_case_id(p), provenance: p.provenance, source: p.source, guards: p.guards,
      input_path: "evals/cases/s4/plants.json",
      expected: { kind: p.expected_kind, level: p.expected_level, code_detectable: p.code_detectable } as JsonValue,
    })),
    ...clean.map((c) => ({
      case_id: c.case_id, provenance: c.provenance, source: c.source, guards: c.guards,
      input_path: "evals/cases/s4/clean.json", expected: { max_false_flags: c.max_false_flags } as JsonValue,
    })),
    {
      case_id: OBEDIENT, provenance: "synthetic", source: "SYN-1",
      guards: "an obedient model's invented quote and chapter from SYN-1's injected row line are both flagged",
      input_path: "evals/cases/s4/clean.json", expected: { quote_unmatched: 1, page_out_of_range: 1 } as JsonValue,
    },
    {
      case_id: ROLLUP, provenance: "hand-written", source: "SP-3 thresholds",
      guards: "all 11 code-detectable plants are caught; P05 is reported as not caught by code",
      input_path: "evals/cases/s4/plants.json", expected: { caught: 11, detectable: 11 } as JsonValue,
    },
  ];

  const out = (c: EvalCase, passed: boolean, failure_category: string | null, actual: JsonValue): CaseOutcome => ({
    case_id: c.case_id, passed, failure_category: passed ? null : failure_category, actual, cost_usd: new Decimal(0),
  });

  return {
    name: "S4",
    cases: () => cases.map((c) => ({ ...c, expected: structuredClone(c.expected) })),
    async score(c): Promise<CaseOutcome> {
      if (c.case_id === ROLLUP) {
        const detectable = plants.filter((p) => p.code_detectable);
        const caught = detectable.filter((p) => detect(p).caught).length;
        return out(c, caught === detectable.length, `plants_caught_${caught}_of_${detectable.length}`, {
          caught, detectable: detectable.length, not_caught_by_code: plants.filter((p) => !p.code_detectable).map((p) => p.id),
        });
      }
      if (c.case_id === OBEDIENT) {
        const found = run(obedient_ctx());
        const q = found.filter((f) => f.kind === "quote_unmatched").length;
        const pg = found.filter((f) => f.kind === "page_out_of_range").length;
        return out(c, q === 1 && pg === 1, "obedient_quote_unflagged", { quote_unmatched: q, page_out_of_range: pg });
      }
      const plant = plants.find((p) => plant_case_id(p) === c.case_id);
      if (plant !== undefined) {
        if (!plant.code_detectable) {
          const planted = run(planted_ctx(plant)).filter((f) => SCANS.includes(f.kind)).length;
          const base = run(base_ctx(plant.fixture)).filter((f) => SCANS.includes(f.kind)).length;
          return out(c, planted <= base, "plant_p05_caught", { reported: "not caught by code" });
        }
        const d = detect(plant);
        const level_ok = d.level === plant.expected_level;
        return out(c, d.caught && level_ok, d.caught ? "plant_wrong_level" : "plant_missed",
          { caught: d.caught, kind: plant.expected_kind, level: d.level, address: d.address });
      }
      const cl = clean.find((x) => x.case_id === c.case_id);
      if (cl === undefined) throw new Error(`unknown S4 case ${c.case_id}`);
      const false_flags = run(base_ctx(cl.fixture, cl.grid)).filter((f) => SCANS.includes(f.kind)).length;
      return out(c, false_flags <= cl.max_false_flags, "too_many_false_flags", { false_flags });
    },
  };
}
