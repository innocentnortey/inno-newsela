// Queue/version compatibility inventory for a worker replacement (runbook: docs/delivery/2026-10-26-locked-prompt-worker-replacement-runbook.md).
//   npx tsx ops/queue-compat.ts [--artifact-hash <64 hex>] [--json] [--include-failed] [--fail-on-old]
// Lists the generation jobs that are still queued or running, grouped by the locked hash of the prompt version their run pinned,
// against the locked layer of an artifact (this checkout's packages/prompts/locked by default). It only reads: the connection is
// put in a read-only transaction first. It never repins, cancels or requeues anything. DATABASE_URL comes from the environment
// only; neither it nor an error message is ever printed.
import { pathToFileURL } from "node:url";
import { read_secret_url } from "@ls/config/env";
import { PgDatabase } from "@ls/db/pool";
import { git_short_sha, resolve_build_id } from "@ls/obs/build-id";
import { LOCKED_DIR, locked_hash } from "@ls/prompts/locked";

export type Compat = "match" | "old_pin" | "pin_missing";

export interface PinnedJob {
  job_id: string; run_id: string; kind: string; status: "queued" | "running"; run_state: string; lesson_id: string | null;
  queued_at: string; lease_until: string | null; prompt_version_id: string; prompt_number: number | null;
  pinned_locked_hash: string | null; claimable_now: boolean; compat: Compat;
}
export interface Group {
  locked_hash: string | null; compat: Compat; prompt_version_ids: string[]; queued: number; running: number;
  queued_in_unclaimable_runs: number; oldest_queued_at: string | null; run_ids: string[];
}
export interface Inventory {
  generated_at: string; artifact_locked_hash: string;
  latest_prompt_version: { id: string; number: number; locked_hash: string } | null;
  jobs: PinnedJob[]; groups: Group[];
  retryable_failed: Array<{ job_id: string; run_id: string; lesson_id: string | null; pinned_locked_hash: string | null; compat: Compat }>;
  totals: { match: number; old_pin: number; pin_missing: number };
}

/** The pin is run.prompt_version_id -> prompt_version.locked_hash (claim SQL returns r.prompt_version_id; the renderer compares hashes). */
export const INVENTORY_SQL = `SELECT j.id AS job_id, j.run_id, j.kind, j.status, j.lesson_id, j.queued_at, j.lease_until,
       r.state AS run_state, r.prompt_version_id, p.number AS prompt_number, p.locked_hash AS pinned_locked_hash
  FROM lesson_job j
  JOIN run r ON r.id = j.run_id
  LEFT JOIN prompt_version p ON p.id = r.prompt_version_id
 WHERE j.status IN ('queued', 'running')
 ORDER BY r.prompt_version_id, j.queued_at, j.id`;

const FAILED_SQL = `SELECT j.id AS job_id, j.run_id, j.lesson_id, p.locked_hash AS pinned_locked_hash
  FROM lesson_job j JOIN run r ON r.id = j.run_id LEFT JOIN prompt_version p ON p.id = r.prompt_version_id
 WHERE j.status = 'generation_failed' AND r.state = 'partial'
 ORDER BY r.prompt_version_id, j.queued_at, j.id`;

/** The claim SQL only reads runs in these states; a queued job of any other run is latent until a resume or retry makes it live. */
const CLAIMABLE_RUN_STATES = new Set(["planning", "running"]);

export function classify(pinned_locked_hash: string | null, artifact_hash: string): Compat {
  if (pinned_locked_hash === null) return "pin_missing";
  return pinned_locked_hash === artifact_hash ? "match" : "old_pin";
}

export function group_jobs(jobs: readonly PinnedJob[]): Group[] {
  const by = new Map<string, Group>();
  for (const j of jobs) {
    const key = `${j.compat}|${j.pinned_locked_hash ?? ""}`;
    let g = by.get(key);
    if (g === undefined) {
      g = { locked_hash: j.pinned_locked_hash, compat: j.compat, prompt_version_ids: [], queued: 0, running: 0, queued_in_unclaimable_runs: 0, oldest_queued_at: null, run_ids: [] };
      by.set(key, g);
    }
    if (!g.prompt_version_ids.includes(j.prompt_version_id)) g.prompt_version_ids.push(j.prompt_version_id);
    if (!g.run_ids.includes(j.run_id)) g.run_ids.push(j.run_id);
    if (j.status === "queued") {
      g.queued += 1;
      if (!j.claimable_now) g.queued_in_unclaimable_runs += 1;
      if (g.oldest_queued_at === null || j.queued_at < g.oldest_queued_at) g.oldest_queued_at = j.queued_at;
    } else {
      g.running += 1;
    }
  }
  const order: Record<Compat, number> = { old_pin: 0, pin_missing: 1, match: 2 };
  return [...by.values()].sort((a, b) => order[a.compat] - order[b.compat] || (a.locked_hash ?? "").localeCompare(b.locked_hash ?? ""));
}

export function exit_code(inv: Pick<Inventory, "totals">, fail_on_old: boolean): number {
  return fail_on_old && inv.totals.old_pin + inv.totals.pin_missing > 0 ? 3 : 0;
}

type Row = Record<string, unknown>;
const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v));

export async function read_inventory(
  db: Pick<PgDatabase, "with_tx">, artifact_hash: string, opts: { now: Date; include_failed: boolean },
): Promise<Inventory> {
  return db.with_tx(async (tx) => {
    // First statement: the session cannot write whatever the URL's role allows.
    await tx.query("SET TRANSACTION READ ONLY");
    const rows = (await tx.query<Row>(INVENTORY_SQL)).rows;
    const latest = (await tx.query<Row>("SELECT id, number, locked_hash FROM prompt_version ORDER BY number DESC LIMIT 1")).rows[0];
    const failed = opts.include_failed ? (await tx.query<Row>(FAILED_SQL)).rows : [];
    const jobs: PinnedJob[] = rows.map((r) => {
      const hash = (r["pinned_locked_hash"] as string | null) ?? null;
      return {
        job_id: String(r["job_id"]), run_id: String(r["run_id"]), kind: String(r["kind"]), status: r["status"] as "queued" | "running",
        run_state: String(r["run_state"]), lesson_id: (r["lesson_id"] as string | null) ?? null, queued_at: iso(r["queued_at"]),
        lease_until: r["lease_until"] === null || r["lease_until"] === undefined ? null : iso(r["lease_until"]),
        prompt_version_id: String(r["prompt_version_id"]), prompt_number: r["prompt_number"] === null || r["prompt_number"] === undefined ? null : Number(r["prompt_number"]),
        pinned_locked_hash: hash, claimable_now: CLAIMABLE_RUN_STATES.has(String(r["run_state"])), compat: classify(hash, artifact_hash),
      };
    });
    const totals = { match: 0, old_pin: 0, pin_missing: 0 };
    for (const j of jobs) totals[j.compat] += 1;
    return {
      generated_at: opts.now.toISOString(), artifact_locked_hash: artifact_hash,
      latest_prompt_version: latest === undefined ? null : { id: String(latest["id"]), number: Number(latest["number"]), locked_hash: String(latest["locked_hash"]) },
      jobs, groups: group_jobs(jobs),
      retryable_failed: failed.map((r) => {
        const hash = (r["pinned_locked_hash"] as string | null) ?? null;
        return { job_id: String(r["job_id"]), run_id: String(r["run_id"]), lesson_id: (r["lesson_id"] as string | null) ?? null, pinned_locked_hash: hash, compat: classify(hash, artifact_hash) };
      }),
      totals,
    };
  });
}

const short = (h: string | null): string => (h === null ? "(no prompt_version row)" : h.slice(0, 12));

export function render_text(inv: Inventory): string {
  const out: string[] = [];
  out.push(`queue-compat ${inv.generated_at}`);
  out.push(`artifact locked hash: ${short(inv.artifact_locked_hash)}`);
  out.push(inv.latest_prompt_version === null ? "latest prompt version: none" : `latest prompt version: #${inv.latest_prompt_version.number} (${short(inv.latest_prompt_version.locked_hash)})`);
  out.push(`queued + running jobs: match ${inv.totals.match}, old_pin ${inv.totals.old_pin}, pin_missing ${inv.totals.pin_missing}`);
  if (inv.groups.length === 0) out.push("no queued or running generation jobs");
  for (const g of inv.groups) {
    out.push("");
    out.push(`[${g.compat}] locked ${short(g.locked_hash)}  prompt versions ${g.prompt_version_ids.join(", ")}`);
    out.push(`  queued ${g.queued} (latent, in paused/capped runs: ${g.queued_in_unclaimable_runs}), running ${g.running}, oldest queued ${g.oldest_queued_at ?? "-"}`);
    out.push(`  runs ${g.run_ids.join(", ")}`);
    if (g.compat !== "match") out.push("  old artifact must keep running until this group is 0, or use a supported transition (runbook section 5)");
  }
  if (inv.retryable_failed.length > 0) {
    out.push("");
    out.push(`failed jobs a retry_failed would requeue on their old pin: ${inv.retryable_failed.length}`);
    for (const f of inv.retryable_failed) out.push(`  ${f.job_id} run ${f.run_id} lesson ${f.lesson_id ?? "-"} [${f.compat}] locked ${short(f.pinned_locked_hash)}`);
  }
  return out.join("\n") + "\n";
}

interface Io { out: (s: string) => void; err: (s: string) => void }
const USAGE = "usage: queue-compat [--artifact-hash <64 hex>] [--json] [--include-failed] [--fail-on-old]\n";

export async function main(
  argv: string[], env: NodeJS.ProcessEnv = process.env,
  io: Io = { out: (s) => void process.stdout.write(s), err: (s) => void process.stderr.write(s) },
): Promise<number> {
  let artifact: string | null = null;
  let json = false, include_failed = false, fail_on_old = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--json") json = true;
    else if (a === "--include-failed") include_failed = true;
    else if (a === "--fail-on-old") fail_on_old = true;
    else if (a === "--artifact-hash") {
      artifact = argv[++i] ?? "";
      if (!/^[0-9a-f]{64}$/.test(artifact)) { io.err(USAGE); return 2; }
    } else { io.err(USAGE); return 2; }
  }
  try {
    const build_id = env["BUILD_ID"] ? env["BUILD_ID"] : resolve_build_id(env, git_short_sha);
    const settings = { database_url: read_secret_url(env, "DATABASE_URL", ["postgres:", "postgresql:"]), pg_pool_max: 1, build_id, log_level: "info" as const };
    const db = new PgDatabase(settings, 1, 2000);
    try {
      const inv = await read_inventory(db, artifact ?? locked_hash(LOCKED_DIR), { now: new Date(), include_failed });
      io.out(json ? JSON.stringify(inv, null, 2) + "\n" : render_text(inv));
      return exit_code(inv, fail_on_old);
    } finally {
      await db.close().catch(() => undefined);
    }
  } catch (e) {
    io.err(`queue-compat failed: ${e instanceof Error ? e.name : "Error"}\n`);
    return 1;
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((c) => process.exit(c));
}
