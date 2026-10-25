// NL-86 AC-1: the driver against a Prism mock of docs/contracts/interface.openapi.yaml (started with --errors, so a malformed request fails).
import { spawn, type ChildProcess } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { FullRunDriver } from "./driver.ts";
import type { DriverConfig } from "./types.ts";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const PORT = Number(process.env["PRISM_TEST_PORT"] ?? "4096");
// Prism serves the paths without the spec's /api server prefix (checked: /prompt-versions answers, /api/prompt-versions is a 404).
const BASE = `http://127.0.0.1:${PORT}`;
let prism: ChildProcess;

beforeAll(async () => {
  prism = spawn(path.join(ROOT, "node_modules/.bin/prism"), ["mock", path.join(ROOT, "docs/contracts/interface.openapi.yaml"), "-p", String(PORT), "--errors"], { stdio: "ignore" });
  const t0 = Date.now();
  for (;;) {
    try { await fetch(`${BASE}/prompt-versions`); return; } catch { /* not listening yet */ }
    if (Date.now() - t0 > 30_000) throw new Error("Prism did not start");
    await new Promise((r) => setTimeout(r, 250));
  }
}, 40_000);
afterAll(() => { prism.kill(); });

const OPS: [RegExp, string, string][] = [
  [/^POST \/session$/, "", "signIn"], [/^POST \/outline-versions$/, "", "uploadOutline"], [/^GET \/outline-versions\/[^/]+\/report$/, "", "getValidationReport"],
  [/^POST \/outline-versions\/[^/]+\/choices$/, "", "recordIntakeChoice"], [/^GET \/prompt-versions$/, "", "listPromptVersions"], [/^POST \/runs$/, "", "startRun"],
  [/^GET \/runs\/[^/]+\/progress$/, "", "getRunProgress"], [/^GET \/runs\/[^/]+\/summary$/, "", "getRunSummary"],
];

describe("full-run driver against Prism", () => {
  it("drives_whole_sequence_against_prism", async () => {
    const seen: string[] = [];
    const statuses: number[] = [];
    let idem: string | null = null;
    let progress_polls = 0;
    const wrapped: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      const key = `${init?.method ?? "GET"} ${url.pathname}`;
      seen.push(OPS.find(([re]) => re.test(key))?.[2] ?? key);
      const headers = new Headers(init?.headers);
      if (key === "POST /runs") idem = headers.get("idempotency-key");
      // Prism enforces the cookie apiKey scheme but its mock never sets a cookie, so the test supplies a fixed synthetic one.
      if (!headers.has("cookie")) headers.set("cookie", "ls_session=mock-session-synthetic");
      const res = await fetch(input, { ...init, headers });
      statuses.push(res.status);
      if (/\/progress$/.test(url.pathname)) {
        progress_polls++;
        // Prism's only progress example is `running` and the mock is stateless: pass the first poll through, report `complete` from the second.
        if (progress_polls >= 2) {
          const body = (await res.json()) as Record<string, unknown>;
          return new Response(JSON.stringify({ ...body, state: "complete" }), { status: res.status, headers: res.headers });
        }
      }
      return res;
    };
    const cfg: DriverConfig = {
      base_url: BASE, email: "driver@example.test", password: "synthetic-pass", unit: "G6-U4",
      outline_path: path.join(ROOT, "docs/data/samples/synthetic-2026-10-24-syn2-layout-shifted.csv"),
      provider_mode: "stub", cap_usd: 75, prompt_version_id: null, poll_ms: 2000, max_wall_ms: 7_200_000,
      fetch: wrapped, sleep: async () => {}, log: () => {},
    };
    const r = await new FullRunDriver(cfg).run();
    const violations = statuses.filter((s) => s < 200 || s > 299).length;
    expect(violations, `${violations} contract violations in ${statuses.length} calls`).toBe(0);
    const choices = seen.filter((o) => o === "recordIntakeChoice").length;
    expect(choices).toBeGreaterThanOrEqual(1);
    expect(seen).toEqual([
      "signIn", "uploadOutline", "getValidationReport", ...Array<string>(choices).fill("recordIntakeChoice"),
      "listPromptVersions", "startRun", "getRunProgress", "getRunProgress", "getRunSummary",
    ]);
    expect(idem).toMatch(/^full-run-G6-U4-[0-9a-f]{16}$/);
    expect(typeof r.summary.n).toBe("number");
    expect(r.run_id).toBeTruthy();
    expect(r.polls).toBe(2);
  }, 60_000);
});
