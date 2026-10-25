// NL-83 AC-5..AC-7 (risk::security, frozen): ops/backup.sh (WF-40). Container mode against the already-running
// test Postgres (scripts/test-db.sh up); no image builds. Dumps created here are removed in afterAll.
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "../packages/db/src/testing/test-db.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTAINER = "newsela-test-postgres-1";
const PASSWORD = "ls_dev_only"; // the test cluster's password (docker-compose.test.yml); synthetic
let t: TestDb;
let shim_dir: string;
let shim_log: string;
const made: string[] = [];

const backups = () => (existsSync(path.join(root, "backups")) ? readdirSync(path.join(root, "backups")).sort() : []);
const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");

function script_env(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  return { PATH: `${shim_dir}:${process.env["PATH"]}`, HOME: process.env["HOME"] ?? "", BACKUP_DOCKER_CONTAINER: CONTAINER, DATABASE_URL: t.url, BUILD_ID: "nl83-test", ...extra };
}
function parse_ok(stdout: string) {
  const m = /^backup ok (backups\/\S+) (\d+) ([0-9a-f]{64})$/m.exec(stdout);
  if (!m) throw new Error(`no 'backup ok' line in: ${stdout}`);
  made.push(path.join(root, m[1]!));
  return { rel: m[1]!, size: Number(m[2]), sha: m[3]! };
}
async function backup_events() {
  const c = new pg.Client({ connectionString: t.url });
  await c.connect();
  try {
    return (await c.query("select service, build_id, details_json from ops_event where kind='backup'")).rows;
  } finally { await c.end(); }
}

beforeAll(async () => {
  t = await create_test_db();
  shim_dir = mkdtempSync(path.join(os.tmpdir(), "nl83-shim-"));
  shim_log = path.join(shim_dir, "docker-args.log");
  const real = spawnSync("bash", ["-c", "command -v docker"], { encoding: "utf8" }).stdout.trim();
  writeFileSync(path.join(shim_dir, "docker"), `#!/usr/bin/env bash\nprintf '%s\\n' "$*" >> '${shim_log}'\nexec '${real}' "$@"\n`);
  chmodSync(path.join(shim_dir, "docker"), 0o755);
}, 60_000);
afterAll(async () => {
  for (const f of made) rmSync(f, { force: true });
  rmSync(shim_dir, { recursive: true, force: true });
  await t?.drop();
});

describe("NL-83 backup script (WF-40)", () => {
  it("test_backup_logs_event [invariant AC-5]", async () => {
    const r = spawnSync("bash", ["ops/backup.sh"], { cwd: root, env: script_env(), encoding: "utf8", timeout: 120_000 });
    expect(r.status, r.stdout + r.stderr).toBe(0);
    const ok = parse_ok(r.stdout);
    const file = path.join(root, ok.rel);
    expect(statSync(file).mode & 0o777).toBe(0o600);
    expect(statSync(file).size).toBe(ok.size);
    expect(ok.size).toBeGreaterThan(0);
    // the dump is a readable custom-format archive
    const list = spawnSync("docker", ["exec", "-i", CONTAINER, "pg_restore", "--list"], { input: readFileSync(file), encoding: "utf8" });
    expect(list.status).toBe(0);
    expect(list.stdout).toContain("ops_event");
    // exactly one backup event with relative path, size, and the file's SHA-256
    const ev = await backup_events();
    expect(ev).toHaveLength(1);
    expect(ev[0].build_id).toBeTruthy();
    expect(ev[0].details_json).toEqual({ path: ok.rel, size: ok.size, sha256: sha(file) });
    expect(ok.sha).toBe(sha(file));
  }, 180_000);

  it("password_not_in_argv_and_path_ignored [negative AC-6]", async () => {
    // static: the script never exposes the password on a command line
    const src = readFileSync(path.join(root, "ops/backup.sh"), "utf8");
    expect(src).not.toMatch(/PGPASSWORD=\S/);
    expect(src).not.toMatch(/^\s*set\s+-\S*x/m);
    // dynamic: sample every descendant's argv while it runs
    const child = spawn("bash", ["ops/backup.sh"], { cwd: root, env: script_env(), stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const seen: string[] = [];
    let done = false;
    const exited = new Promise<number | null>((res) => child.on("close", (c) => { done = true; res(c); }));
    while (!done) {
      const ps = spawnSync("ps", ["-eo", "pid=,ppid=,args="], { encoding: "utf8" }).stdout.split("\n");
      const kids = new Map<number, { ppid: number; args: string }>();
      for (const l of ps) {
        const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l);
        if (m) kids.set(Number(m[1]), { ppid: Number(m[2]), args: m[3]! });
      }
      const mine = new Set<number>([child.pid!]);
      for (let grew = true; grew; ) {
        grew = false;
        for (const [pid, k] of kids) if (!mine.has(pid) && mine.has(k.ppid)) { mine.add(pid); grew = true; }
      }
      for (const pid of mine) seen.push(kids.get(pid)?.args ?? "");
      await new Promise((r) => setTimeout(r, 15));
    }
    const code = await exited;
    expect(code, out).toBe(0);
    if (/backup ok (backups\/\S+)/.test(out)) made.push(path.join(root, /backup ok (backups\/\S+)/.exec(out)![1]!));
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.join("\n")).not.toContain(PASSWORD);
    expect(readFileSync(shim_log, "utf8")).not.toContain(PASSWORD);
    // path: fixed git-ignored backups/, nowhere served
    expect(out).toMatch(/backup ok backups\//);
    expect(out).not.toMatch(/public|\.next/);
    expect(spawnSync("git", ["check-ignore", "backups/"], { cwd: root }).status).toBe(0);
  }, 180_000);

  it("refuses_without_database_url [failure AC-7]", () => {
    expect(existsSync(path.join(root, "ops/backup.sh"))).toBe(true);
    const before = backups();
    const env = script_env();
    delete env["DATABASE_URL"];
    const r = spawnSync("bash", ["ops/backup.sh"], { cwd: root, env, encoding: "utf8", timeout: 30_000 });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("DATABASE_URL");
    expect(backups()).toEqual(before);
  });
});
