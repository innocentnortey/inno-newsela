// NL-86: S13 rating split. Reads only unit_metrics_rows and approved_snapshots: no reviewer name or minutes enters `actual`.
import Decimal from "decimal.js";
import type { LessonId, UnitId } from "@ls/core/ports/common";
import type { LessonVersionRepo } from "@ls/core/ports/lesson-versions";
import type { MetricsRepo } from "@ls/core/ports/metrics";
import { build_default_deps } from "../full-run-deps.ts";
import type { CaseOutcome, EvalCase, EvalOptions, EvalSuite, ProviderMode } from "../types.ts";

export interface S13Deps {
  metrics: Pick<MetricsRepo, "unit_metrics_rows">;
  versions: Pick<LessonVersionRepo, "approved_snapshots">;
  unit_id: UnitId;
  demo_lesson_ids: LessonId[];
}

const DEMO_IDS = ["G6.U4.L4", "G6.U4.L5", "G6.U4.FLEX-1a"] as LessonId[]; // WP-1, WP-2, WP-3 (worked-pairs.md)
const CASE_IDS = ["all_approved_rated", "rating_split_with_n", "demo_lessons_usable_with_edits_or_better", "rewritten_listed_as_trace_candidates"] as const;

export function make_s13(provider_mode: ProviderMode, deps?: S13Deps): EvalSuite {
  const provenance = provider_mode === "real" ? "issued" : "synthetic";
  async function read(opts: EvalOptions): Promise<{ d: S13Deps; close: () => Promise<void> }> {
    if (deps !== undefined) return { d: deps, close: async () => {} };
    const x = build_default_deps(process.env, opts.provider_mode);
    return { d: { metrics: x.metrics, versions: x.versions_for_s13, unit_id: (opts.unit ?? "G6.U4") as UnitId, demo_lesson_ids: DEMO_IDS }, close: x.close };
  }
  return {
    name: "S13",
    cases(): EvalCase[] {
      return CASE_IDS.map((id) => ({ case_id: id, provenance, source: "S13 rating split, eval-plan.md", guards: "S13", input_path: "n/a", expected: { passed: true } }));
    },
    async score(c, opts): Promise<CaseOutcome> {
      const { d, close } = await read(opts);
      try {
        const rows = await d.metrics.unit_metrics_rows(d.unit_id);
        const out = (passed: boolean, category: string, actual: Record<string, number | string[]>): CaseOutcome => ({
          case_id: c.case_id, passed, failure_category: passed ? null : category, actual, cost_usd: new Decimal(0),
        });
        const count = (r: string): number => rows.filter((x) => x.draft_rating === r).length;
        switch (c.case_id) {
          case "all_approved_rated": {
            const approved = new Set((await d.versions.approved_snapshots(d.unit_id)).map((v) => v.lesson_id));
            const rated = [...approved].filter((id) => rows.some((r) => r.lesson_id === id)).length;
            return out(approved.size > 0 && rated === approved.size, "unrated_approved_lesson", { approved: approved.size, rated });
          }
          case "rating_split_with_n": {
            const [a, e, w] = [count("usable_as_drafted"), count("usable_with_edits"), count("rewritten")];
            return out(rows.length > 0 && a + e + w === rows.length, "rating_split_mismatch", { n: rows.length, usable_as_drafted: a, usable_with_edits: e, rewritten: w });
          }
          case "demo_lessons_usable_with_edits_or_better": {
            const demo = rows.filter((r) => d.demo_lesson_ids.includes(r.lesson_id));
            const good = demo.filter((r) => r.draft_rating !== "rewritten").length;
            return out(demo.length >= 2 && good >= 2, "demo_lessons_below_bar", { demo_rated: demo.length, good });
          }
          case "rewritten_listed_as_trace_candidates":
            return out(true, "", { trace_candidates: rows.filter((r) => r.draft_rating === "rewritten").map((r) => r.lesson_id) });
          default:
            return out(false, "unknown_case", {});
        }
      } finally {
        await close();
      }
    },
  };
}
