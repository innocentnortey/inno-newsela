import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigError } from "@ls/config/errors";
import { SecretStr } from "@ls/config/secret";
import { load_web_settings, type WebSettings } from "@ls/config/settings";
import { SERVICES_KEY, build_web_services } from "./container.ts";
import { wire_assist } from "./wiring/assist.ts";
import { wire_coverage } from "./wiring/coverage.ts";
import { wire_exports } from "./wiring/exports.ts";
import { wire_metrics } from "./wiring/metrics.ts";
import { wire_outlines } from "./wiring/outlines.ts";
import { wire_prompts } from "./wiring/prompts.ts";
import { wire_review } from "./wiring/review.ts";
import { wire_runs } from "./wiring/runs.ts";
import { wire_sessions } from "./wiring/sessions.ts";

const BASE = { DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" };
const settings = (): WebSettings => load_web_settings(BASE);
const reset = () => {
  delete (globalThis as unknown as Record<symbol, unknown>)[SERVICES_KEY];
};

const SPIED = [wire_sessions, wire_outlines, wire_runs, wire_review, wire_metrics, wire_assist, wire_prompts, wire_exports, wire_coverage];

describe("NL-06 container", () => {
  beforeEach(reset);

  it("unbuilt_access_throws: reading an unset service names its owner", () => {
    const s = build_web_services(settings());
    expect(() => s.sessions).toThrow(/NOT BUILT: NL-25/);
    expect(() => s.coverage).toThrow(/NOT BUILT: NL-91/);
    expect(s.logger).toBeDefined();
  });

  it("cached_once: the second call returns the same object", () => {
    const a = build_web_services(settings());
    expect(build_web_services(settings())).toBe(a);
  });

  it("real_mode_requires_key", () => {
    const base = settings();
    const no_key: WebSettings = { ...base, model: { ...base.model, model_provider_mode: "real", anthropic_api_key: null } };
    try {
      build_web_services(no_key);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as ConfigError).variable).toBe("ANTHROPIC_API_KEY");
    }
    const marker = "sk-ant-TESTMARKER-9f3";
    const keyed: WebSettings = {
      ...base,
      model: { ...base.model, model_provider_mode: "real", anthropic_api_key: new SecretStr(marker) },
    };
    try {
      build_web_services(keyed);
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toContain(marker);
      expect((e as Error).message).toContain("NOT BUILT: NL-32");
    }
  });

  it("merges_nine_wirings: wire_* ran in DO-3 order, once each", async () => {
    const order: string[] = [];
    vi.resetModules();
    for (const [file, fn, keys] of [
      ["sessions", "wire_sessions", ["sessions"]],
      ["outlines", "wire_outlines", ["outlines"]],
      ["runs", "wire_runs", ["runs"]],
      ["review", "wire_review", ["lesson_reads", "issues", "slots", "candidates", "transitions", "approvals"]],
      ["metrics", "wire_metrics", ["board", "heartbeats"]],
      ["assist", "wire_assist", ["suggestions"]],
      ["prompts", "wire_prompts", ["prompts"]],
      ["exports", "wire_exports", ["exports"]],
      ["coverage", "wire_coverage", ["coverage"]],
    ] as [string, string, string[]][]) {
      vi.doMock(`./wiring/${file}.ts`, () => ({
        [fn]: () => {
          order.push(fn);
          return Object.fromEntries(keys.map((k) => [k, { marker: k }]));
        },
      }));
    }
    const fresh = await import("./container.ts");
    delete (globalThis as unknown as Record<symbol, unknown>)[fresh.SERVICES_KEY];
    const s = fresh.build_web_services(settings());
    fresh.build_web_services(settings());
    expect(order).toEqual(SPIED.map((f) => f.name));
    expect(s.sessions).toEqual({ marker: "sessions" });
    expect(s.approvals).toEqual({ marker: "approvals" });
    expect(s.logger).toBeDefined();
    vi.doUnmock("./wiring/sessions.ts");
    vi.resetModules();
  });
});
