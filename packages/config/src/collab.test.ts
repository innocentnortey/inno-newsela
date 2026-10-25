// NL-01 AC-8: collab needs no model settings; stub mode needs no key.
import { describe, expect, it } from "vitest";
import { load_collab_settings, load_web_settings, load_worker_settings } from "./settings.ts";

const BASE = { DATABASE_URL: "postgres://u:p@h:5432/d", AUDIT_HASH_SALT: "s", COLLAB_INTERNAL_TOKEN: "t" };

describe("NL-01 AC-8 collab/stub isolation", () => {
  it("collab loads with only DATABASE_URL + COLLAB_INTERNAL_TOKEN, ignoring bad MODEL_* vars", () => {
    const s = load_collab_settings({
      DATABASE_URL: BASE.DATABASE_URL,
      COLLAB_INTERNAL_TOKEN: "t",
      MODEL_EFFORT: "bogus",
      MODEL_PROVIDER_MODE: "real",
    });
    expect("model" in s).toBe(false);
    expect("spend" in s).toBe(false);
  });
  it("web in stub mode without a key succeeds", () => {
    expect(load_web_settings(BASE).model.anthropic_api_key).toBeNull();
  });
  it("worker in stub mode without a key succeeds", () => {
    expect(load_worker_settings(BASE).model.model_provider_mode).toBe("stub");
  });
});
