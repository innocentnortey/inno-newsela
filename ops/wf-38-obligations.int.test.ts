// NL-83 AC-13: WF-38 obligations (GR-9, GR-13, GR-17, EV-R3, OBS-1, OBS-11), driven through the worker main entry point.
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

const OWNED = ["apps/worker/src/start-event.ts", "apps/collab/src/start-event.ts", "apps/web/src/server/start-event.ts", "apps/web/instrumentation.ts"];
let child: ChildProcess;
let rows: Array<{ build_id: string; service: string; details_json: unknown }> = [];
beforeAll(async () => {
  const port = await new Promise<number>((res) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => { const p = (s.address() as net.AddressInfo).port; s.close(() => res(p)); });
  });
  child = spawn(path.join(root, "node_modules/.bin/tsx"), ["apps/worker/src/main.ts"], {
    cwd: root, stdio: "ignore",
    env: { ...process.env, DATABASE_URL: t.url, AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t", BUILD_ID: "nl83-wf38", WORKER_HEALTH_PORT: String(port) },
  });
  const end = Date.now() + 25_000;
  while (rows.length === 0 && Date.now() < end) {
    rows = await q("select build_id, service, details_json from ops_event where kind='process.start'");
    if (rows.length === 0) await new Promise((r) => setTimeout(r, 300));
  }
}, 60_000);
afterAll(() => child?.kill("SIGTERM"));

describe("NL-83 WF-38 obligations", () => {
  it("GR-9 restricted folder stays ignored, untracked and unmentioned", async () => {
    gr9_gr13_common();
    for (const f of OWNED) expect(read(f)).not.toContain(RESTRICTED);
    expect(await all_events()).not.toContain(RESTRICTED);
  });
  it("GR-13 no student or teacher-of-record data", async () => {
    await no_personal_columns();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.details_json).toEqual({});
  });
  it("GR-17 LICENSE is all rights reserved with evaluation use (conditional until NL-137)", () => {
    if (existsSync(path.join(root, "LICENSE"))) {
      const text = read("LICENSE").toLowerCase();
      expect(text).toContain("all rights reserved");
      expect(text).toContain("evaluation");
    } else {
      expect(read("docs/plans/tickets/NL-137.md")).toContain("LICENSE");
      console.log("pending: NL-137 (LICENSE not built yet)");
    }
    for (const f of OWNED) expect(read(f)).not.toContain(RESTRICTED);
  });
  it("EV-R3 full suite and golden eval are wired, NL-137 owns the pre-deploy run", () => {
    const scripts = (JSON.parse(read("package.json")) as { scripts: Record<string, string> }).scripts;
    expect(scripts["test"]).toBe("vitest run");
    expect(scripts["eval:golden"]).toBeDefined();
    expect(read("docs/plans/tickets/NL-137.md")).toContain("EV-R3");
  });
  it("OBS-1 capture test exists and the start event carries build_id and service", () => {
    expect(read("ops/start-events.int.test.ts")).toContain("test_start_event");
    expect(rows[0]).toMatchObject({ build_id: "nl83-wf38", service: "worker" });
  });
  it("OBS-11 WF-38 row names its capture test", () => {
    expect(obs_row("WF-38")).toContain("test_start_event");
  });
});
