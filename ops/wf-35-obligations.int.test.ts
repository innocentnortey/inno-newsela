// NL-83 AC-12: WF-35 obligations (GR-9, GR-13, OBS-7, OBS-11), driven through ops/run-sample-builder.ts on a fixture tree.
import { cpSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "../packages/db/src/testing/test-db.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RESTRICTED = "source/" + "restricted";
const read = (p: string): string => readFileSync(path.join(root, p), "utf8");
let t: TestDb;
async function q<T>(sql: string): Promise<T[]> {
  const c = new pg.Client({ connectionString: t.url });
  await c.connect();
  try { return (await c.query(sql)).rows as T[]; } finally { await c.end(); }
}
const all_events = async (): Promise<string> => JSON.stringify(await q("select * from ops_event"));
function obs_row(wf: string): string {
  const row = read("docs/design/observability.md").split("\n").find((l) => l.startsWith(`| ${wf} |`));
  expect(row, `${wf} row in observability.md`).toBeDefined();
  return row!;
}
function gr9_gr13_common(): void {
  expect(spawnSync("git", ["check-ignore", "docs/" + RESTRICTED + "/x"], { cwd: root }).status).toBe(0);
  expect(spawnSync("git", ["ls-files", "docs/" + RESTRICTED], { cwd: root, encoding: "utf8" }).stdout.trim()).toBe("");
}
async function no_personal_columns(): Promise<void> {
  const cols = await q("select column_name from information_schema.columns where column_name ~* '(student|teacher_of_record|dob|birth)'");
  expect(cols).toEqual([]);
}
beforeAll(async () => { t = await create_test_db(); }, 60_000);
afterAll(async () => { await t?.drop(); });

const OWNED = ["ops/run-sample-builder.ts"];
const MARK_PW = "QzDb-Pass-83";
let tree: string;
let run_out = "";
beforeAll(() => {
  tree = mkdtempSync(path.join(os.tmpdir(), "nl83-wf35-"));
  for (const f of ["docs/data/samples/g6-u4-lesson-outline.json", "docs/data/scripts/build_samples.py"]) {
    mkdirSync(path.dirname(path.join(tree, f)), { recursive: true });
    cpSync(path.join(root, f), path.join(tree, f));
  }
  const r = spawnSync(path.join(root, "node_modules/.bin/tsx"), ["ops/run-sample-builder.ts", "--root", tree], {
    cwd: root, env: { PATH: process.env["PATH"] ?? "", DATABASE_URL: t.url, BUILD_ID: "nl83-wf35" } as NodeJS.ProcessEnv, encoding: "utf8", timeout: 60_000,
  });
  expect(r.status, r.stderr).toBe(0);
  run_out = r.stdout + r.stderr;
}, 90_000);
afterAll(() => rmSync(tree, { recursive: true, force: true }));

describe("NL-83 WF-35 obligations", () => {
  it("GR-9 restricted folder stays ignored, untracked and unmentioned", async () => {
    gr9_gr13_common();
    for (const f of OWNED) expect(read(f)).not.toContain(RESTRICTED);
    expect(await all_events() + run_out).not.toContain(RESTRICTED);
  });
  it("GR-13 no student or teacher-of-record data", async () => {
    await no_personal_columns();
    const ev = await q<{ details_json: unknown }>("select details_json from ops_event where kind='samples.built'");
    expect(JSON.stringify(ev)).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });
  it("OBS-7 no password, key or restricted content recorded", async () => {
    const hay = (await all_events()) + run_out;
    for (const m of [MARK_PW, "ls_dev_only", "QzKey-Prov-83"]) expect(hay).not.toContain(m);
  });
  it("OBS-11 WF-35 row names its capture test", () => {
    expect(obs_row("WF-35")).toContain("test_build_samples_logs_event");
  });
});
