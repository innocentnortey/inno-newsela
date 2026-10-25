// NL-23: write one process.start ops_event. Duplicated per service on purpose (no shared helper until a 4th caller).
import { PgDatabase } from "@ls/db/pool";
import { record_ops_event } from "@ls/db/ops-event";
import type { CollabSettings } from "@ls/config/settings";
import type { Logger } from "@ls/obs/logger";

export interface StartEventOptions {
  attempts?: number;
  delay_ms?: number;
  sleep?: (ms: number) => Promise<void>;
}

/** Returns true when the row was written. Never throws; a failed write is logged by error name only. */
export async function write_start_event(settings: CollabSettings, logger: Logger, opts: StartEventOptions = {}): Promise<boolean> {
  const attempts = opts.attempts ?? 10;
  const delay_ms = opts.delay_ms ?? 500;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const db = new PgDatabase(settings.shared, 1, 2000, "collab");
  let last = "Error";
  try {
    for (let i = 0; i < attempts; i++) {
      try {
        await record_ops_event(db, { kind: "process.start", service: "collab", build_id: settings.shared.build_id, details: {} });
        return true;
      } catch (e) {
        last = e instanceof Error ? e.name : "Error";
        if (i < attempts - 1) await sleep(delay_ms);
      }
    }
    logger.warn("process_start.not_recorded", { extra: { error: last } });
    return false;
  } finally {
    await db.close().catch(() => undefined);
  }
}
