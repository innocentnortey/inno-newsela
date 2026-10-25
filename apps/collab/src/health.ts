// WF-39 collab health: GET /healthz checks Postgres (NL-83). Duplicated per app on purpose (apps do not import each other).
import type { IncomingHttpHeaders, ServerResponse } from "node:http";
import type { CollabSettings } from "@ls/config/settings";
import { randomUUID } from "node:crypto";
import { PgDatabase } from "@ls/db/pool";
import { record_ops_event } from "@ls/db/ops-event";
import type { Logger } from "@ls/obs/logger";

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

export function is_health_path(url: string | undefined, method?: string): boolean {
  const path = (url ?? "").split("?")[0];
  return path === "/healthz" && (method === undefined || method === "GET" || method === "HEAD");
}

export function open_health_db(settings: CollabSettings): PgDatabase {
  return new PgDatabase(settings.shared, 1, 2000, "collab");
}

export function create_health_handler(
  db: HealthDb,
  service: string,
  opts: HealthOptions,
): (req: { headers: IncomingHttpHeaders }, res: ServerResponse) => Promise<void> {
  const check = create_health_check(db, service, opts);
  return async (req, res) => {
    try {
      const r = await check(req.headers["x-request-id"] as string | undefined);
      res.writeHead(r.status, { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-Id": r.request_id });
      res.end(JSON.stringify(r.body));
    } catch {
      if (!res.headersSent) res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "unavailable", service }));
    }
  };
}
