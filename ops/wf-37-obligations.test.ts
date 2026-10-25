// NL-82 frozen tests (risk::security), AC-11. Do not edit: hashed in docs/plans/frozen-tests/NL-82.manifest.json.
// WF-37 obligations, one case per id, driven through the real seed entry (ops/seed.ts).
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { seed_reference_data } from "./seed.ts";

const ROOT = resolve(import.meta.dirname, "..");
const STD_DIR = join(ROOT, "packages/core/data/standards");
const FILES = ["ccss-ela-6.json", "eld-6.json", "msls-6.json"];
let t: TestDb;
let before: Record<string, number> = {};
let after: Record<string, number> = {};

async function counts(): Promise<Record<string, number>> {
  return t.db.with_tx(async (tx) => {
    const out: Record<string, number> = {};
    const tables = (await tx.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`)).rows;
    for (const r of tables) out[String(r["table_name"])] = Number((await tx.query(`SELECT count(*)::int AS n FROM "${String(r["table_name"])}"`)).rows[0]?.["n"]);
    return out;
  });
}

beforeAll(async () => {
  t = await create_test_db();
  before = await counts();
  await seed_reference_data(t.db, { env: { SEED_DEMO_PASSWORD: "QzSeed-Pass-82!" }, credentials_path: join(ROOT, "node_modules/.cache-nl82-unused-creds"), build_id: "test" });
  after = await counts();
});
afterAll(async () => {
  await t?.drop();
});

describe("WF-37 obligations", () => {
  it("GR-5: seeded standards text equals the official CDE files, nothing else [invariant]", async () => {
    const want = new Map<string, string>();
    for (const f of FILES) for (const s of (JSON.parse(readFileSync(join(STD_DIR, f), "utf8")) as { standards: { code: string; text: string }[] }).standards) want.set(s.code, s.text);
    const rows = await t.db.with_tx(async (tx) => (await tx.query(`SELECT code, text FROM standard`)).rows);
    expect(rows.length).toBe(want.size);
    for (const r of rows) expect(r["text"]).toBe(want.get(String(r["code"])));
  });

  it("GR-9: the seed never touches the restricted folder [invariant]", () => {
    expect(readFileSync(join(ROOT, "ops/seed.ts"), "utf8")).not.toMatch(/restricted/i);
  });

  it("GR-13: only reference tables gain rows; accounts are exactly the three synthetic staff roles [invariant]", async () => {
    const changed = Object.keys(after).filter((k) => after[k] !== before[k]).sort();
    expect(changed).toEqual(["app_user", "ops_event", "prompt_version", "standard"]);
    const users = await t.db.with_tx(async (tx) => (await tx.query(`SELECT role, synthetic FROM app_user`)).rows);
    expect(users).toHaveLength(3);
    expect(users.every((u) => u["synthetic"] === true)).toBe(true);
  });

  it("OBS-11: WF-37 row registered and db:seed maps to ops/seed.ts [invariant]", () => {
    expect(readFileSync(join(ROOT, "docs/design/observability.md"), "utf8")).toContain("| WF-37 |");
    const targets = JSON.parse(readFileSync(join(ROOT, "scripts/script-targets.json"), "utf8")) as Record<string, { target: string }>;
    expect(targets["db:seed"]?.target).toBe("ops/seed.ts");
    expect(readFileSync(join(ROOT, "ops/seed.ts"), "utf8")).toMatch(/seed_reference_data/);
  });
});
