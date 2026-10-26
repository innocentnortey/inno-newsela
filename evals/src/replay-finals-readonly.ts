// Read-only database access for the offline replay (F4-3). The replay must not be able to write whatever the URL says:
// the URL gets `-c default_transaction_read_only=on` appended, every transaction starts with SET TRANSACTION READ ONLY, and
// a write probe must be refused (SQLSTATE 25006) before any replay query runs. Credentials are never printed.
import { read_secret_url } from "@ls/config/env";
import { PgDatabase } from "@ls/db/pool";
import type { Tx, TxFunction } from "@ls/db/tx";

export type SetupCode = "database_url_missing" | "database_url_invalid" | "connect_failed" | "read_only_not_enforced";
export class ReplaySetupError extends Error {
  constructor(readonly code: SetupCode, message: string) {
    super(message);
    this.name = "ReplaySetupError";
  }
}

const OPT = "-c default_transaction_read_only=on";

/** Appends the read-only option last (libpq applies options left to right, so it wins over an earlier `off`). */
export function read_only_database_url(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ReplaySetupError("database_url_invalid", "DATABASE_URL is not a valid URL");
  }
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") throw new ReplaySetupError("database_url_invalid", "DATABASE_URL is not a postgres URL");
  u.searchParams.delete("default_transaction_read_only");
  const existing = (u.searchParams.get("options") ?? "").trim();
  const rest = new URLSearchParams(u.searchParams);
  rest.delete("options");
  const opts = encodeURIComponent(existing === "" ? OPT : `${existing} ${OPT}`);
  u.search = `?${[rest.toString(), `options=${opts}`].filter((x) => x !== "").join("&")}`;
  return u.toString();
}

/** Replaces the whole URL, its password and its user name with "<redacted>". */
export function redact(text: string, raw_url: string): string {
  let out = text;
  const secrets = new Set<string>([raw_url]);
  try {
    const u = new URL(raw_url);
    secrets.add(u.toString());
    for (const s of [u.password, decodeURIComponent(u.password), u.username, decodeURIComponent(u.username)]) if (s.length > 0) secrets.add(s);
    try { secrets.add(read_only_database_url(raw_url)); } catch { /* not a postgres url */ }
  } catch { /* not parseable: only the raw text is scrubbed */ }
  for (const s of [...secrets].sort((a, b) => b.length - a.length)) if (s.length > 0) out = out.split(s).join("<redacted>");
  return out;
}

/** Runs fn after SET TRANSACTION READ ONLY (legal as the first statement after BEGIN). */
export function read_only_fn<T>(fn: TxFunction<T>): TxFunction<T> {
  return async (tx: Tx) => {
    await tx.query("SET TRANSACTION READ ONLY");
    return fn(tx);
  };
}

export class ReadOnlyPgDatabase extends PgDatabase {
  override with_tx<T>(fn: TxFunction<T>, advisory_lock: string | null = null): Promise<T> {
    return super.with_tx(read_only_fn(fn), advisory_lock);
  }
}

export interface ReadOnlyEvidence {
  database: string; port: number | null; default_transaction_read_only: "on"; transaction_read_only: "on"; write_probe: "rejected_25006"; server_version: string;
}
type Txer = { with_tx<T>(fn: TxFunction<T>, advisory_lock?: string | null): Promise<T> };

export async function verify_read_only(db: Txer): Promise<ReadOnlyEvidence> {
  const st = await db.with_tx(async (tx) => {
    const d = (await tx.query<{ v: string }>("select current_setting('default_transaction_read_only') as v")).rows[0]?.v;
    const t = (await tx.query<{ v: string }>("select current_setting('transaction_read_only') as v")).rows[0]?.v;
    const i = (await tx.query<{ db: string; port: number | null; v: string }>("select current_database() as db, inet_server_port() as port, current_setting('server_version') as v")).rows[0];
    return { d, t, i };
  });
  if (st.d !== "on" || st.t !== "on" || st.i === undefined) throw new ReplaySetupError("read_only_not_enforced", `read-only not enforced (default=${String(st.d)}, transaction=${String(st.t)})`);
  let code: string | undefined;
  try {
    await db.with_tx(async (tx) => { await tx.query("create temp table replay_ro_probe (x int)"); });
  } catch (e) {
    code = (e as { code?: string }).code;
  }
  if (code !== "25006") throw new ReplaySetupError("read_only_not_enforced", `write probe was not refused with 25006 (got ${code ?? "success"})`);
  return { database: st.i.db, port: st.i.port === null ? null : Number(st.i.port), default_transaction_read_only: "on", transaction_read_only: "on", write_probe: "rejected_25006", server_version: st.i.v };
}

type Closable = Txer & { close(): Promise<void> };

/** Reads ONLY env.DATABASE_URL. Any failure is final: no other URL (TEST_DATABASE_URL, an evidence database) is tried. */
export async function connect_read_only(
  env: Record<string, string | undefined>,
  factory?: (url: string) => Closable,
): Promise<{ db: Closable; evidence: ReadOnlyEvidence }> {
  const raw = env["DATABASE_URL"];
  if (raw === undefined || raw.trim() === "") throw new ReplaySetupError("database_url_missing", "DATABASE_URL is not set");
  const url = read_only_database_url(raw);
  const make = factory ?? ((u: string): Closable => {
    const secret = read_secret_url({ DATABASE_URL: u }, "DATABASE_URL", ["postgres:", "postgresql:"]);
    return new ReadOnlyPgDatabase({ database_url: secret, pg_pool_max: 2, build_id: "replay", log_level: "info" } as never, 2, 5000);
  });
  let db: Closable | undefined;
  try {
    db = make(url);
    return { db, evidence: await verify_read_only(db) };
  } catch (e) {
    if (db !== undefined) await db.close().catch(() => undefined);
    if (e instanceof ReplaySetupError) throw new ReplaySetupError(e.code, redact(e.message, raw));
    throw new ReplaySetupError("connect_failed", redact(`could not connect or verify: ${e instanceof Error ? e.message : String(e)}`, raw));
  }
}

const TABLES = ["run", "lesson_job", "model_call", "eval_run", "issue", "lesson_version", "safety_flag", "intake_choice", "outline_version"] as const;
export async function row_counts(db: Txer): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of TABLES) {
    try {
      out[t] = Number((await db.with_tx(async (tx) => (await tx.query<{ n: number }>(`select count(*)::int as n from ${t}`)).rows[0]?.n)) ?? 0);
    } catch {
      throw new ReplaySetupError("connect_failed", `row count failed for table ${t}`);
    }
  }
  return out;
}

export function same_counts(a: Record<string, number>, b: Record<string, number>): { same: boolean; differing: string[] } {
  const differing = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]).sort();
  return { same: differing.length === 0, differing };
}
