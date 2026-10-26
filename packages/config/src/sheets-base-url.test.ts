import { describe, expect, it } from "vitest";
import { ConfigError } from "./errors.ts";
import { load_web_settings } from "./settings.ts";

const BASE = { DATABASE_URL: "postgres://u:p@h:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" };

describe("sheets_base_url loader guard", () => {
  it("sheets_base_url: unset gives the Google origin", () => {
    expect(load_web_settings(BASE).sheets_base_url).toBe("https://docs.google.com");
  });
  it("sheets_base_url: loopback in stub mode is accepted and the path is dropped", () => {
    const s = load_web_settings({ ...BASE, MODEL_PROVIDER_MODE: "stub", SHEETS_BASE_URL: "http://127.0.0.1:4010/anything" });
    expect(s.sheets_base_url).toBe("http://127.0.0.1:4010");
  });
  it("sheets_base_url: loopback in real mode fails at boot", () => {
    expect(() =>
      load_web_settings({ ...BASE, MODEL_PROVIDER_MODE: "real", ANTHROPIC_API_KEY: "x", SHEETS_BASE_URL: "http://127.0.0.1:4010" }),
    ).toThrow(ConfigError);
  });
  it("sheets_base_url: a foreign host in stub mode fails at boot", () => {
    expect(() => load_web_settings({ ...BASE, MODEL_PROVIDER_MODE: "stub", SHEETS_BASE_URL: "https://evil.example" })).toThrow(ConfigError);
  });
  it("sheets_base_url: a malformed scheme fails", () => {
    expect(() => load_web_settings({ ...BASE, MODEL_PROVIDER_MODE: "stub", SHEETS_BASE_URL: "ftp://127.0.0.1" })).toThrow(ConfigError);
  });
});
