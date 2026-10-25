// NL-97 (WF-17 capture): one log line per summary read, carrying run_id and a duration. route.done has neither run_id nor the run.
import type { Logger } from "@ls/obs/logger";

/** Never throws: a logging failure must not fail the read. */
export function log_summary_read(logger: () => Logger, run_id: string, status: number, duration_ms: number): void {
  try {
    logger().info("run.summary_read", { run_id, duration_ms: Math.round(duration_ms), extra: { status } });
  } catch {
    /* ignore */
  }
}
