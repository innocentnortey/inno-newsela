// NL-86: S9 full run. Drives the public API, then reads the stored rows (no second DB pass per case).
import Decimal from "decimal.js";
import { InvariantViolation } from "@ls/core/errors";
import type { RunId } from "@ls/core/ports/common";
import { resolve_cap } from "../driver/cap.ts";
import { FullRunDriver } from "../driver/driver.ts";
import { DriverError, type DriverConfig, type DriverResult } from "../driver/types.ts";
import { build_default_deps } from "../full-run-deps.ts";
import { build_full_run_report_detailed, type DetailedReport, type FullRunContext } from "../full-run-report.ts";
import type { CaseOutcome, EvalCase, EvalOptions, EvalSuite, ProviderMode } from "../types.ts";

export const S9_THRESHOLD_IDS = [
  "first_pass_schema_valid_rate_ge_0.90", "all_terminal_with_reasons", "round_trip_hash_all", "median_confirmations_le_4",
  "spend_le_run_cap", "per_lesson_cost_le_1usd", "p95_minutes_le_5", "wall_le_2h", "disclosure_prompts_l31_l32_zero", "totals_equal_call_sums",
] as const;

export interface S9Deps {
  driver_factory(opts: EvalOptions): { run(): Promise<DriverResult> };
  ctx: FullRunContext;
  expected_n?: number;
  close?: () => Promise<void>;
}

function lazy_deps(opts: EvalOptions): S9Deps {
  const env = process.env;
  const cap_usd = resolve_cap({ provider_mode: opts.provider_mode, cap_arg: null, env }); // refuses before any request
  const d = build_default_deps(env, opts.provider_mode);
  const cfg: DriverConfig = {
    base_url: env["DRIVER_BASE_URL"] ?? "http://127.0.0.1:3000/api", ...(env["DRIVER_ORIGIN"] ? { origin: env["DRIVER_ORIGIN"] } : {}), email: env["DRIVER_EMAIL"] ?? "", password: env["DRIVER_PASSWORD"] ?? "",
    unit: opts.unit ?? "G6.U4", outline_path: env["DRIVER_OUTLINE_PATH"] ?? "", provider_mode: opts.provider_mode, cap_usd,
    prompt_version_id: null, poll_ms: 2000, max_wall_ms: 7_200_000, fetch: globalThis.fetch,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)), log: (l) => process.stderr.write(`${l}\n`),
  };
  return { driver_factory: () => new FullRunDriver(cfg), ctx: { ...d.ctx, git_sha: opts.git_sha }, close: d.close };
}

export function make_s9(provider_mode: ProviderMode, deps?: S9Deps): EvalSuite {
  let memo: Promise<DetailedReport> | null = null;
  const ensure_run = (opts: EvalOptions): Promise<DetailedReport> => {
    memo ??= (async () => {
      const d = deps ?? lazy_deps(opts);
      try {
        const result = await d.driver_factory(opts).run();
        return await build_full_run_report_detailed(result.run_id as RunId, d.ctx, result.summary, d.expected_n ?? 47);
      } catch (e) {
        if (e instanceof DriverError) {
          // A run that started but did not finish still gets its report, built from the stored rows.
          if (e.run_id !== null) return await build_full_run_report_detailed(e.run_id as RunId, d.ctx, null, d.expected_n ?? 47);
          throw new InvariantViolation("full run refused or failed", { code: e.code });
        }
        throw e;
      } finally {
        await d.close?.();
      }
    })();
    return memo;
  };
  return {
    name: "S9",
    cases(): EvalCase[] {
      const provenance = provider_mode === "real" ? "issued" : "synthetic";
      const days: EvalCase[] = Array.from({ length: 47 }, (_, i) => ({
        case_id: `lesson-day-${String(i + 1).padStart(2, "0")}`, provenance, source: `S9 day ${i + 1} of unit G6.U4`, guards: "S9",
        input_path: "n/a", expected: { terminal: true, round_trip: true },
      }));
      const thresholds: EvalCase[] = S9_THRESHOLD_IDS.map((id) => ({
        case_id: id, provenance, source: "S9 thresholds, eval-plan.md", guards: "S9", input_path: "n/a", expected: { passed: true },
      }));
      return [...days, ...thresholds];
    },
    async score(c, opts): Promise<CaseOutcome> {
      const r = await ensure_run(opts);
      const m = /^lesson-day-(\d+)$/.exec(c.case_id);
      if (m !== null) {
        const l = r.facts.lessons[Number(m[1]) - 1];
        if (l === undefined) {
          return { case_id: c.case_id, passed: false, failure_category: "missing_lesson_row", actual: { run_id: r.facts.run_id, n: r.facts.n }, cost_usd: new Decimal(0) };
        }
        const passed = l.terminal_ok && (l.tile_state !== "ready" || l.round_trip === true);
        return {
          case_id: c.case_id, passed, failure_category: passed ? null : (l.first_failure ?? "round_trip_mismatch"),
          actual: { run_id: r.facts.run_id, lesson_id: l.lesson_id, tile_state: l.tile_state, round_trip: l.round_trip }, cost_usd: l.cost_usd,
        };
      }
      const t = r.thresholds.find((x) => x.id === c.case_id);
      if (t === undefined) {
        return { case_id: c.case_id, passed: false, failure_category: "unknown_threshold", actual: { run_id: r.facts.run_id }, cost_usd: new Decimal(0) };
      }
      return { case_id: c.case_id, passed: t.passed, failure_category: t.passed ? null : t.id, actual: { run_id: r.facts.run_id, detail: t.detail }, cost_usd: new Decimal(0) };
    },
  };
}
