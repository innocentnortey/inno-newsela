// NL-83 AC-4 (risk::security, frozen; invariant): each of web, worker, collab writes exactly one `process.start`
// ops_event with its service and a non-empty build_id equal to BUILD_ID (WF-38). NL-23's old kind `process_start` must be gone.
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "../packages/db/src/testing/test-db.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let t: TestDb;
const children: ChildProcess[] = [];

const free_port = (): Promise<number> =>
  new Promise((res) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => {
      const p = (s.address() as net.AddressInfo).port;
      s.close(() => res(p));
    });
  });

async function query<T>(sql: string, args: unknown[] = []): Promise<T[]> {
  const c = new pg.Client({ connectionString: t.url });
  await c.connect();
  try {
    return (await c.query(sql, args)).rows as T[];
  } finally {
    await c.end();
  }
}
const rows = (service: string) =>
  query<{ build_id: string; service: string }>("select build_id, service from ops_event where kind='process.start' and service=$1", [service]);

async function wait_for(service: string) {
  const end = Date.now() + 25_000;
  for (;;) {
    const r = await rows(service);
    if (r.length > 0) return r;
    if (Date.now() > end) throw new Error(`no process.start for ${service}`);
    await new Promise((x) => setTimeout(x, 300));
  }
}

beforeAll(async () => { t = await create_test_db(); }, 60_000);
afterAll(async () => {
  for (const c of children) c.kill("SIGTERM");
  await t?.drop();
});

describe("NL-83 process.start events (WF-38)", () => {
  it("test_start_event", async () => {
    const env = {
      ...process.env,
      DATABASE_URL: t.url, AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t", BUILD_ID: "nl83-test",
      WORKER_HEALTH_PORT: String(await free_port()), COLLAB_PORT: String(await free_port()),
    };
    for (const svc of ["worker", "collab"]) {
      children.push(spawn(path.join(root, "node_modules/.bin/tsx"), [`apps/${svc}/src/main.ts`], { cwd: root, env, stdio: "ignore" }));
    }
    for (const svc of ["worker", "collab"]) {
      const r = await wait_for(svc);
      expect(r).toHaveLength(1);
      expect(r[0]).toEqual({ build_id: "nl83-test", service: svc });
    }
    Object.assign(process.env, env, { NEXT_RUNTIME: "nodejs" });
    // eslint-disable-next-line boundaries/dependencies -- NL-83 AC-2 drives the web start event end to end
    const { register } = await import("../apps/web/instrumentation.ts");
    await register();
    const w = await wait_for("web");
    expect(w).toEqual([{ build_id: "nl83-test", service: "web" }]);
    // one event per process, three in all, and nothing under the retired NL-23 kind
    const all = await query<{ service: string }>("select service from ops_event where kind='process.start'");
    expect(all.map((r) => r.service).sort()).toEqual(["collab", "web", "worker"]);
    expect(await query("select 1 from ops_event where kind='process_start'")).toHaveLength(0);
  }, 90_000);
});
