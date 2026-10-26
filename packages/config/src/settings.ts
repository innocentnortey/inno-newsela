import { hostname } from "node:os";
import type Decimal from "decimal.js";
import { ConfigError } from "./errors.ts";
import {
  read_bool,
  read_decimal,
  read_enum,
  read_int,
  read_optional_secret,
  read_optional_string,
  read_secret,
  read_secret_url,
  read_string,
  read_url,
  type Env,
} from "./env.ts";
import type { SecretStr } from "./secret.ts";

export type { Env };

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface SharedSettings {
  database_url: SecretStr;
  pg_pool_max: number;
  build_id: string;
  log_level: LogLevel;
}
export interface ModelSettings {
  model_provider_mode: "real" | "stub";
  anthropic_api_key: SecretStr | null;
  model_generation_id: string;
  model_repair_id: string;
  model_assist_id: string;
  model_effort: "low" | "medium" | "high";
  model_call_timeout_ms: number;
  provider_max_retries: number;
}
export interface SpendSettings {
  build_spend_ceiling_usd: Decimal;
  run_cap_default_usd: Decimal;
  user_day_cap_multiplier: Decimal;
  cost_per_lesson_estimate_usd: Decimal;
  unit_plan_cost_estimate_usd: Decimal;
  run_cap_multiplier: Decimal;
}
export interface WebSettings {
  shared: SharedSettings;
  model: ModelSettings;
  spend: SpendSettings;
  pg_acquire_timeout_ms: number;
  busy_retry_after_s: number;
  app_origin: string;
  session_cookie_name: string;
  session_ttl_hours: number;
  audit_hash_salt: SecretStr;
  four_eyes_enabled: boolean;
  outline_max_rows: number;
  outline_max_bytes: number;
  sheets_fetch_timeout_ms: number;
  sheets_base_url: string;
  idempotency_window_h: number;
  undo_window_s: number;
  assist_call_timeout_ms: number;
  suggestion_ttl_min: number;
  collab_internal_url: string;
  collab_internal_token: SecretStr;
  heartbeat_merge_gap_s: number;
  heartbeat_min_spacing_s: number;
  unchecked_after_s: number;
}
export interface WorkerSettings {
  shared: SharedSettings;
  model: ModelSettings;
  spend: SpendSettings;
  worker_id: string;
  openrouter_api_key: SecretStr | null;
  model_judge_id: string | null;
  generation_concurrency: number;
  max_active_runs: number;
  job_wall_clock_ms: number;
  job_lease_ms: number;
  job_poll_ms: number;
  check_poll_ms: number;
  draft_output_token_cap: number;
  truncation_retry_token_cap: number;
  circuit_breaker_same_check: number;
}
export interface CollabSettings {
  shared: SharedSettings;
  collab_port: number;
  collab_internal_token: SecretStr;
  session_cookie_name: string;
  store_debounce_ms: number;
  store_max_debounce_ms: number;
}

const HTTP = ["http:", "https:"] as const;
const DB = ["postgres:", "postgresql:"] as const;

function nonempty(v: string | undefined): string | undefined {
  return v === undefined || v === "" ? undefined : v;
}

const DEFAULT_SHEETS_BASE_URL = "https://docs.google.com";
function load_sheets_base_url(env: Env, mode: "real" | "stub"): string {
  const raw = read_url(env, "SHEETS_BASE_URL", ["https:", "http:"], { default: DEFAULT_SHEETS_BASE_URL });
  const origin = new URL(raw).origin; // keeps scheme, host, port; drops any path
  if (origin === DEFAULT_SHEETS_BASE_URL) return origin;
  const host = new URL(origin).hostname;
  const loopback = host === "127.0.0.1" || host === "localhost" || host === "[::1]";
  if (mode !== "stub" || !loopback) {
    throw new ConfigError(
      "SHEETS_BASE_URL",
      "only the default Google origin is allowed unless MODEL_PROVIDER_MODE=stub and the host is loopback",
    );
  }
  return origin;
}

function load_shared_settings(env: Env, default_pool_max: number): SharedSettings {
  return {
    database_url: read_secret_url(env, "DATABASE_URL", DB),
    pg_pool_max: read_int(env, "PG_POOL_MAX", { default: default_pool_max, min: 1 }),
    build_id: nonempty(env.BUILD_ID) ?? nonempty(env.RENDER_GIT_COMMIT) ?? "dev",
    log_level: read_enum(env, "LOG_LEVEL", ["debug", "info", "warn", "error"] as const, {
      default: "info",
    }),
  };
}

function load_model_settings(env: Env): ModelSettings {
  const model_provider_mode = read_enum(env, "MODEL_PROVIDER_MODE", ["real", "stub"] as const, {
    default: "stub",
  });
  const anthropic_api_key = read_optional_secret(env, "ANTHROPIC_API_KEY");
  if (model_provider_mode === "real" && anthropic_api_key === null) {
    throw new ConfigError("ANTHROPIC_API_KEY", "required when MODEL_PROVIDER_MODE=real");
  }
  return {
    model_provider_mode,
    anthropic_api_key,
    model_generation_id: read_string(env, "MODEL_GENERATION_ID", { default: "claude-sonnet-5-5" }),
    model_repair_id: read_string(env, "MODEL_REPAIR_ID", { default: "claude-sonnet-5-5" }),
    model_assist_id: read_string(env, "MODEL_ASSIST_ID", { default: "claude-sonnet-5-5" }),
    model_effort: read_enum(env, "MODEL_EFFORT", ["low", "medium", "high"] as const, {
      default: "low",
    }),
    model_call_timeout_ms: read_int(env, "MODEL_CALL_TIMEOUT_MS", { default: 240000, min: 1 }),
    provider_max_retries: read_int(env, "PROVIDER_MAX_RETRIES", { default: 3, min: 1 }),
  };
}

export function load_spend_settings(env: Env): SpendSettings {
  return {
    build_spend_ceiling_usd: read_decimal(env, "BUILD_SPEND_CEILING_USD", { default: "75" }),
    run_cap_default_usd: read_decimal(env, "RUN_CAP_DEFAULT_USD", { default: "13.00" }),
    user_day_cap_multiplier: read_decimal(env, "USER_DAY_CAP_MULTIPLIER", { default: "2" }),
    cost_per_lesson_estimate_usd: read_decimal(env, "COST_PER_LESSON_ESTIMATE_USD", {
      default: "0.182",
    }),
    unit_plan_cost_estimate_usd: read_decimal(env, "UNIT_PLAN_COST_ESTIMATE_USD", {
      default: "0.16",
    }),
    run_cap_multiplier: read_decimal(env, "RUN_CAP_MULTIPLIER", { default: "1.5" }),
  };
}

export function load_web_settings(env: Env): WebSettings {
  const shared = load_shared_settings(env, 10);
  const model = load_model_settings(env);
  const spend = load_spend_settings(env);
  return {
    shared,
    model,
    spend,
    pg_acquire_timeout_ms: read_int(env, "PG_ACQUIRE_TIMEOUT_MS", { default: 2000, min: 1 }),
    busy_retry_after_s: read_int(env, "BUSY_RETRY_AFTER_S", { default: 2, min: 1 }),
    app_origin: read_url(env, "APP_ORIGIN", HTTP, { default: "http://localhost:3000" }),
    session_cookie_name: read_string(env, "SESSION_COOKIE_NAME", { default: "ls_session" }),
    session_ttl_hours: read_int(env, "SESSION_TTL_HOURS", { default: 12, min: 1 }),
    audit_hash_salt: read_secret(env, "AUDIT_HASH_SALT"),
    four_eyes_enabled: read_bool(env, "FOUR_EYES_ENABLED", { default: true }),
    outline_max_rows: read_int(env, "OUTLINE_MAX_ROWS", { default: 200, min: 1 }),
    outline_max_bytes: read_int(env, "OUTLINE_MAX_BYTES", { default: 5242880, min: 1 }),
    sheets_fetch_timeout_ms: read_int(env, "SHEETS_FETCH_TIMEOUT_MS", { default: 10000, min: 1 }),
    sheets_base_url: load_sheets_base_url(env, model.model_provider_mode),
    idempotency_window_h: read_int(env, "IDEMPOTENCY_WINDOW_H", { default: 24, min: 1 }),
    undo_window_s: read_int(env, "UNDO_WINDOW_S", { default: 60, min: 1 }),
    assist_call_timeout_ms: read_int(env, "ASSIST_CALL_TIMEOUT_MS", { default: 20000, min: 1 }),
    suggestion_ttl_min: read_int(env, "SUGGESTION_TTL_MIN", { default: 30, min: 1 }),
    collab_internal_url: read_url(env, "COLLAB_INTERNAL_URL", HTTP, {
      default: "http://collab:1234/internal",
    }),
    collab_internal_token: read_secret(env, "COLLAB_INTERNAL_TOKEN"),
    heartbeat_merge_gap_s: read_int(env, "HEARTBEAT_MERGE_GAP_S", { default: 60, min: 60, max: 90 }),
    heartbeat_min_spacing_s: read_int(env, "HEARTBEAT_MIN_SPACING_S", { default: 10, min: 1 }),
    unchecked_after_s: read_int(env, "UNCHECKED_AFTER_S", { default: 30, min: 1 }),
  };
}

export function load_worker_settings(env: Env): WorkerSettings {
  const shared = load_shared_settings(env, 4);
  const model = load_model_settings(env);
  const spend = load_spend_settings(env);
  return {
    shared,
    model,
    spend,
    worker_id: nonempty(env.WORKER_ID) ?? `${hostname()}-${process.pid}`,
    openrouter_api_key: read_optional_secret(env, "OPENROUTER_API_KEY"),
    model_judge_id: read_optional_string(env, "MODEL_JUDGE_ID"),
    generation_concurrency: read_int(env, "GENERATION_CONCURRENCY", { default: 6, min: 1, max: 6 }),
    max_active_runs: read_int(env, "MAX_ACTIVE_RUNS", { default: 3, min: 1 }),
    job_wall_clock_ms: read_int(env, "JOB_WALL_CLOCK_MS", { default: 600000, min: 1 }),
    job_lease_ms: read_int(env, "JOB_LEASE_MS", { default: 120000, min: 1 }),
    job_poll_ms: read_int(env, "JOB_POLL_MS", { default: 1000, min: 1 }),
    check_poll_ms: read_int(env, "CHECK_POLL_MS", { default: 500, min: 1 }),
    draft_output_token_cap: read_int(env, "DRAFT_OUTPUT_TOKEN_CAP", { default: 32000, min: 1 }),
    truncation_retry_token_cap: read_int(env, "TRUNCATION_RETRY_TOKEN_CAP", {
      default: 48000,
      min: 1,
    }),
    circuit_breaker_same_check: read_int(env, "CIRCUIT_BREAKER_SAME_CHECK", { default: 3, min: 1 }),
  };
}

export function load_collab_settings(env: Env): CollabSettings {
  return {
    shared: load_shared_settings(env, 5),
    collab_port: read_int(env, "COLLAB_PORT", { default: 1234, min: 1 }),
    collab_internal_token: read_secret(env, "COLLAB_INTERNAL_TOKEN"),
    session_cookie_name: read_string(env, "SESSION_COOKIE_NAME", { default: "ls_session" }),
    store_debounce_ms: read_int(env, "STORE_DEBOUNCE_MS", { default: 1000, min: 1 }),
    store_max_debounce_ms: read_int(env, "STORE_MAX_DEBOUNCE_MS", { default: 2000, min: 1 }),
  };
}
