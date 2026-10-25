// RT-1 AC-6 / AC-7 FROZEN (boundary + invariant). Do not edit.
// Real mode builds in the web container, and the canary key never shows in log lines, error text or the deps object.
// No network: the adapter is only constructed, never called. Canary string only, no real key.
import { inspect } from "node:util";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SecretStr } from "@ls/config/secret";
import { load_web_settings, type WebSettings } from "@ls/config/settings";

const captured = vi.hoisted(() => ({ deps: [] as unknown[] }));
vi.mock("./wiring/runs.ts", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./wiring/runs.ts")>();
  return { ...orig, wire_runs: (d: never) => (captured.deps.push(d), orig.wire_runs(d)) };
});

import { SERVICES_KEY, build_web_services } from "./container.ts";

const CANARY = "sk-ant-TESTMARKER-9f3";
const BASE = { DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" };
const reset = () => {
  delete (globalThis as unknown as Record<symbol, unknown>)[SERVICES_KEY];
  captured.deps.length = 0;
};

describe("RT-1 web real mode", () => {
  beforeEach(reset);
  afterEach(() => vi.restoreAllMocks());

  it("real_mode_builds_without_leaking_key (invariant)", () => {
    const out: string[] = [];
    const grab = (c: unknown): boolean => (out.push(String(c)), true);
    vi.spyOn(process.stdout, "write").mockImplementation(grab as never);
    vi.spyOn(process.stderr, "write").mockImplementation(grab as never);
    for (const m of ["log", "info", "warn", "error", "debug"] as const) vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void out.push(a.map(String).join(" ")));

    const base = load_web_settings(BASE);
    const keyed: WebSettings = { ...base, model: { ...base.model, model_provider_mode: "real", anthropic_api_key: new SecretStr(CANARY) } };
    const s = build_web_services(keyed);
    expect(s.logger).toBeDefined();
    s.logger.info("probe", { extra: { note: "after build" } });

    expect(captured.deps).toHaveLength(1);
    const deps = captured.deps[0] as { model_client: { complete: unknown } };
    // A real client, not the "NOT BUILT" proxy: reading complete must not throw.
    expect(typeof deps.model_client.complete).toBe("function");
    // Refrozen RT-1: PrefixedIdGenerator holds a BigInt, which plain JSON.stringify rejects; stringify with a bigint-safe replacer.
    expect(JSON.stringify(deps, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v))).not.toContain(CANARY);
    expect(inspect(deps, { depth: 6, showHidden: true })).not.toContain(CANARY);
    expect(String(deps.model_client)).not.toContain(CANARY);
    expect(out.join("\n")).not.toContain(CANARY);
  });

  it("real_without_key_error_has_no_marker (boundary)", () => {
    const base = load_web_settings(BASE);
    const no_key: WebSettings = { ...base, model: { ...base.model, model_provider_mode: "real", anthropic_api_key: null } };
    let thrown: unknown;
    try {
      build_web_services(no_key);
    } catch (e) {
      thrown = e;
    }
    expect((thrown as Error).name).toBe("ConfigError");
    expect(String(thrown)).not.toContain(CANARY);
  });
});
