// NL-118 (WF-29, AC-3/4/5/7): the probe against the real built app and a migrated, seeded database.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_EMAILS, run_spike, type SpikeDeps } from "./spike.ts";
import { start_probe_stack, type ProbeStack } from "./src/testing/stack.ts";

const ROOT = path.resolve(import.meta.dirname, "..");

function npm_spike(args: string[], env: Record<string, string>): Promise<{ code: number; out: string; err: string }> {
  return new Promise((ok) => {
    const c = spawn("npm", ["run", "--silent", "load:spike", "--", ...args], {
      cwd: ROOT, env: { PATH: process.env["PATH"] ?? "", HOME: process.env["HOME"] ?? "", ...env },
    });
    let out = "";
    let err = "";
    c.stdout.on("data", (d: Buffer) => (out += d.toString()));
    c.stderr.on("data", (d: Buffer) => (err += d.toString()));
    c.on("close", (code) => ok({ code: code ?? -1, out, err }));
  });
}

interface ProbeRow {
  kind: string; users: number; provider_mode: string; machine: string; n: number; error_rate: number;
  p95_json: Record<string, number | null>; max_db_connections: number; event_loop_lag_p95_ms: string | number;
}
const COUNT_TABLES = ["lesson_doc", "lesson_version", "review_event", "lesson_metrics"];

describe("http probe on the real stack", () => {
  let stack: ProbeStack;
  let out_dir: string;
  let run: { code: number; out: string; err: string };
  let before: Record<string, number>;
  let after: Record<string, number>;
  let tile_before: string;
  let tile_after: string;
  let hb_before = 0;
  let cookie = "";

  const counts = async (): Promise<Record<string, number>> => {
    const o: Record<string, number> = {};
    for (const t of COUNT_TABLES) o[t] = Number((await stack.query<{ n: string }>(`select count(*) as n from ${t}`))[0]!.n);
    return o;
  };
  const tile = async (): Promise<string> => {
    const r = await fetch(`${stack.base_url}/api/units/${stack.unit_id}/board`, { headers: { cookie } });
    const b = (await r.json()) as Record<string, unknown>;
    return JSON.stringify(b["north_star"] ?? null);
  };

  beforeAll(async () => {
    stack = await start_probe_stack();
    out_dir = mkdtempSync(path.join(os.tmpdir(), "probe-report-"));
    const login = await fetch(`${stack.base_url}/api/session`, {
      method: "POST", headers: { "content-type": "application/json", origin: stack.base_url },
      body: JSON.stringify({ email: stack.emails.reviewer, password: stack.password }),
    });
    cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]!).find((c) => c.startsWith("ls_session="))!;
    before = await counts();
    tile_before = await tile();
    hb_before = Number((await stack.query<{ n: string }>("select count(*) as n from heartbeat"))[0]!.n);
    run = await npm_spike(
      ["--users", "5", "--ramp-s", "2", "--plateau-s", "6", "--ramp-down-s", "2", "--base-url", stack.base_url, "--database-url", stack.database_url, "--out-dir", out_dir],
      { LOAD_PROBE_PASSWORD: stack.password },
    );
    after = await counts();
    tile_after = await tile();
  }, 240_000);

  afterAll(async () => {
    await stack?.stop();
  }, 60_000);

  it("test_probe_writes_run", async () => {
    expect(run.err.replaceAll(stack.password, "***")).toBe("");
    expect(run.code).toBe(0);
    const line = JSON.parse(run.out.trim().split("\n").pop()!) as { probe_run_id: string; report_path: string; request_log: string };
    const rows = await stack.query<ProbeRow>("select * from probe_run where id = $1", [line.probe_run_id]);
    expect(rows).toHaveLength(1);
    const r = rows[0]!;
    expect([r.kind, r.users, r.provider_mode]).toEqual(["http", 5, "stub"]);
    expect(String(r.machine).length).toBeGreaterThan(0);
    expect(r.n).toBeGreaterThan(0);
    for (const k of ["lesson_open", "board", "poll"]) expect(typeof r.p95_json[k]).toBe("number");
    expect(r.max_db_connections).toBeGreaterThanOrEqual(1);
    expect(Number(r.event_loop_lag_p95_ms)).toBeGreaterThanOrEqual(0);
    const lines = readFileSync(line.request_log, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { vu: string });
    for (let i = 1; i <= 5; i++) expect(lines.some((l) => l.vu === `vu-00${i}`)).toBe(true);
    expect(readFileSync(line.request_log, "utf8")).not.toContain(stack.password);
    const report = readFileSync(line.report_path, "utf8");
    expect(report).toContain("Client errors (4xx, excluded) | 0 |");
    expect(report).toMatch(/Git SHA \| [0-9a-f]{12}/);
    console.log(`probe_run_id=${line.probe_run_id} n=${r.n} p95=${JSON.stringify(r.p95_json)} err=${r.error_rate} conns=${r.max_db_connections} lag=${r.event_loop_lag_p95_ms}`);
  });

  it("leaves_data_alone", async () => {
    expect(after).toEqual(before);
    expect(tile_after).toBe(tile_before);
    const hb = (await stack.query<{ total: string; real: string }>("select count(*) as total, count(*) filter (where not synthetic) as real from heartbeat"))[0]!;
    expect(Number(hb.total)).toBeGreaterThan(hb_before);
    expect(Number(hb.real)).toBe(0);
  });
});

describe("probe error accounting and refusals", () => {
  function stub(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void): Promise<{ url: string; count: () => number; close: () => Promise<void> }> {
    let n = 0;
    const s = http.createServer((req, res) => {
      n += 1;
      handler(req, res);
    });
    return new Promise((ok) =>
      s.listen(0, "127.0.0.1", () =>
        ok({ url: `http://127.0.0.1:${(s.address() as AddressInfo).port}`, count: () => n, close: () => new Promise<void>((d) => s.close(() => d())) }),
      ),
    );
  }
  const json = (res: http.ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { "content-type": "application/json", ...headers });
    res.end(JSON.stringify(body));
  };

  it("busy_is_error", async () => {
    const s = await stub((req, res) => {
      const p = req.url ?? "";
      const probing = req.headers["x-probe-run-id"] !== undefined;
      if (p === "/api/session") return json(res, 200, {}, { "set-cookie": "ls_session=x; Path=/" });
      if (p === "/api/units") return json(res, 200, [{ unit_id: "G6.U9", unit_key: "g6-u9", latest_run: null }]);
      if (p.endsWith("/board") && !probing) return json(res, 200, { rows: [{ lesson_id: "G6.U9.L1" }] });
      if (p.startsWith("/api/lessons/") && !probing) return json(res, 200, {});
      if (p.endsWith("/heartbeats")) { res.writeHead(204); return res.end(); }
      return json(res, 503, { error: { code: "SERVICE_BUSY" } }, { "retry-after": "1" });
    });
    const inserted: unknown[] = [];
    const out: NonNullable<SpikeDeps["out"]> = {};
    try {
      const deps: SpikeDeps = {
        evidence: { insert_probe_run: async (r: unknown) => { inserted.push(r); return "x"; } } as never,
        db_url: "", password: "pw", emails: DEMO_EMAILS, provider_mode: "stub", out_dir: mkdtempSync(path.join(os.tmpdir(), "busy-")),
        request_log: path.join(mkdtempSync(path.join(os.tmpdir(), "busy-log-")), "r.jsonl"), git_sha: "test", now: () => new Date("2026-10-26T00:00:00Z"),
        ramp_down_s: 1, out,
      };
      const rec = await run_spike({ users: 5, ramp_s: 1, plateau_s: 5, socket_editors: 0, base_url: s.url, collab_url: "" }, deps);
      expect(inserted).toHaveLength(1);
      expect(rec.error_rate).toBeGreaterThan(0);
      expect(out.mix!.busy_count).toBeGreaterThan(0);
      const p95 = rec.p95_ms as Record<string, number | null>;
      expect(p95["board"] ?? null).toBeNull();
      expect(p95["lesson_open"] ?? null).toBeNull();
    } finally {
      await s.close();
    }
  }, 60_000);

  it("refuses_real_provider", async () => {
    const s = await stub((_req, res) => json(res, 200, {}));
    try {
      const r = await npm_spike(["--provider", "real", "--base-url", s.url, "--database-url", "postgres://x/y"], { LOAD_PROBE_PASSWORD: "pw" });
      expect(r.code).toBe(2);
      expect(r.err).toContain("refusing");
      expect(s.count()).toBe(0);
    } finally {
      await s.close();
    }
  }, 60_000);
});
