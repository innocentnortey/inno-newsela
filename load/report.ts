// NL-118: the markdown report for one HTTP probe run. Pure render; one file write.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { ProbeRunRecord } from "./types.ts";

// Mirrors docs/design/capacity-and-workload.md, "Scale path" (a test compares step 2 with the doc).
export const SCALE_PATH: Record<number, string> = {
  1: "One web instance, one worker, one Hocuspocus process, Postgres (the demo; PD-15 option D, local Docker Compose).",
  2: "Trigger: p95 lesson open > 1.5 s or CPU > 70% at the spike → two web instances behind a proxy.",
};

export interface LoadReportInput {
  record: ProbeRunRecord;
  git_sha: string;
  date: string;
  notes: string[];
  client_errors: number;
  busy_count: number;
  base_url?: string;
  socket_editors_ignored?: number;
}
export interface TargetResult {
  name: string;
  target: string;
  measured: string;
  met: boolean;
  scale_path: string | null;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function ms(v: number | null): string {
  return v === null ? "not measured" : `${Math.round(v)} ms`;
}
function p95(r: ProbeRunRecord, key: string): number | null {
  const j = r.p95_ms;
  return j !== null && typeof j === "object" && !Array.isArray(j) ? num(j[key]) : null;
}

export function evaluate_targets(r: ProbeRunRecord): TargetResult[] {
  const step2 = `Scale path step 2: ${SCALE_PATH[2]}`;
  const lesson = p95(r, "lesson_open");
  const poll = p95(r, "poll");
  const rec = p95(r, "recovery_s");
  const rows: TargetResult[] = [
    { name: "Lesson open p95", target: "< 1500 ms", measured: ms(lesson), met: lesson !== null && lesson < 1500, scale_path: null },
    { name: "Poll p95 (board and progress)", target: "< 300 ms", measured: `${ms(poll)} (board ${ms(p95(r, "board"))})`, met: poll !== null && poll < 300, scale_path: null },
    { name: "Error rate", target: "< 0.5%", measured: `${(r.error_rate * 100).toFixed(2)}%`, met: r.error_rate < 0.005, scale_path: null },
    {
      name: "Recovery after the plateau", target: "<= 120 s to the pre-spike p95",
      measured: rec === null ? "not recovered" : `${Math.round(rec)} s`, met: rec !== null && rec <= 120, scale_path: null,
    },
  ];
  return rows.map((t) => (t.met ? t : { ...t, scale_path: step2 }));
}

export function render_load_report(i: LoadReportInput): string {
  const r = i.record;
  const targets = evaluate_targets(i.record);
  const lines: string[] = [
    `# HTTP load probe ${i.date}`,
    "",
    `Results are [M] measured: n = ${r.n} requests, on ${r.machine}, model provider ${r.provider_mode}.`,
    "",
    "| Field | Value |",
    "|---|---|",
    `| Git SHA | ${i.git_sha} |`,
    `| Probe run | ${r.probe_run_id} |`,
    `| Machine | ${r.machine} |`,
    `| Provider | ${r.provider_mode} |`,
    `| n (requests) | ${r.n} |`,
    `| Virtual users | ${r.users} |`,
    `| Duration | ${r.duration_s} s |`,
    `| Max DB connections | ${r.max_db_connections} |`,
    `| Load-script event-loop lag p95 | ${r.event_loop_lag_p95_ms.toFixed(1)} ms |`,
    `| Heartbeat p95 (informational, CON-20 < 200 ms) | ${ms(p95(r, "heartbeat"))} |`,
    `| Page load p95 | ${ms(p95(r, "page"))} |`,
    `| Busy (SERVICE_BUSY) responses | ${i.busy_count} |`,
    `| Client errors (4xx, excluded) | ${i.client_errors} |`,
    "",
    "## Targets",
    "",
    "| Target | Goal | Measured | Result |",
    "|---|---|---|---|",
    ...targets.map((t) => `| ${t.name} | ${t.target} | ${t.measured} | ${t.met ? "met" : "MISSED"} |`),
    "",
  ];
  const missed = targets.filter((t) => !t.met);
  if (missed.length > 0) {
    lines.push("## Missed targets and the scale path", "");
    for (const t of missed) lines.push(`- ${t.name}: ${t.scale_path}`);
    if (i.busy_count > 0 || r.error_rate >= 0.005) {
      lines.push("- Busy responses mean the database pool wait (2 s) ran out; the fix is the same: scale path step 2.");
    }
    lines.push("");
  }
  lines.push(
    "## Notes",
    "",
    "- Server-side event-loop lag is not measured by this probe.",
    "- The 3 sign-ins are shared by role (author, reviewer, approver); heartbeats from many virtual reviewers share one user id with distinct tab ids.",
    "- The only write class is the approver heartbeat, stored as synthetic data and excluded from review minutes.",
    "- Latency counts successful responses only; 5xx, SERVICE_BUSY and socket errors are errors, never slow successes.",
  );
  if ((i.socket_editors_ignored ?? 0) > 0) lines.push(`- ${i.socket_editors_ignored} socket editors requested; their Yjs figures are in the separate kind=yjs probe_run row (NL-119), not in this report.`);
  for (const n of i.notes) lines.push(`- ${n}`);
  lines.push("");
  return lines.join("\n");
}

export function write_load_report(dir: string, i: LoadReportInput): string {
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `load-${i.date}.md`);
  writeFileSync(file, render_load_report(i));
  return file;
}
