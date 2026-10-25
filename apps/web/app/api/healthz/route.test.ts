// NL-83 (risk::security, frozen): web GET /api/healthz route (WF-39). AC-1, AC-2 (503), AC-3.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "../../../../../packages/db/src/testing/test-db.ts";
import { GET } from "./route.ts";

let t: TestDb;
const KEY = Symbol.for("ls.web.health");
const saved = { ...process.env };
const reset = () => { delete (globalThis as Record<symbol, unknown>)[KEY]; };

beforeAll(async () => { t = await create_test_db(); }, 60_000);
afterAll(async () => { process.env = saved; reset(); await t?.drop(); });
beforeEach(reset);

function env(url: string): void {
  Object.assign(process.env, { DATABASE_URL: url, AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t", BUILD_ID: "b-83" });
}
async function events(): Promise<number> {
  const r = await t.db.with_tx(async (tx) => tx.query("select count(*)::int as n from ops_event", []));
  return (r as unknown as { rows: Array<{ n: number }> }).rows[0]!.n;
}

describe("NL-83 web /api/healthz (WF-39)", () => {
  it("ok_when_postgres_reachable [invariant AC-1]", async () => {
    env(t.url);
    const before = await events();
    const res = await GET(new Request("http://localhost/api/healthz"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", service: "web", build_id: "b-83" });
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(await events()).toBe(before);
  });

  it("test_healthz 503 when postgres unreachable, never throws [failure AC-2]", async () => {
    env("postgres://ls:x@127.0.0.1:1/none");
    const res = await GET(new Request("http://localhost/api/healthz"));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "unavailable", service: "web" });
  });

  it("no_secrets_in_health_or_events [negative AC-3]", async () => {
    env("postgres://ls:QzDb-Pass-83@127.0.0.1:1/none");
    process.env["ANTHROPIC_API_KEY"] = "QzKey-Prov-83";
    const res = await GET(new Request("http://localhost/api/healthz"));
    const text = await res.text();
    expect(text).not.toContain("QzDb-Pass-83");
    expect(text).not.toContain("QzKey-Prov-83");
    for (const [k, v] of res.headers) expect(`${k}:${v}`).not.toMatch(/QzDb-Pass-83|QzKey-Prov-83/);
  });
});
