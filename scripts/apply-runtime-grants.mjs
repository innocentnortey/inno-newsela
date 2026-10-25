// NL-23: create/refresh the non-owner runtime role and strip write-once tables of UPDATE/DELETE/TRUNCATE.
// Env only: DATABASE_URL (owner), RUNTIME_DATABASE_URL (runtime role). Never prints URLs or passwords.
import { pathToFileURL } from "node:url";
import pg from "pg";

export const APPEND_ONLY = ["review_event", "audit_event", "lesson_metrics", "ops_event", "prompt_version", "judge_verdict"];
export const NO_DELETE = ["lesson_version"];
export const NO_WRITE = ["schema_migrations"];

function fail(message) {
  process.stderr.write(`apply-runtime-grants: ${message}\n`);
  process.exit(1);
}

function parse_role(name) {
  const raw = process.env[name];
  if (!raw) fail(`${name} is not set`);
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`${name} is not a valid URL`);
  }
  return { role: decodeURIComponent(url.username), password: decodeURIComponent(url.password) };
}

async function main() {
  const owner = parse_role("DATABASE_URL");
  const runtime = parse_role("RUNTIME_DATABASE_URL");
  if (owner.role === runtime.role) fail("RUNTIME_DATABASE_URL must use a different role than DATABASE_URL");
  if (!/^[a-z_][a-z0-9_]*$/.test(runtime.role)) fail("RUNTIME_DATABASE_URL role name is not allowed");
  if (!runtime.password) fail("RUNTIME_DATABASE_URL has no password");

  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const run_format = async (fmt, ...args) => {
    const r = await client.query(`SELECT format(${fmt}) AS s`, args);
    await client.query(r.rows[0].s);
  };
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('ls_runtime_grants'))");
    const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [runtime.role]);
    const verb = exists.rowCount ? "ALTER" : "CREATE";
    await run_format(`'${verb} ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD %L', $1::text, $2::text`, runtime.role, runtime.password);
    await run_format("'GRANT CONNECT ON DATABASE %I TO %I', current_database(), $1::text", runtime.role);
    await run_format("'GRANT USAGE ON SCHEMA public TO %I', $1::text", runtime.role);
    await run_format("'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', $1::text", runtime.role);
    await run_format("'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', $1::text", runtime.role);
    await run_format("'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', $1::text", runtime.role);
    for (const t of APPEND_ONLY) await run_format("'REVOKE UPDATE, DELETE ON %I FROM %I', $2::text, $1::text", runtime.role, t);
    for (const t of NO_DELETE) await run_format("'REVOKE DELETE ON %I FROM %I', $2::text, $1::text", runtime.role, t);
    for (const t of NO_WRITE) await run_format("'REVOKE INSERT, UPDATE, DELETE ON %I FROM %I', $2::text, $1::text", runtime.role, t);
    await client.query("COMMIT");
    process.stdout.write(`${JSON.stringify({ event: "runtime_grants", role: runtime.role })}\n`);
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    fail(`failed (${e?.code ?? e?.name ?? "error"})`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
