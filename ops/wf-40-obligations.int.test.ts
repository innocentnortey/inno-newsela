// NL-83 AC-15: WF-40 obligations (GR-9, GR-13, OBS-1, OBS-7, OBS-11), driven through bash ops/backup.sh in container mode.
import { rmSync } from "node:fs";
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

const OWNED = ["ops/backup.sh", "ops/record-event.ts"];
let out = "";
let dump = "";
beforeAll(() => {
  const r = spawnSync("bash", ["ops/backup.sh"], {
    cwd: root, encoding: "utf8", timeout: 120_000,
    env: { PATH: process.env["PATH"] ?? "", HOME: process.env["HOME"] ?? "", BACKUP_DOCKER_CONTAINER: "newsela-test-postgres-1", DATABASE_URL: t.url, BUILD_ID: "nl83-wf40" },
  });
  out = r.stdout + r.stderr;
  expect(r.status, out).toBe(0);
  dump = path.join(root, /backup ok (backups\/\S+)/.exec(out)![1]!);
}, 150_000);
afterAll(() => rmSync(dump, { force: true }));

describe("NL-83 WF-40 obligations", () => {
  it("GR-9 restricted folder stays ignored, untracked and unmentioned", async () => {
    gr9_gr13_common();
    for (const f of OWNED) expect(read(f)).not.toContain(RESTRICTED);
    expect(out + (await all_events())).not.toContain(RESTRICTED);
  });
  it("GR-13 no student or teacher-of-record data in the event", async () => {
    await no_personal_columns();
    const ev = await q<{ details_json: Record<string, unknown> }>("select details_json from ops_event where kind='backup'");
    expect(ev).toHaveLength(1);
    expect(Object.keys(ev[0]!.details_json).sort()).toEqual(["path", "sha256", "size"]);
  });
  it("OBS-1 capture test exists and the event carries build_id and service", async () => {
    expect(read("ops/backup.test.ts")).toContain("test_backup_logs_event");
    const ev = await q<{ build_id: string; service: string }>("select build_id, service from ops_event where kind='backup'");
    expect(ev[0]).toEqual({ build_id: "nl83-wf40", service: "ops" });
  });
  it("OBS-7 no password in output or events", async () => {
    const hay = out + (await all_events());
    for (const m of ["ls_dev_only", "QzDb-Pass-83", "QzKey-Prov-83"]) expect(hay).not.toContain(m);
  });
  it("OBS-11 WF-40 row names its capture test", () => {
    expect(obs_row("WF-40")).toContain("test_backup_logs_event");
  });
});
