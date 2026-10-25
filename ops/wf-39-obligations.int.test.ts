// NL-83 AC-14: WF-39 obligations (GR-9, GR-13, OBS-1, OBS-3, OBS-7, OBS-11), driven through the worker main entry point
// with an unreachable database (health 503) and a reachable one (health 200).
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
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

const OWNED = ["apps/worker/src/health.ts", "apps/collab/src/health.ts", "apps/web/src/server/health.ts", "apps/web/app/api/healthz/route.ts"];
const MARK_PW = "QzDb-Pass-83";
const free_port = (): Promise<number> => new Promise((res) => {
  const s = net.createServer();
  s.listen(0, "127.0.0.1", () => { const p = (s.address() as net.AddressInfo).port; s.close(() => res(p)); });
});
const children: ChildProcess[] = [];
let output = "";
function boot(url: string, port: number): void {
  const c = spawn(path.join(root, "node_modules/.bin/tsx"), ["apps/worker/src/main.ts"], {
    cwd: root, stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, DATABASE_URL: url, AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t", BUILD_ID: "nl83-wf39", ANTHROPIC_API_KEY: "QzKey-Prov-83", WORKER_HEALTH_PORT: String(port) },
  });
  c.stdout!.on("data", (d) => (output += d));
  c.stderr!.on("data", (d) => (output += d));
  children.push(c);
}
async function probe(port: number, headers: Record<string, string> = {}): Promise<Response> {
  const end = Date.now() + 25_000;
  for (;;) {
    try { return await fetch(`http://127.0.0.1:${port}/healthz`, { headers }); } catch (e) {
      if (Date.now() > end) throw e;
      await new Promise((r) => setTimeout(r, 300));
    }
  }
}
let up_port = 0, down_port = 0;
let up_res: Response, down_res: Response, echoed: Response, replaced: Response;
let bodies = "";
beforeAll(async () => {
  up_port = await free_port(); down_port = await free_port();
  boot(t.url, up_port);
  boot(`postgres://ls:${MARK_PW}@127.0.0.1:1/none`, down_port);
  up_res = await probe(up_port);
  down_res = await probe(down_port);
  echoed = await probe(up_port, { "x-request-id": "req-abc12345" });
  replaced = await probe(up_port, { "x-request-id": "bad id<x>" });
  bodies = [up_res, down_res].map((r) => r.status).join(",") + (await up_res.clone().text()) + (await down_res.clone().text());
}, 90_000);
afterAll(() => { for (const c of children) c.kill("SIGTERM"); });

describe("NL-83 WF-39 obligations", () => {
  it("GR-9 restricted folder stays ignored, untracked and unmentioned", async () => {
    gr9_gr13_common();
    for (const f of OWNED) expect(read(f)).not.toContain(RESTRICTED);
    expect(bodies + (await all_events())).not.toContain(RESTRICTED);
  });
  it("GR-13 no student or teacher-of-record data", async () => {
    await no_personal_columns();
    expect(up_res.status).toBe(200);
    expect(await up_res.json()).toEqual({ status: "ok", service: "worker", build_id: "nl83-wf39" });
  });
  it("OBS-1 capture test exists and the real entry point answers 503 on a dead database", () => {
    expect(read("apps/worker/src/health.test.ts")).toContain("test_healthz");
    expect(down_res.status).toBe(503);
  });
  it("OBS-3 X-Request-Id is returned, a valid one echoed, an invalid one replaced", () => {
    expect(up_res.headers.get("x-request-id")).toBeTruthy();
    expect(echoed.headers.get("x-request-id")).toBe("req-abc12345");
    const r = replaced.headers.get("x-request-id");
    expect(r).toBeTruthy();
    expect(r).not.toBe("bad id<x>");
  });
  it("OBS-7 no password or provider key in bodies, events, headers or process output", async () => {
    const heads = [up_res, down_res, echoed, replaced].flatMap((r) => [...r.headers].map(([k, v]) => `${k}:${v}`)).join("\n");
    const hay = [bodies, heads, output, await all_events()].join("\n");
    for (const m of [MARK_PW, "QzKey-Prov-83", "ls_dev_only"]) expect(hay).not.toContain(m);
  });
  it("OBS-11 WF-39 row names its capture test", () => {
    expect(obs_row("WF-39")).toContain("test_healthz");
  });
});
