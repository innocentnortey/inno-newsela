import { randomUUID } from "node:crypto";
import { PgDatabase } from "@ls/db/pool";
import { load_web_settings } from "@ls/config/settings";
import { record_ops_event } from "@ls/db/ops-event";
import { create_logger, type Logger } from "@ls/obs/logger";

export interface HealthDb { ping(): Promise<boolean>; with_tx: PgDatabase["with_tx"] }
export interface HealthOptions { build_id: string; logger: Logger; now?: () => number; ping_timeout_ms?: number; throttle_ms?: number }
export interface HealthResult {
  status: 200 | 503;
  body: { status: "ok"; service: string; build_id: string } | { status: "unavailable"; service: string };
  request_id: string;
}

const REQUEST_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Never throws. One health.failure ops_event per throttle window per process; messages never logged (OBS-7). */
export function create_health_check(db: HealthDb, service: string, opts: HealthOptions): (request_id_in?: string) => Promise<HealthResult> {
  const now = opts.now ?? Date.now;
  const ping_timeout_ms = opts.ping_timeout_ms ?? 3000;
  const throttle_ms = opts.throttle_ms ?? 60_000;
  let last_event_at: number | null = null;
  return async (request_id_in?: string): Promise<HealthResult> => {
    const request_id = request_id_in !== undefined && REQUEST_ID.test(request_id_in) ? request_id_in : randomUUID();
    let ok: boolean;
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<boolean>((r) => {
        timer = setTimeout(() => r(false), ping_timeout_ms);
      });
      ok = await Promise.race([db.ping(), timeout]);
    } catch {
      ok = false;
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (ok) return { status: 200, body: { status: "ok", service, build_id: opts.build_id }, request_id };
    const t = now();
    if (last_event_at === null || t - last_event_at >= throttle_ms) {
      last_event_at = t; // set before any await: concurrent failures write one event
      try {
        await record_ops_event(db as PgDatabase, { kind: "health.failure", service, build_id: opts.build_id, details: {} });
      } catch (e) {
        opts.logger.error("health.event_write_failed", { request_id, extra: { error: e instanceof Error ? e.name : "Error" } });
      }
    }
    return { status: 503, body: { status: "unavailable", service }, request_id };
  };
}

const KEY = Symbol.for("ls.web.health");

/** Lazy per-process singleton; survives Next dev reloads. Does not touch getServices(). */
export function web_health(): (request_id_in?: string) => Promise<HealthResult> {
  const g = globalThis as Record<symbol, unknown>;
  const cached = g[KEY] as ((r?: string) => Promise<HealthResult>) | undefined;
  if (cached) return cached;
  const check = build_web_health();
  g[KEY] = check;
  return check;
}

function build_web_health(): (request_id_in?: string) => Promise<HealthResult> {
  try {
    const settings = load_web_settings(process.env);
    const db = new PgDatabase(settings.shared, 1, settings.pg_acquire_timeout_ms, "web");
    const logger = create_logger({ service: "web", build_id: settings.shared.build_id, level: settings.shared.log_level });
    return create_health_check(db, "web", { build_id: settings.shared.build_id, logger });
  } catch (e) {
    const logger = create_logger({ service: "web", build_id: "unknown" });
    return async (request_id_in?: string) => {
      logger.error("health.settings_invalid", { extra: { error: e instanceof Error ? e.name : "Error" } });
      const request_id = request_id_in !== undefined && REQUEST_ID.test(request_id_in) ? request_id_in : randomUUID();
      return { status: 503, body: { status: "unavailable", service: "web" }, request_id };
    };
  }
}
