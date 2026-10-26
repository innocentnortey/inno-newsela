// NL-118: `npm run load:spike`: drives the HTTP mix against a running web app, writes ONE probe_run row and a report.
import { mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { monitorEventLoopDelay } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { SecretStr } from "@ls/config/secret";
import type { SharedSettings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import type { EvidenceRepo } from "@ls/core/ports/evidence";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgDatabase } from "@ls/db/pool";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { default_request_log, parse_args, ProbeRefusal, type CliConfig } from "./cli.ts";
import { resolve_git_sha } from "./git-sha.ts";
import { discover, NothingToProbe, run_http_mix, sign_in, type Account, type HttpMixResult, type RequestLogLine } from "./http-mix.ts";
import { write_load_report } from "./report.ts";
import { baseline_p95, recovery_s, window_p95s } from "./stats.ts";
import type { ProbeRunRecord, SpikeOptions } from "./types.ts";

export interface SpikeDeps {
  evidence: EvidenceRepo;
  db_url: string;
  password: string;
  emails: Record<Account, string>;
  provider_mode: "stub" | "real";
  out_dir: string;
  request_log: string | null;
  git_sha: string;
  now: () => Date;
  ramp_down_s?: number;
  unit?: string | null;
  fetch?: typeof fetch;
  window_s?: number;
  allow_remote?: boolean;
  /** Filled by run_spike so callers (the CLI, tests) can read the extra figures without a second row. */
  out?: { report_path?: string; request_log?: string; mix?: HttpMixResult };
}

export const DEMO_EMAILS: Record<Account, string> = {
  author: "author.demo@example.test",
  reviewer: "reviewer.demo@example.test",
  approver: "approver.demo@example.test",
};
const LOCAL = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const M23_CLASSES = ["lesson_open", "board", "poll"] as const;

function settings_for(url: string): SharedSettings {
  return { database_url: new SecretStr(url), pg_pool_max: 1, build_id: "load", log_level: "info" };
}

export function build_deps(cfg: CliConfig, env: Record<string, string | undefined>): SpikeDeps {
  if (cfg.database_url === "") throw new ProbeRefusal("--database-url (or DATABASE_URL) is required");
  const password = env[cfg.password_env];
  if (password === undefined || password === "") throw new ProbeRefusal(`set the seed password in the environment variable ${cfg.password_env}`);
  const db = new PgDatabase(settings_for(cfg.database_url), 1, 5000);
  return {
    evidence: new PgEvidenceRepo({ db, ids: new PrefixedIdGenerator(), clock: new SystemClock() }),
    db_url: cfg.database_url,
    password,
    emails: DEMO_EMAILS,
    provider_mode: cfg.provider_mode,
    out_dir: cfg.out_dir,
    request_log: cfg.request_log,
    git_sha: resolve_git_sha(env),
    now: () => new Date(),
    ramp_down_s: cfg.ramp_down_s,
    unit: cfg.unit,
    allow_remote: cfg.allow_remote,
  };
}

async function sample_connections(db_url: string, into: { max: number }): Promise<() => Promise<void>> {
  if (db_url === "") return async () => undefined;
  const db = new PgDatabase(settings_for(db_url), 1, 5000);
  const tick = async (): Promise<void> => {
    try {
      const n = await db.with_tx(async (tx) => {
        const res = await tx.query<{ n: number }>("select count(*)::int as n from pg_stat_activity where datname = current_database()");
        return res.rows[0]?.n ?? 0;
      });
      into.max = Math.max(into.max, n);
    } catch {
      // a missed sample is not an error
    }
  };
  await tick();
  const timer = setInterval(() => void tick(), 1000);
  return async () => {
    clearInterval(timer);
    await tick();
    await db.close();
  };
}

export async function run_spike(opts: SpikeOptions, deps?: SpikeDeps): Promise<ProbeRunRecord> {
  const d = deps ?? build_deps({ ...parse_args([], process.env), users: opts.users, ramp_s: opts.ramp_s, plateau_s: opts.plateau_s, base_url: opts.base_url || "http://127.0.0.1:3000" }, process.env);
  // (1) refusals before any request
  if (d.provider_mode !== "stub") throw new ProbeRefusal("refusing: the probe runs against the stub provider only (no model spend)");
  const base_url = (opts.base_url || "http://127.0.0.1:3000").replace(/\/$/, "");
  if (!d.allow_remote && !LOCAL.has(new URL(base_url).hostname)) {
    throw new ProbeRefusal(`refusing: ${new URL(base_url).hostname} is not a local host (pass --allow-remote)`);
  }
  const f = d.fetch ?? fetch;
  const ids = new PrefixedIdGenerator();
  const probe_run_id = ids.new_id("pr");

  // (2) one sign-in per account, shared by role
  const cookies = {
    author: await sign_in(base_url, d.emails.author, d.password, f),
    reviewer: await sign_in(base_url, d.emails.reviewer, d.password, f),
    approver: await sign_in(base_url, d.emails.approver, d.password, f),
  };
  // (3) discover before the clock starts
  const discovery = await discover(base_url, cookies.reviewer, d.unit ?? null, f);

  // (4) samplers
  const lag = monitorEventLoopDelay({ resolution: 10 });
  lag.enable();
  const conns = { max: 0 };
  const stop_conns = await sample_connections(d.db_url, conns);

  // (5) the schedule
  const log: RequestLogLine[] = [];
  const ramp_down_s = d.ramp_down_s ?? 120;
  let mix: HttpMixResult;
  try {
    mix = await run_http_mix(opts, {
      base_url, cookies, discovery, run_id: probe_run_id, ramp_down_s, fetch: f, log: (l) => log.push(l),
    });
  } finally {
    lag.disable();
    await stop_conns();
  }

  // (6) stats: recovery per M-23 class against its own ramp baseline; the slowest class decides
  const notes = [...mix.notes];
  const window_s = d.window_s ?? 5;
  const first_s = Math.max(opts.ramp_s * 0.25, window_s);
  const plateau_end_s = opts.ramp_s + opts.plateau_s;
  const per_class: number[] = [];
  let never = false;
  for (const c of M23_CLASSES) {
    const samples = mix.samples[c] ?? [];
    const base = baseline_p95(samples, first_s);
    if (base === null) continue;
    const r = recovery_s(window_p95s(samples, window_s), base, plateau_end_s);
    if (r === null) never = true;
    else per_class.push(r);
  }
  const recovery = never || per_class.length === 0 ? null : Math.max(...per_class);
  if (per_class.length === 0 && !never) notes.push("recovery not computed: fewer than 5 samples in the ramp baseline");

  const cores = os.cpus().length;
  const record: ProbeRunRecord = {
    probe_run_id,
    kind: "http",
    users: opts.users,
    duration_s: Math.max(1, Math.round(mix.elapsed_ms / 1000)),
    machine: `${cores} cores, ${Math.round(os.totalmem() / 1024 ** 3)} GB RAM, ${os.platform()}`,
    provider_mode: d.provider_mode,
    p95_ms: {
      lesson_open: mix.p95_ms["lesson_open"] ?? null,
      board: mix.p95_ms["board"] ?? null,
      poll: mix.p95_ms["poll"] ?? null,
      heartbeat: mix.p95_ms["heartbeat"] ?? null,
      page: mix.p95_ms["page"] ?? null,
      recovery_s: recovery,
    },
    error_rate: mix.failed / Math.max(1, mix.n + 3),
    lost_updates: 0,
    event_loop_lag_p95_ms: lag.percentile(95) / 1e6,
    max_db_connections: conns.max,
    n: mix.n,
  };
  // (7) the one row
  await d.evidence.insert_probe_run(record);

  // (8) request log and report
  const log_path = d.request_log ?? default_request_log(probe_run_id);
  mkdirSync(path.dirname(log_path), { recursive: true });
  writeFileSync(log_path, log.map((l) => JSON.stringify(l)).join("\n") + "\n");
  const report_path = write_load_report(d.out_dir, {
    record, git_sha: d.git_sha, date: d.now().toISOString().slice(0, 10), notes,
    client_errors: mix.client_errors, busy_count: mix.busy_count, socket_editors_ignored: opts.socket_editors,
  });
  if (d.out) Object.assign(d.out, { report_path, request_log: log_path, mix });
  return record;
}

export async function main(argv: string[], env: Record<string, string | undefined>): Promise<number> {
  try {
    const cfg = parse_args(argv, env);
    const deps = build_deps(cfg, env);
    deps.out = {};
    const opts: SpikeOptions = {
      users: cfg.users, ramp_s: cfg.ramp_s, plateau_s: cfg.plateau_s, socket_editors: cfg.socket_editors, base_url: cfg.base_url, collab_url: "",
    };
    const record = await run_spike(opts, deps);
    process.stdout.write(`${JSON.stringify({ probe_run_id: record.probe_run_id, report_path: deps.out.report_path, request_log: deps.out.request_log })}\n`);
    return 0;
  } catch (e) {
    if (e instanceof ProbeRefusal || e instanceof NothingToProbe) {
      process.stderr.write(`${e.message}\n`);
      return 2;
    }
    process.stderr.write(`load:spike failed: ${e instanceof Error ? e.message : String(e)}\n`);
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await main(process.argv.slice(2), process.env);
  process.exit();
}
