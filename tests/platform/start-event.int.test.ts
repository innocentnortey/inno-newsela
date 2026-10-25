// NL-23 AC-6: each process writes one process.start ops_event on start; a failed write is not fatal.
import { spawn, type ChildProcess } from "node:child_process";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "../../packages/db/src/testing/test-db.ts";
import { load_worker_settings } from "@ls/config/settings";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
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

async function rows(service: string): Promise<Array<{ build_id: string; details_json: unknown }>> {
  const c = new pg.Client({ connectionString: t.url });
  await c.connect();
  try {
    const r = await c.query("select build_id, details_json from ops_event where kind='process.start' and service=$1", [service]);
    return r.rows;
  } finally {
    await c.end();
  }
}
async function wait_for(service: string) {
  const end = Date.now() + 25_000;
  for (;;) {
    const r = await rows(service);
    if (r.length > 0) return r;
    if (Date.now() > end) throw new Error(`no process.start for ${service}`);
    await new Promise((x) => setTimeout(x, 300));
  }
}

beforeAll(async () => {
  t = await create_test_db();
}, 60_000);
afterAll(async () => {
  for (const c of children) c.kill("SIGTERM");
  await t?.drop();
});

describe("NL-23 start events", () => {
  it("test_start_event", async () => {
    const env = {
      ...process.env,
      DATABASE_URL: t.url, AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t", BUILD_ID: "nl23-test",
      WORKER_HEALTH_PORT: String(await free_port()), COLLAB_PORT: String(await free_port()),
    };
    for (const svc of ["worker", "collab"]) {
      children.push(spawn(path.join(root, "node_modules/.bin/tsx"), [`apps/${svc}/src/main.ts`], { cwd: root, env, stdio: "ignore" }));
    }
    for (const svc of ["worker", "collab"]) {
      const r = await wait_for(svc);
      expect(r[0]!.build_id).toBe("nl23-test");
      expect(r[0]!.details_json).toEqual({});
    }
    Object.assign(process.env, env, { NEXT_RUNTIME: "nodejs" });
    const { register } = await import("../../apps/web/instrumentation.ts");
    await register();
    const w = await wait_for("web");
    expect(w[0]!.build_id).toBe("nl23-test");
    expect(w[0]!.details_json).toEqual({});
  }, 90_000);

  it("test_start_event_not_fatal", async () => {
    const { write_start_event } = await import("../../apps/worker/src/start-event.ts");
    const warns: string[] = [];
    const logger = { info() {}, error() {}, warn: (e: string) => void warns.push(e) };
    const s = load_worker_settings({ DATABASE_URL: "postgres://u:p@127.0.0.1:1/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" });
    expect(await write_start_event(s, logger, { attempts: 2, delay_ms: 1 })).toBe(false);
    expect(warns).toEqual(["process_start.not_recorded"]);
  });
});
