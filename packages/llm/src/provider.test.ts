// RT-1 AC-5 / AC-7 FROZEN. Do not edit. Canary strings only; no network, no real key.
import { readFileSync } from "node:fs";
import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { ConfigError } from "@ls/config/errors";
import { SecretStr } from "@ls/config/secret";
import { load_worker_settings, type ModelSettings } from "@ls/config/settings";
import { SystemClock } from "@ls/core/ports/clock";
import { AnthropicMessagesAdapter, map_error } from "./anthropic.ts";
import { build_model_client } from "./provider.ts";
import { StubModelClient } from "./stub.ts";

const MARKER = "sk-ant-TESTMARKER-9f3";
const clock = new SystemClock();
const model = (over: Partial<ModelSettings>): ModelSettings => ({ ...load_worker_settings({ DATABASE_URL: "postgres://u:p@localhost:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" }).model, ...over });

describe("build_model_client", () => {
  it("stub_mode_gives_stub (invariant)", () => {
    expect(build_model_client(model({ model_provider_mode: "stub" }), clock)).toBeInstanceOf(StubModelClient);
  });

  it("stub_mode_ignores_a_configured_key (invariant)", () => {
    const c = build_model_client(model({ model_provider_mode: "stub", anthropic_api_key: new SecretStr(MARKER) }), clock);
    expect(c).toBeInstanceOf(StubModelClient);
  });

  it("real_mode_gives_adapter (invariant)", () => {
    const c = build_model_client(model({ model_provider_mode: "real", anthropic_api_key: new SecretStr(MARKER) }), clock);
    expect(c).toBeInstanceOf(AnthropicMessagesAdapter);
  });

  it("real_without_key_throws_config_error (boundary)", () => {
    let thrown: unknown;
    try {
      build_model_client(model({ model_provider_mode: "real", anthropic_api_key: null }), clock);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ConfigError);
    expect((thrown as ConfigError).variable).toBe("ANTHROPIC_API_KEY");
  });

  it("no_key_in_error_or_inspect (invariant: AC-7)", () => {
    const c = build_model_client(model({ model_provider_mode: "real", anthropic_api_key: new SecretStr(MARKER) }), clock);
    expect(String(c)).not.toContain(MARKER);
    expect(inspect(c, { depth: 8, showHidden: true })).not.toContain(MARKER);
    expect(JSON.stringify(c)).not.toContain(MARKER);
    const err = map_error(Object.assign(new Error("upstream failed"), { status: 401, headers: { "x-api-key": MARKER } }));
    expect(err.message + String(err) + JSON.stringify(err)).not.toContain(MARKER);
  });

  it("provider_source_has_no_file_env_or_base_url (invariant: AC-7 grep check)", () => {
    const src = readFileSync(new URL("./provider.ts", import.meta.url), "utf8");
    expect(src).not.toMatch(/readFileSync|readFile\(|dotenv|process\.env|base_url|client_override|logger/);
  });
});
