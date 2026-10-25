// NL-82 frozen tests (risk::security). Do not edit: hashed in docs/plans/frozen-tests/NL-82.manifest.json.
// Tests target the final module locations: ops/seed.ts, @ls/core/auth/passwords. Synthetic data only.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import { mkdtempSync, readFileSync, rmSync, cpSync, statSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { SeedInputError, seed_reference_data } from "./seed.ts";

const ROOT = resolve(import.meta.dirname, "..");
const STD_DIR = join(ROOT, "packages/core/data/standards");
const SET_FILES: Record<string, string> = { CA_CCSS_ELA_6: "ccss-ela-6.json", CA_ELD_6: "eld-6.json", MSLS_6: "msls-6.json" };
const PW = "QzSeed-Pass-82!";
const ROLES = ["author", "reviewer", "approver"];

const expected_counts = (): Record<string, number> =>
  Object.fromEntries(
    Object.entries(SET_FILES).map(([set, f]) => [set, (JSON.parse(readFileSync(join(STD_DIR, f), "utf8")) as { standards: unknown[] }).standards.length]),
  );

const dbs: TestDb[] = [];
async function fresh(): Promise<TestDb> {
  const t = await create_test_db();
  dbs.push(t);
  return t;
}
const tmp_dirs: string[] = [];
const tmp = (): string => {
  const d = mkdtempSync(join(tmpdir(), "nl82-"));
  tmp_dirs.push(d);
  return d;
};
afterAll(async () => {
  for (const t of dbs) await t.drop();
  for (const d of tmp_dirs) rmSync(d, { recursive: true, force: true });
});
afterEach(() => vi.restoreAllMocks());

async function n(t: TestDb, sql: string, values: unknown[] = []): Promise<number> {
  return t.db.with_tx(async (tx) => Number((await tx.query(`SELECT count(*)::int AS n FROM ${sql}`, values)).rows[0]?.["n"]));
}
async function all_text(t: TestDb): Promise<string> {
  return t.db.with_tx(async (tx) => {
    const tables = (await tx.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`)).rows;
    const out: string[] = [];
    for (const r of tables) out.push((await tx.query(`SELECT t::text AS x FROM "${String(r["table_name"])}" t`)).rows.map((x) => String(x["x"])).join("\n"));
    return out.join("\n");
  });
}
function capture(): { text: () => string } {
  const buf: string[] = [];
  const push = (...a: unknown[]): void => void buf.push(a.map(String).join(" "));
  vi.spyOn(console, "log").mockImplementation(push);
  vi.spyOn(console, "error").mockImplementation(push);
  vi.spyOn(console, "warn").mockImplementation(push);
  vi.spyOn(console, "info").mockImplementation(push);
  vi.spyOn(process.stdout, "write").mockImplementation(((c: unknown) => (buf.push(String(c)), true)) as never);
  vi.spyOn(process.stderr, "write").mockImplementation(((c: unknown) => (buf.push(String(c)), true)) as never);
  return { text: () => buf.join("\n") };
}
const opts = (extra: Record<string, unknown> = {}) => ({
  env: { SEED_DEMO_PASSWORD: PW } as Record<string, string | undefined>,
  credentials_path: join(tmp(), "creds.txt"),
  build_id: "test",
  ...extra,
});

describe("seed_reference_data", () => {
  it("test_seed_counts [invariant] standards per set, prompt v1 once, one account per role, one seed ops_event", async () => {
    const t = await fresh();
    const report = await seed_reference_data(t.db, opts());
    const exp = expected_counts();
    for (const [set, count] of Object.entries(exp)) expect(await n(t, `standard WHERE "set"=$1`, [set])).toBe(count);
    expect(report.standards).toBe(Object.values(exp).reduce((a, b) => a + b, 0));
    expect(report.users).toBe(3);
    expect(await n(t, "prompt_version WHERE number=1")).toBe(1);
    expect(await n(t, "app_user")).toBe(3);
    const roles = await t.db.with_tx(async (tx) => (await tx.query(`SELECT role, synthetic FROM app_user ORDER BY role`)).rows);
    expect(roles.map((r) => r["role"])).toEqual([...ROLES].sort());
    expect(roles.every((r) => r["synthetic"] === true)).toBe(true);
    expect(await n(t, `ops_event WHERE kind='seed'`)).toBe(1);
    const ev = await t.db.with_tx(async (tx) => (await tx.query(`SELECT id, details_json FROM ops_event WHERE kind='seed'`)).rows[0]);
    expect(ev?.["id"]).toBe(report.ops_event_id);
    expect(JSON.stringify(ev?.["details_json"])).toContain("CA_ELD_6");
  });

  it("seed_is_idempotent [invariant] second run leaves counts and reports 0 new rows", async () => {
    const t = await fresh();
    await seed_reference_data(t.db, opts());
    const before = [await n(t, "standard"), await n(t, "app_user"), await n(t, "prompt_version")];
    const hashes = await t.db.with_tx(async (tx) => (await tx.query(`SELECT email, password_hash FROM app_user ORDER BY email`)).rows);
    const second = await seed_reference_data(t.db, opts({ env: { SEED_DEMO_PASSWORD: "Another-Pass-82!" } }));
    expect([await n(t, "standard"), await n(t, "app_user"), await n(t, "prompt_version")]).toEqual(before);
    expect(second.standards).toBe(0);
    expect(second.users).toBe(0);
    expect(await t.db.with_tx(async (tx) => (await tx.query(`SELECT email, password_hash FROM app_user ORDER BY email`)).rows)).toEqual(hashes);
    expect(await n(t, `ops_event WHERE kind='seed'`)).toBe(2);
    const d = await t.db.with_tx(async (tx) => (await tx.query(`SELECT details_json FROM ops_event WHERE id=$1`, [second.ops_event_id])).rows[0]?.["details_json"]);
    expect(d.users_inserted).toBe(0);
    expect(d.prompt_version_inserted).toBe(false);
    expect(Object.values(d.standards_inserted as Record<string, number>).every((v) => v === 0)).toBe(true);
  });

  it("password_never_stored_or_logged [negative] plaintext appears in no table, event, output or tracked file; hash is scrypt", async () => {
    const t = await fresh();
    const cap = capture();
    await seed_reference_data(t.db, opts());
    expect(cap.text()).not.toContain(PW);
    vi.restoreAllMocks();
    expect(await all_text(t)).not.toContain(PW);
    const hashes = await t.db.with_tx(async (tx) => (await tx.query(`SELECT password_hash FROM app_user`)).rows);
    expect(hashes).toHaveLength(3);
    for (const h of hashes) expect(String(h["password_hash"])).toMatch(/^scrypt\$/);
    const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: ROOT, encoding: "utf8" })
      .split("\0")
      .filter((f) => f !== "" && !f.endsWith(".test.ts") && existsSync(join(ROOT, f)) && statSync(join(ROOT, f)).isFile());
    const leaks = files.filter((f) => readFileSync(join(ROOT, f)).includes(PW));
    expect(leaks).toEqual([]);
  });

  it("generated_password_only_in_ignored_file [invariant] unset env: 20-char password only in a 0600 file under an ignored path", async () => {
    const t = await fresh();
    const creds = join(tmp(), "creds.txt");
    const cap = capture();
    const report = await seed_reference_data(t.db, { env: {}, credentials_path: creds, build_id: "test" });
    const out = cap.text();
    vi.restoreAllMocks();
    expect(report.users).toBe(3);
    expect(statSync(creds).mode & 0o777).toBe(0o600);
    const lines = readFileSync(creds, "utf8").trim().split("\n");
    expect(lines).toHaveLength(3);
    const pws = new Set(lines.map((l) => l.trim().split(/\s+/).pop() as string));
    expect(pws.size).toBe(1);
    const pw = [...pws][0] as string;
    expect(pw).toHaveLength(20);
    expect(out).not.toContain(pw);
    expect(await all_text(t)).not.toContain(pw);
    // the real default path is git-ignored
    const r = spawnSync("git", ["check-ignore", "-q", ".demo/seed-credentials.txt"], { cwd: ROOT });
    expect(r.status).toBe(0);
  });

  it("generated_password_only_in_ignored_file [invariant] real CLI never prints the generated password", async () => {
    const t = await fresh();
    const demo = join(ROOT, ".demo/seed-credentials.txt");
    const had = existsSync(join(ROOT, ".demo"));
    try {
      const env = { ...process.env, DATABASE_URL: t.url };
      delete (env as Record<string, string | undefined>)["SEED_DEMO_PASSWORD"];
      const r = spawnSync("npx", ["tsx", "ops/seed.ts"], { cwd: ROOT, env, encoding: "utf8" });
      expect(r.status).toBe(0);
      const pw = readFileSync(demo, "utf8").trim().split("\n")[0]!.trim().split(/\s+/).pop() as string;
      expect(pw).toHaveLength(20);
      expect(r.stdout + r.stderr).not.toContain(pw);
      expect(statSync(demo).mode & 0o777).toBe(0o600);
    } finally {
      if (!had) rmSync(join(ROOT, ".demo"), { recursive: true, force: true });
      else rmSync(demo, { force: true });
    }
  }, 60_000);

  it("no_web_import [invariant] seed.ts imports hash_password from core auth and nothing from apps/", () => {
    const src = readFileSync(join(ROOT, "ops/seed.ts"), "utf8");
    expect(src).toMatch(/@ls\/core\/auth\/passwords|packages\/core\/src\/auth\/passwords/);
    expect(src).not.toMatch(/apps\/|@ls\/web/);
    expect(existsSync(join(ROOT, "packages/core/src/auth/passwords.ts"))).toBe(true);
    const lint = spawnSync("npx", ["eslint", "ops/seed.ts"], { cwd: ROOT, encoding: "utf8" });
    expect(lint.status).toBe(0);
  }, 120_000);

  describe("bad_standards_input_writes_nothing [failure] exits before any row, names the file, never a value", () => {
    const zero = async (t: TestDb): Promise<void> => {
      expect(await n(t, "standard")).toBe(0);
      expect(await n(t, "app_user")).toBe(0);
      expect(await n(t, "prompt_version")).toBe(0);
      expect(await n(t, `ops_event WHERE kind='seed'`)).toBe(0);
    };
    it("missing file", async () => {
      const t = await fresh();
      const dir = tmp();
      cpSync(STD_DIR, dir, { recursive: true });
      rmSync(join(dir, "eld-6.json"));
      const err = await seed_reference_data(t.db, opts({ standards_dir: dir })).then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(SeedInputError);
      expect(String((err as SeedInputError).file)).toContain("eld-6.json");
      expect((err as Error).message).not.toContain(PW);
      await zero(t);
    });
    it("a row lacking text", async () => {
      const t = await fresh();
      const dir = tmp();
      cpSync(STD_DIR, dir, { recursive: true });
      const p = join(dir, "msls-6.json");
      const j = JSON.parse(readFileSync(p, "utf8")) as { standards: { text?: string }[] };
      j.standards[0]!.text = "";
      writeFileSync(p, JSON.stringify(j));
      const err = await seed_reference_data(t.db, opts({ standards_dir: dir })).then(() => null, (e: unknown) => e);
      expect(err).toBeInstanceOf(SeedInputError);
      expect(String((err as SeedInputError).file)).toContain("msls-6.json");
      await zero(t);
    });
  });

  it("never_reads_restricted_folder [negative] no fs call touches a path under docs/source/restricted", async () => {
    const t = await fresh();
    const dir = join(ROOT, "docs/source/restricted");
    const existed = existsSync(dir);
    const marker = join(dir, "NL82-marker.txt");
    mkdirSync(dir, { recursive: true });
    writeFileSync(marker, "RESTRICTED-MARKER-NL82");
    const seen: string[] = [];
    for (const m of ["readFileSync", "readdirSync", "existsSync", "statSync", "openSync", "readFile", "readdir", "createReadStream"] as const) {
      const orig = (fs as unknown as Record<string, (...a: unknown[]) => unknown>)[m]!;
      vi.spyOn(fs as never, m as never).mockImplementation(((...a: unknown[]) => (seen.push(String(a[0])), orig.apply(fs, a))) as never);
    }
    try {
      await seed_reference_data(t.db, opts());
    } finally {
      vi.restoreAllMocks();
      rmSync(marker, { force: true });
      if (!existed) rmSync(dir, { recursive: true, force: true });
    }
    expect(seen.length).toBeGreaterThan(0); // the spy sees the standards files being read
    expect(seen.filter((p) => p.includes("restricted"))).toEqual([]);
    expect(await all_text(t)).not.toContain("RESTRICTED-MARKER-NL82");
    expect(readFileSync(join(ROOT, "ops/seed.ts"), "utf8")).not.toMatch(/restricted/i);
  });
});
