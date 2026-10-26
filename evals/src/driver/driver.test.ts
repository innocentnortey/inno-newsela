// NL-86 AC-2, AC-3 and the driver's polling and logging behaviour, over a fake fetch (no network).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolve_cap } from "./cap.ts";
import { FullRunDriver } from "./driver.ts";
import { main } from "./main.ts";
import { DriverError, type DriverConfig } from "./types.ts";

const DIR = import.meta.dirname;
const OUTLINE = path.resolve(DIR, "../../../docs/data/samples/synthetic-2026-10-24-syn2-layout-shifted.csv");
const PASSWORD = "pw-seeded-marker-0002";
const COOKIE = "tok-seeded-marker-0003";

const json = (body: unknown, status = 200, extra: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...extra } });
const counts = { teaching_days: 0 };

function fake(opts: { states?: string[] } = {}) {
  const calls: string[] = [];
  const seen: Array<{ key: string; origin: string | null; body: unknown }> = [];
  const states = [...(opts.states ?? ["running", "complete"])];
  const f: typeof fetch = async (input, init) => {
    const p = new URL(String(input)).pathname;
    const key = `${init?.method ?? "GET"} ${p}`;
    calls.push(key);
    seen.push({ key, origin: new Headers(init?.headers).get("origin"), body: typeof init?.body === "string" ? JSON.parse(init.body) : null });
    if (key === "POST /api/session") return json({ user: {}, expires_at: "t" }, 200, { "set-cookie": `ls_session=${COOKIE}; Path=/; HttpOnly` });
    if (key === "POST /api/outline-versions") return json({ outline_version_id: "ov_1", unit_id: "G6.U4", version_number: 1, row_counts: {} }, 201);
    if (key.endsWith("/report")) {
      return json({ outline_version_id: "ov_1", counts, generate_allowed: false, unit: { as_written: "G6.U4", filenames_say: "G6.U3", confirmed: false, confirmed_by: null, finding: { finding_id: "fu", level: "error", kind: "unit_conflict" } }, rows: [{ row_number: 1, level: "error", findings: [
        { finding_id: "f1", level: "error", kind: "malformed_code", proposed_fix: "RL.6.1", choice: null },
        { finding_id: "f2", level: "error", kind: "malformed_code", proposed_fix: "RL.6.2", choice: { source: "confirmed" } },
        { finding_id: "f3", level: "warning", kind: "bad_filename", proposed_fix: null, choice: null },
      ] }] });
    }
    if (key.endsWith("/choices")) return json({ row: {}, counts, generate_allowed: true }, 201);
    if (key === "GET /api/prompt-versions") return json({ current_prompt_version_id: "pv_1", guidance_versions: [] });
    if (key === "POST /api/runs") return json({ run_id: "run_1", state: "planning", outline_version_id: "ov_1", cap_usd: 75 }, 201);
    if (key.endsWith("/progress")) {
      expect(new Headers(init?.headers).get("cookie")).toBe(`ls_session=${COOKIE}`);
      return json({ run_id: "run_1", state: states.shift() ?? "complete", spent_usd: 0, reserved_usd: 0, cap_usd: 75, counts_by_tile_state: {} });
    }
    if (key.endsWith("/summary")) {
      return json({ run_id: "run_1", state: "complete", n: 47, wall_time_seconds: 1, cost_usd: 1, lessons: { ready: 47, failed: 0 }, retries: 0, failures_by_reason: [], placeholders_left: 0, calls_lost_in_flight: 0, truncation_retries: 0 });
    }
    return json({ error: { code: "NOT_FOUND" } }, 404);
  };
  return { f, calls, seen };
}

function cfg(over: Partial<DriverConfig> = {}): DriverConfig {
  return {
    base_url: "http://x.test/api", email: "driver@example.test", password: PASSWORD, unit: "G6-U4", outline_path: OUTLINE, provider_mode: "stub",
    cap_usd: 75, prompt_version_id: null, poll_ms: 2000, max_wall_ms: 7_200_000, fetch: fake().f, sleep: async () => {}, log: () => {}, ...over,
  };
}

describe("driver", () => {
  it("public_api_only_and_env_credentials", () => {
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    expect(files.length).toBeGreaterThanOrEqual(6);
    for (const file of files) {
      const text = fs.readFileSync(path.join(DIR, file), "utf8");
      for (const m of text.matchAll(/(?:from|import)\s+"([^"]+)"/g)) {
        const spec = m[1] as string;
        const ok = spec.startsWith("node:") || spec.startsWith("./") || spec === "../../../docs/contracts/generated/api-types.ts";
        expect(ok, `${file} imports ${spec}`).toBe(true);
      }
      expect(text, file).not.toMatch(/@ls\/|from "pg"|SELECT |INSERT |UPDATE /);
    }
    const main_text = fs.readFileSync(path.join(DIR, "main.ts"), "utf8");
    expect(main_text).toContain('env["DRIVER_EMAIL"]');
    expect(main_text).toContain('env["DRIVER_PASSWORD"]');
    for (const file of files) expect(fs.readFileSync(path.join(DIR, file), "utf8"), file).not.toMatch(/log\([^)]*password/i);
  });

  it("real_mode_requires_cap_within_ceiling", async () => {
    const cases: [string[], Record<string, string>][] = [
      [[], {}], [["--cap-usd", "76"], { BUILD_SPEND_CEILING_USD: "75" }], [["--cap-usd", "abc"], {}], [["--cap-usd", "0"], {}],
    ];
    for (const [extra, env] of cases) {
      const spy = fake();
      const code = await main(["--unit", "G6-U4", "--outline", OUTLINE, "--provider", "real", ...extra], { DRIVER_EMAIL: "a@b.test", DRIVER_PASSWORD: PASSWORD, ...env }, { fetch: spy.f });
      expect(code).toBe(2);
      expect(spy.calls).toHaveLength(0);
    }
    expect(resolve_cap({ provider_mode: "real", cap_arg: "75", env: {} })).toBe(75);
    expect(resolve_cap({ provider_mode: "real", cap_arg: null, env: { DRIVER_CAP_USD: "60" } })).toBe(60);
    expect(resolve_cap({ provider_mode: "stub", cap_arg: null, env: {} })).toBe(75);
    expect(() => resolve_cap({ provider_mode: "real", cap_arg: null, env: {} })).toThrow(DriverError);
  });

  it("main runs a stub run end to end and exits 0", async () => {
    const spy = fake();
    const code = await main(["--unit", "G6-U4", "--outline", OUTLINE], { DRIVER_EMAIL: "a@b.test", DRIVER_PASSWORD: PASSWORD }, { fetch: spy.f, sleep: async () => {}, log: () => {} });
    expect(code).toBe(0);
    expect(spy.calls.filter((c) => c.endsWith("/choices"))).toHaveLength(2); // f1 only: f2 is confirmed, f3 is a warning
  });

  it("refuses without credentials before any request", async () => {
    const spy = fake();
    await expect(new FullRunDriver(cfg({ password: "", fetch: spy.f })).run()).rejects.toMatchObject({ code: "NO_CREDENTIALS" });
    expect(spy.calls).toHaveLength(0);
  });

  it("poll_every_two_seconds", async () => {
    const sleeps: number[] = [];
    const spy = fake({ states: ["running", "running", "complete"] });
    const r = await new FullRunDriver(cfg({ fetch: spy.f, sleep: async (ms) => { sleeps.push(ms); } })).run();
    expect(sleeps).toEqual([2000, 2000]);
    expect(r.polls).toBe(3);
  });

  it("GEN-8: sends an Origin header on every call (the web app's CSRF check), from base_url or the override", async () => {
    const spy = fake();
    await new FullRunDriver(cfg({ fetch: spy.f, base_url: "http://127.0.0.1:3000/api" })).run();
    expect(spy.seen.length).toBeGreaterThan(5);
    for (const c of spy.seen) expect(c.origin, c.key).toBe("http://127.0.0.1:3000");
    const o = fake();
    await new FullRunDriver(cfg({ fetch: o.f, origin: "https://app.example.test" })).run();
    for (const c of o.seen) expect(c.origin).toBe("https://app.example.test");
  });

  it("GEN-8: confirms the unit-conflict finding (confirm_unit, no value) before starting the run", async () => {
    const spy = fake();
    await new FullRunDriver(cfg({ fetch: spy.f })).run();
    const choices = spy.seen.filter((c) => c.key.endsWith("/choices")).map((c) => c.body);
    expect(choices[0]).toEqual({ target_id: "fu", kind: "confirm_unit" });
    expect(choices).toHaveLength(2); // the unit conflict, then the one unconfirmed row error
    expect(spy.calls.indexOf("POST /api/runs")).toBeGreaterThan(spy.calls.lastIndexOf("POST /api/outline-versions/ov_1/choices"));
  });

  it("GEN-8: a paused run stops the polling at once and returns state paused with the run id", async () => {
    const lines: string[] = [];
    const spy = fake({ states: ["running", "paused", "running", "complete"] });
    const r = await new FullRunDriver(cfg({ fetch: spy.f, log: (l) => lines.push(l) })).run();
    expect(r.final_state).toBe("paused");
    expect(r.polls).toBe(2);
    expect(r.run_id).toBe("run_1");
    expect(lines.some((l) => l.includes("paused"))).toBe(true);
  });

  it("GEN-8: a failure after the run started carries the run id for the report", async () => {
    const spy = fake({ states: Array<string>(50).fill("running") });
    const err = (await new FullRunDriver(cfg({ fetch: spy.f, max_wall_ms: 10_000 })).run().catch((e: unknown) => e)) as DriverError;
    expect(err.run_id).toBe("run_1");
    const early = (await new FullRunDriver(cfg({ fetch: async () => json({ user: {} }) })).run().catch((e: unknown) => e)) as DriverError;
    expect(early.run_id).toBeNull();
  });

  it("times out on the injected clock, not the wall clock", async () => {
    const spy = fake({ states: Array<string>(50).fill("running") });
    await expect(new FullRunDriver(cfg({ fetch: spy.f, max_wall_ms: 10_000 })).run()).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("a response missing a required key is a SHAPE error naming the operation", async () => {
    const f: typeof fetch = async () => json({ user: {} });
    await expect(new FullRunDriver(cfg({ fetch: f })).run()).rejects.toThrow(/SHAPE: signIn: key expires_at/);
  });

  it("a non-2xx answer carries the status and error code, never the body", async () => {
    const f: typeof fetch = async () => json({ error: { code: "VALIDATION_INCOMPLETE" }, secret: "body-text" }, 409);
    const err = (await new FullRunDriver(cfg({ fetch: f })).run().catch((e: unknown) => e)) as Error;
    expect(err.message).toMatch(/409.*VALIDATION_INCOMPLETE/);
    expect(err.message).not.toContain("body-text");
  });

  it("no_secret_in_log", async () => {
    const lines: string[] = [];
    await new FullRunDriver(cfg({ log: (l) => lines.push(l) })).run();
    expect(lines.length).toBeGreaterThan(5);
    for (const l of lines) {
      expect(l).not.toContain(PASSWORD);
      expect(l).not.toContain(COOKIE);
      expect(l).toMatch(/^\w+ \d{3} \d+ms$|^run run_1 paused: stopped polling$/);
    }
  });
});
