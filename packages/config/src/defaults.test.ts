// NL-01 AC-5: every DO-3 section 7 default, one table row each.
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { load_collab_settings, load_web_settings, load_worker_settings } from "./settings.ts";

const BASE = { DATABASE_URL: "postgres://u:p@h:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" };
const web = load_web_settings(BASE);
const worker = load_worker_settings(BASE);
const collab = load_collab_settings({ DATABASE_URL: BASE.DATABASE_URL, COLLAB_INTERNAL_TOKEN: "t" });

describe("NL-01 AC-5 defaults [table]", () => {
  const shared_rows: [string, unknown, unknown][] = [
    ["web build_id", web.shared.build_id, "dev"],
    ["web log_level", web.shared.log_level, "info"],
    ["web pool", web.shared.pg_pool_max, 10],
    ["collab pool", collab.shared.pg_pool_max, 5],
    ["worker pool", worker.shared.pg_pool_max, 4],
    ["mode", web.model.model_provider_mode, "stub"],
    ["key null", web.model.anthropic_api_key, null],
    ["gen id", web.model.model_generation_id, "claude-sonnet-5-5"],
    ["repair id", worker.model.model_repair_id, "claude-sonnet-5-5"],
    ["assist id", web.model.model_assist_id, "claude-sonnet-5-5"],
    ["effort", web.model.model_effort, "low"],
    ["call timeout", web.model.model_call_timeout_ms, 240000],
    ["retries", web.model.provider_max_retries, 3],
    ["pg_acquire", web.pg_acquire_timeout_ms, 2000],
    ["busy retry", web.busy_retry_after_s, 2],
    ["origin", web.app_origin, "http://localhost:3000"],
    ["cookie", web.session_cookie_name, "ls_session"],
    ["collab cookie", collab.session_cookie_name, "ls_session"],
    ["ttl", web.session_ttl_hours, 12],
    ["four eyes", web.four_eyes_enabled, true],
    ["rows", web.outline_max_rows, 200],
    ["bytes", web.outline_max_bytes, 5242880],
    ["sheets", web.sheets_fetch_timeout_ms, 10000],
    ["idem", web.idempotency_window_h, 24],
    ["undo", web.undo_window_s, 60],
    ["assist timeout", web.assist_call_timeout_ms, 20000],
    ["suggestion ttl", web.suggestion_ttl_min, 30],
    ["collab url", web.collab_internal_url, "http://collab:1234/internal"],
    ["hb gap", web.heartbeat_merge_gap_s, 60],
    ["hb spacing", web.heartbeat_min_spacing_s, 10],
    ["unchecked", web.unchecked_after_s, 30],
    ["openrouter", worker.openrouter_api_key, null],
    ["judge", worker.model_judge_id, null],
    ["concurrency", worker.generation_concurrency, 6],
    ["active runs", worker.max_active_runs, 3],
    ["wall", worker.job_wall_clock_ms, 600000],
    ["lease", worker.job_lease_ms, 120000],
    ["job poll", worker.job_poll_ms, 1000],
    ["check poll", worker.check_poll_ms, 500],
    ["draft cap", worker.draft_output_token_cap, 32000],
    ["trunc cap", worker.truncation_retry_token_cap, 48000],
    ["breaker", worker.circuit_breaker_same_check, 3],
    ["port", collab.collab_port, 1234],
    ["debounce", collab.store_debounce_ms, 2000],
    ["max debounce", collab.store_max_debounce_ms, 4000],
  ];
  it.each(shared_rows)("%s", (_n, actual, expected) => {
    expect(actual).toBe(expected);
  });

  const money: [string, Decimal, string][] = [
    ["ceiling", web.spend.build_spend_ceiling_usd, "75"],
    ["run cap", web.spend.run_cap_default_usd, "13.00"],
    ["lesson est", web.spend.cost_per_lesson_estimate_usd, "0.182"],
    ["unit est", worker.spend.unit_plan_cost_estimate_usd, "0.16"],
    ["run mult", web.spend.run_cap_multiplier, "1.5"],
    ["day mult", web.spend.user_day_cap_multiplier, "2"],
  ];
  it.each(money)("money %s is a Decimal", (_n, actual, expected) => {
    expect(actual).toBeInstanceOf(Decimal);
    expect(actual.equals(new Decimal(expected))).toBe(true);
  });

  it("worker_id defaults to hostname-pid; BUILD_ID falls back to RENDER_GIT_COMMIT", () => {
    expect(worker.worker_id).toMatch(/-\d+$/);
    expect(load_web_settings({ ...BASE, RENDER_GIT_COMMIT: "abc" }).shared.build_id).toBe("abc");
    expect(load_web_settings({ ...BASE, BUILD_ID: "b", RENDER_GIT_COMMIT: "abc" }).shared.build_id).toBe("b");
  });

  it("HEARTBEAT_MERGE_GAP_S outside 60-90 is rejected", () => {
    expect(() => load_web_settings({ ...BASE, HEARTBEAT_MERGE_GAP_S: "91" })).toThrow(/HEARTBEAT_MERGE_GAP_S/);
  });
});
