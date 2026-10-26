// NL-118 (AC-6): the report always carries SHA, machine, stub, n and the four targets; a miss names scale path step 2.
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SCALE_PATH, write_load_report } from "./report.ts";
import type { ProbeRunRecord } from "./types.ts";

function rec(over: Partial<ProbeRunRecord> & { p95?: Record<string, number | null> } = {}): ProbeRunRecord {
  const { p95, ...rest } = over;
  return {
    probe_run_id: "pr_test", kind: "http", users: 200, duration_s: 1140, machine: "8 cores, 31 GB RAM, linux", provider_mode: "stub",
    p95_ms: { lesson_open: 400, board: 120, poll: 110, heartbeat: 50, page: 90, recovery_s: 20, ...p95 },
    error_rate: 0.001, lost_updates: 0, event_loop_lag_p95_ms: 12.3, max_db_connections: 14, n: 40321, ...rest,
  };
}
const input = (record: ProbeRunRecord) => ({ record, git_sha: "abc123def456", date: "2026-10-26", notes: [], client_errors: 0, busy_count: 0 });

describe("load report", () => {
  it("writes the always-present fields", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "load-report-"));
    const file = write_load_report(dir, input(rec()));
    expect(path.basename(file)).toBe("load-2026-10-26.md");
    const t = readFileSync(file, "utf8");
    for (const s of ["abc123def456", "8 cores, 31 GB RAM", "stub", "40321", "Lesson open p95", "Poll p95", "Error rate", "Recovery", "Server-side event-loop lag is not measured"]) {
      expect(t).toContain(s);
    }
    expect(t).not.toContain("MISSED");
  });
  it("a miss lists Scale path step 2; a null recovery is a miss", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "load-report-"));
    const slow = readFileSync(write_load_report(dir, input(rec({ p95: { lesson_open: 2000 } }))), "utf8");
    expect(slow).toContain("MISSED");
    expect(slow).toContain("Scale path step 2");
    const norec = readFileSync(write_load_report(dir, input(rec({ p95: { recovery_s: null } }))), "utf8");
    expect(norec).toContain("not recovered");
    expect(norec).toContain("MISSED");
  });
  it("step 2 text equals the capacity doc", () => {
    const doc = readFileSync(path.resolve(import.meta.dirname, "../docs/design/capacity-and-workload.md"), "utf8");
    expect(doc).toContain(`2. ${SCALE_PATH[2]}`);
    expect(doc).toContain(`1. ${SCALE_PATH[1]}`);
  });
});
