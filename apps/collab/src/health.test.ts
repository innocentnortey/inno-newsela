// NL-83 (risk::security, frozen): collab /healthz (WF-39). AC-1, AC-2, AC-3.
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PgDatabase } from "@ls/db/pool";
import { create_logger } from "@ls/obs/logger";
import { create_test_db, type TestDb } from "../../../packages/db/src/testing/test-db.ts";
import { create_health_handler } from "./health.ts";

const SERVICE = "collab";
async function start(db: PgDatabase, o: Parameters<typeof create_health_handler>[2]) {
  const handler = create_health_handler(db, SERVICE, o);
  const server = createServer((req, res) => void handler(req, res));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  const port = (server.address() as AddressInfo).port;
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => { server.close(() => r()); server.closeAllConnections(); }),
  };
}

const MARK_PW = "QzDb-Pass-83";
const MARK_KEY = "QzKey-Prov-83";
let t: TestDb;
let now_ms = 1_000_000;
let lines: string[] = [];
const closers: Array<() => Promise<void>> = [];

const logger = () =>
  create_logger({ service: SERVICE, build_id: "b-83", write: (l) => void lines.push(l) });
const opts = () => ({ build_id: "b-83", logger: logger(), now: () => now_ms });

async function count(kind = "health.failure"): Promise<number> {
  const r = await t.db.with_tx(async (tx) => tx.query("select count(*)::int as n from ops_event where kind=$1", [kind]));
  return (r as unknown as { rows: Array<{ n: number }> }).rows[0]!.n;
}
async function all_events(): Promise<string> {
  const r = await t.db.with_tx(async (tx) => tx.query("select * from ops_event", []));
  return JSON.stringify((r as unknown as { rows: unknown[] }).rows);
}
async function probe(base: string, headers: Record<string, string> = {}) {
  const res = await fetch(`${base}/healthz`, { headers });
  return { status: res.status, text: await res.text(), headers: res.headers };
}

beforeAll(async () => {
  t = await create_test_db();
}, 60_000);
afterAll(async () => {
  for (const c of closers) await c().catch(() => undefined);
  await t?.drop();
});
beforeEach(() => {
  lines = [];
  vi.restoreAllMocks();
});

async function up(db: PgDatabase = t.db): Promise<string> {
  const s = await start(db, opts());
  closers.push(s.close);
  return s.base;
}

describe(`NL-83 ${SERVICE} /healthz (WF-39)`, () => {
  it("ok_when_postgres_reachable [invariant AC-1]", async () => {
    const base = await up();
    const before = await count();
    const r = await probe(base);
    expect(r.status).toBe(200);
    expect(JSON.parse(r.text)).toEqual({ status: "ok", service: SERVICE, build_id: "b-83" });
    expect(await count()).toBe(before);
    expect(await count("process.start")).toBe(0);
    expect(r.headers.get("x-request-id")).toBeTruthy();
  });

  it("test_healthz [AC-2 failure: 503, one event per 60s, event-write failure still 503]", async () => {
    vi.spyOn(t.db, "ping").mockResolvedValue(false);
    const base = await up();
    const before = await count();
    const a = await probe(base);
    expect(a.status).toBe(503);
    expect(JSON.parse(a.text)).toEqual({ status: "unavailable", service: SERVICE });
    expect(await count()).toBe(before + 1);
    const ev = await t.db.with_tx(async (tx) =>
      tx.query("select service, build_id from ops_event where kind='health.failure' order by at desc limit 1", []),
    );
    expect((ev as unknown as { rows: Array<{ service: string; build_id: string }> }).rows[0]).toEqual({ service: SERVICE, build_id: "b-83" });
    // second call inside 60 s: no second event
    now_ms += 59_000;
    expect((await probe(base)).status).toBe(503);
    expect(await count()).toBe(before + 1);
    // after 60 s: one more
    now_ms += 1_000;
    await probe(base);
    expect(await count()).toBe(before + 2);
    expect(lines.filter((l) => l.includes("health.event_write_failed"))).toHaveLength(0);
  });

  it("test_healthz concurrent failures write one event [invariant AC-2]", async () => {
    vi.spyOn(t.db, "ping").mockResolvedValue(false);
    now_ms += 10 * 60_000;
    const base = await up();
    const before = await count();
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => probe(base)));
    expect(rs.every((r) => r.status === 503)).toBe(true);
    expect(await count()).toBe(before + 1);
  });

  it("test_healthz event write failing still returns 503 and logs one line [AC-2 failure]", async () => {
    vi.spyOn(t.db, "ping").mockResolvedValue(false);
    vi.spyOn(t.db, "with_tx").mockRejectedValue(new Error(`boom ${MARK_PW}`));
    now_ms += 10 * 60_000;
    const base = await up();
    const r = await probe(base);
    expect(r.status).toBe(503);
    expect(JSON.parse(r.text)).toEqual({ status: "unavailable", service: SERVICE });
    const logged = lines.filter((l) => l.includes("health.event_write_failed"));
    expect(logged).toHaveLength(1);
    expect(JSON.parse(logged[0]!).event).toBe("health.event_write_failed");
    expect(lines.join("\n")).not.toContain(MARK_PW);
  });

  it("no_secrets_in_health_or_events [negative AC-3]", async () => {
    const saved = { ...process.env };
    process.env["DATABASE_URL"] = `postgres://ls:${MARK_PW}@127.0.0.1:1/x`;
    process.env["ANTHROPIC_API_KEY"] = MARK_KEY;
    process.env["OPENROUTER_API_KEY"] = MARK_KEY;
    try {
      const out: string[] = [];
      // reachable
      const ok_base = await up();
      out.push((await probe(ok_base)).text);
      // failing with a working event write
      vi.spyOn(t.db, "ping").mockResolvedValue(false);
      now_ms += 10 * 60_000;
      out.push((await probe(await up())).text);
      // failing with a failing event write whose error message carries the marker
      vi.spyOn(t.db, "with_tx").mockRejectedValue(new Error(`${MARK_PW} ${MARK_KEY}`));
      now_ms += 10 * 60_000;
      out.push((await probe(await up())).text);
      vi.restoreAllMocks();
      const haystack = [...out, await all_events(), ...lines].join("\n");
      expect(haystack).not.toContain(MARK_PW);
      expect(haystack).not.toContain(MARK_KEY);
    } finally {
      process.env = saved;
    }
  });
});
