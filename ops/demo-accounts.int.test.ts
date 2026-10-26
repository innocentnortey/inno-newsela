// Demo-accounts fix: the SCR-1 box and the seed share one constant; the flag decides documented vs random passwords.
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@ls/core/auth/demo-accounts";
import { verify_password } from "@ls/core/auth/passwords";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { seed_reference_data } from "./seed.ts";

const ROOT = resolve(import.meta.dirname, "..");
const dbs: TestDb[] = [];
const dirs: string[] = [];
afterAll(async () => {
  for (const t of dbs) await t.drop();
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});
async function hashes(t: TestDb): Promise<Map<string, string>> {
  const rows = await t.db.with_tx(async (tx) => (await tx.query(`SELECT lower(email) AS email, password_hash FROM app_user`)).rows);
  return new Map(rows.map((r) => [String(r["email"]), String(r["password_hash"])]));
}

describe("demo accounts", () => {
  it("flag on: the shown credentials verify, and no credentials file is written", async () => {
    const t = await create_test_db();
    dbs.push(t);
    const dir = mkdtempSync(join(tmpdir(), "demo-acc-"));
    dirs.push(dir);
    const credentials_path = join(dir, "creds.txt");
    await seed_reference_data(t.db, { env: { SEED_ALLOW_DEMO_ACCOUNTS: "1" }, credentials_path });
    const h = await hashes(t);
    for (const a of DEMO_ACCOUNTS) expect(verify_password(h.get(a.email) ?? "", DEMO_PASSWORD)).toBe(true);
    expect(existsSync(credentials_path)).toBe(false);
  });

  it("flag off: passwords are random (the documented one fails) and written to the credentials file", async () => {
    const t = await create_test_db();
    dbs.push(t);
    const dir = mkdtempSync(join(tmpdir(), "demo-acc-"));
    dirs.push(dir);
    const credentials_path = join(dir, "creds.txt");
    await seed_reference_data(t.db, { env: {}, credentials_path });
    const h = await hashes(t);
    for (const a of DEMO_ACCOUNTS) expect(verify_password(h.get(a.email) ?? "", DEMO_PASSWORD)).toBe(false);
    expect(readFileSync(credentials_path, "utf8")).not.toContain(DEMO_PASSWORD);
  });

  it("only the Compose seed service sets the flags; Render never does", () => {
    const render = readFileSync(join(ROOT, "render.yaml"), "utf8");
    expect(render).not.toMatch(/SEED_ALLOW_DEMO_ACCOUNTS|DEMO_ACCOUNTS/);
    const compose = readFileSync(join(ROOT, "docker-compose.yml"), "utf8");
    expect(compose.match(/SEED_ALLOW_DEMO_ACCOUNTS/g)?.length).toBeGreaterThan(0);
  });
});
