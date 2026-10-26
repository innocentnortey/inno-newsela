// NL-119b (WF-30, AC-6, R-1, R-2): `npm run load:spike` reaches the Yjs probe through --socket-editors, on the real stack.
// Unit G6.U1 for the web stack so G6.U9 (the Yjs load unit) is not discovered by the HTTP half.
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { start_collab, type CollabHarness } from "./src/testing/collab.ts";
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

describe("spike reaches the yjs probe", () => {
  let stack: ProbeStack;
  let collab: CollabHarness;
  const tmp = () => mkdtempSync(path.join(os.tmpdir(), "probe-yjs-"));
  const count = async (sql: string): Promise<number> => Number((await stack.query<{ n: string }>(sql))[0]!.n);
  const base = (): string[] => ["--base-url", stack.base_url, "--database-url", stack.database_url, "--out-dir", tmp()];
  const env = (): Record<string, string> => ({ LOAD_PROBE_PASSWORD: stack.password });

  beforeAll(async () => {
    stack = await start_probe_stack({ unit_id: "G6.U1" });
    collab = await start_collab(stack.db);
  }, 240_000);
  afterAll(async () => {
    await collab?.stop();
    await stack?.stop();
  }, 60_000);

  it("reachable_r1", async () => {
    const r = await npm_spike(["--users", "3", "--socket-editors", "3", "--plateau-s", "20", "--ramp-s", "1", "--ramp-down-s", "1", ...base(), "--collab-url", collab.url], env());
    expect(r.code).toBe(0);
    const m = /^wf=WF-30 probe_run_id=(pr_\w+) kind=yjs users=3 lost_updates=0 incomplete=false$/m.exec(r.out);
    expect(m).not.toBeNull();
    expect(r.out.match(/^wf=WF-30 /gm)).toHaveLength(1);
    const lines = r.out.trim().split("\n");
    expect(() => JSON.parse(lines.at(-1)!)).not.toThrow();
    const y = await stack.query<{ kind: string; lost_updates: number; n: number; p95_json: Record<string, unknown> }>(
      "select kind, lost_updates, n, p95_json from probe_run where id = $1", [m![1]]);
    expect(y).toHaveLength(1);
    expect(y[0]!.kind).toBe("yjs");
    expect(y[0]!.lost_updates).toBe(0);
    expect(y[0]!.n).toBeGreaterThan(0);
    expect(typeof y[0]!.p95_json["remote_edit"]).toBe("number");
    expect(typeof y[0]!.p95_json["stored"]).toBe("number");
    const ev = y[0]!.p95_json["evidence"] as { git_sha: unknown; prompt_version: unknown };
    expect(typeof ev.git_sha === "string" && ev.git_sha !== "").toBe(true);
    expect(ev.prompt_version).toBeNull();
    expect(await count("select count(*) as n from probe_run where kind = 'http'")).toBe(1);
    expect(r.out + r.err).not.toContain(stack.password);
  }, 180_000);

  it("socket_editors_zero_r2", async () => {
    const yjs_before = await count("select count(*) as n from probe_run where kind = 'yjs'");
    const lessons_before = await count("select count(*) as n from lesson where id like 'G6.U9.L9%'");
    const r = await npm_spike(["--users", "3", "--socket-editors", "0", "--plateau-s", "5", "--ramp-s", "1", "--ramp-down-s", "1", ...base()], env());
    expect(r.code).toBe(0);
    expect(r.out).not.toContain("WF-30");
    expect(await count("select count(*) as n from probe_run where kind = 'yjs'")).toBe(yjs_before);
    expect(await count("select count(*) as n from lesson where id like 'G6.U9.L9%'")).toBe(lessons_before);
  }, 120_000);

  it("refuses_without_collab_url", async () => {
    const before = await count("select count(*) as n from probe_run");
    const r = await npm_spike(["--users", "3", "--socket-editors", "3", "--plateau-s", "5", ...base()], env());
    expect(r.code).toBe(2);
    expect(r.err).toContain("--collab-url");
    expect(await count("select count(*) as n from probe_run")).toBe(before);
  }, 60_000);
});
