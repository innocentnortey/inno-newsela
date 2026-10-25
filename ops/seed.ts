// `npm run db:seed` (WF-37): load the CDE standards, prompt version 1 and one synthetic demo account per role.
// Idempotent (ON CONFLICT DO NOTHING everywhere); writes one `seed` ops_event. Demo passwords come from
// SEED_DEMO_PASSWORD or are generated into the git-ignored .demo/ folder; they are never logged or stored in clear.
import { randomInt } from "node:crypto";
import { chmodSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { hash_password } from "@ls/core/auth/passwords";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { SystemClock } from "@ls/core/ports/clock";
import {
  DEFAULT_STANDARDS_DIR,
  load_standard_rows,
  type StandardRow,
  type StandardSet,
} from "@ls/core/intake/standards-index";
import { read_int, read_optional_string, read_secret_url, type Env } from "@ls/config/env";
import { git_short_sha, resolve_build_id } from "@ls/obs/build-id";
import { PgDatabase } from "@ls/db/pool";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { PgPromptRepo } from "@ls/db/repos/prompts";
import { LOCKED_DIR, locked_hash } from "@ls/prompts/locked";

export interface SeedReport {
  standards: number;
  users: number;
  ops_event_id: string;
}
export interface SeedOptions {
  env?: Env;
  standards_dir?: string;
  credentials_path?: string;
  build_id?: string;
}
export class SeedInputError extends Error {
  constructor(
    readonly file: string,
    message: string,
  ) {
    super(message);
    this.name = "SeedInputError";
  }
}

const DEMO_ACCOUNTS = [
  { role: "author", email: "author.demo@example.test", name: "Demo author" },
  { role: "reviewer", email: "reviewer.demo@example.test", name: "Demo reviewer" },
  { role: "approver", email: "approver.demo@example.test", name: "Demo approver" },
] as const;
const SET_FILE: Record<StandardSet, string> = {
  CA_CCSS_ELA_6: "ccss-ela-6.json",
  CA_ELD_6: "eld-6.json",
  MSLS_6: "msls-6.json",
};
const SETS = Object.keys(SET_FILE) as StandardSet[];
const DEFAULT_CREDENTIALS_PATH = fileURLToPath(new URL("../.demo/seed-credentials.txt", import.meta.url));
const PW_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_!";

function generate_password(): string {
  let out = "";
  for (let i = 0; i < 20; i++) out += PW_CHARS[randomInt(PW_CHARS.length)];
  return out;
}

function validate_standards(dir: string): StandardRow[] {
  let rows: StandardRow[];
  try {
    rows = load_standard_rows(dir);
  } catch (e) {
    const fs_path = (e as { path?: unknown } | null)?.path;
    if (typeof fs_path === "string") {
      const file = basename(fs_path);
      throw new SeedInputError(file, `${file}: ${String((e as { code?: unknown }).code ?? "unreadable")}`);
    }
    const message = e instanceof Error ? e.message : "standards could not be loaded";
    const prefix = message.split(":")[0] ?? "";
    throw new SeedInputError(prefix.trim() !== "" && prefix.length < 120 ? prefix.trim() : "standards", message);
  }
  for (const row of rows) {
    if (typeof row.text !== "string" || row.text.trim() === "") {
      throw new SeedInputError(SET_FILE[row.set], `${row.code} has no text`);
    }
  }
  return rows;
}

export async function seed_reference_data(db: PgDatabase, opts: SeedOptions = {}): Promise<SeedReport> {
  const env = opts.env ?? process.env;
  const rows = validate_standards(opts.standards_dir ?? DEFAULT_STANDARDS_DIR);
  const build_id = opts.build_id ?? resolve_build_id(env, git_short_sha);
  const credentials_path = opts.credentials_path ?? DEFAULT_CREDENTIALS_PATH;
  const ids = new PrefixedIdGenerator();
  const clock = new SystemClock();

  // Which demo accounts still need creating (a rerun never touches an existing row).
  const existing = await db.with_tx(
    async (tx) => (await tx.query(`SELECT lower(email) AS email FROM app_user`)).rows.map((r) => String(r["email"])),
  );
  const missing = DEMO_ACCOUNTS.filter((a) => !existing.includes(a.email));

  const supplied = read_optional_string(env, "SEED_DEMO_PASSWORD");
  const generated = supplied === null && missing.length > 0;
  const password = supplied ?? (missing.length > 0 ? generate_password() : "");
  const hashes = new Map(missing.map((a) => [a.email, hash_password(password)]));

  // Write the credentials file BEFORE the transaction so accounts can never exist without a way to learn the password.
  let wrote_file = false;
  if (generated) {
    mkdirSync(dirname(credentials_path), { recursive: true, mode: 0o700 });
    const lines = missing.map((a) => `${a.email} ${password}`).join("\n") + "\n";
    writeFileSync(credentials_path, lines, { mode: 0o600, flag: missing.length === DEMO_ACCOUNTS.length ? "w" : "a" });
    chmodSync(credentials_path, 0o600);
    wrote_file = missing.length === DEMO_ACCOUNTS.length;
  }

  const standards_inserted: Record<string, number> = Object.fromEntries(SETS.map((s) => [s, 0]));
  let prompt_inserted = false;
  let users_inserted = 0;
  try {
    await db.with_tx(async (tx) => {
      for (const r of rows) {
        const res = await tx.query(
          `INSERT INTO standard (code, "set", text, parent_code, is_leaf, eld_strand)
           VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (code) DO NOTHING`,
          [r.code, r.set, r.text, r.parent_code, r.is_leaf, r.eld_strand],
        );
        standards_inserted[r.set] = (standards_inserted[r.set] ?? 0) + res.rowCount;
      }
      const prompts = new PrefixedIdGenerator();
      const repo = new PgPromptRepo({ db, ids: prompts, clock });
      prompt_inserted = (await repo.sync_locked_layer(locked_hash(LOCKED_DIR), tx)) !== null;
      for (const a of missing) {
        const res = await tx.query(
          `INSERT INTO app_user (id, email, name, role, synthetic, password_hash)
           VALUES ($1,$2,$3,$4,true,$5) ON CONFLICT (lower(email)) DO NOTHING`,
          [ids.new_id("usr"), a.email, a.name, a.role, hashes.get(a.email)],
        );
        users_inserted += res.rowCount;
      }
    });
  } catch (e) {
    if (wrote_file) rmSync(credentials_path, { force: true });
    throw e;
  }

  const standards_total = await db.with_tx(async (tx) => {
    const out: Record<string, number> = Object.fromEntries(SETS.map((s) => [s, 0]));
    for (const r of (await tx.query(`SELECT "set", count(*)::int AS n FROM standard GROUP BY "set"`)).rows) {
      out[String(r["set"])] = Number(r["n"]);
    }
    return out;
  });
  const users_total = await db.with_tx(async (tx) =>
    Number((await tx.query(`SELECT count(*)::int AS n FROM app_user`)).rows[0]?.["n"]),
  );
  const ops_event_id = await new PgEvidenceRepo({ db, ids, clock }).ops_event({
    kind: "seed",
    service: "seed",
    build_id,
    details: { standards_inserted, standards_total, prompt_version_inserted: prompt_inserted, users_inserted, users_total },
  });
  return {
    standards: Object.values(standards_inserted).reduce((a, b) => a + b, 0),
    users: users_inserted,
    ops_event_id,
  };
}

export async function main(env: Env = process.env): Promise<SeedReport> {
  // Demo accounts must never appear in a production database by accident (wave-4 security review).
  if (env["NODE_ENV"] === "production" && env["SEED_ALLOW_DEMO_ACCOUNTS"] !== "1") {
    throw new SeedInputError("NODE_ENV", "refusing to create demo accounts when NODE_ENV=production; set SEED_ALLOW_DEMO_ACCOUNTS=1 to override");
  }
  const build_id = resolve_build_id(env, git_short_sha);
  const settings = {
    database_url: read_secret_url(env, "DATABASE_URL", ["postgres:", "postgresql:"]),
    pg_pool_max: 1,
    build_id,
    log_level: "info" as const,
  };
  const acquire_timeout_ms = read_int(env, "PG_ACQUIRE_TIMEOUT_MS", { default: 2000, min: 1 });
  const db = new PgDatabase(settings, 1, acquire_timeout_ms);
  try {
    return await seed_reference_data(db, { env, build_id });
  } finally {
    await db.close();
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(
    (report) => {
      console.log(JSON.stringify({ event: "seed", ...report }));
      if (read_optional_string(process.env, "SEED_DEMO_PASSWORD") === null && report.users > 0) {
        console.log("credentials written to .demo/seed-credentials.txt");
      }
      process.exit(0);
    },
    (err: unknown) => {
      const e =
        err instanceof SeedInputError
          ? { problem: err.message, file: err.file }
          : { problem: err instanceof Error ? err.message : "unknown error" };
      console.error(JSON.stringify({ event: "seed_failed", ...e }));
      process.exit(1);
    },
  );
}
