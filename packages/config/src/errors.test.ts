// NL-01 AC-6 (frozen, risk::security). Failure mode: negative/boundary - a ConfigError names the
// variable and never echoes a supplied value (OBS-7).
import { describe, expect, it } from "vitest";
import { ConfigError } from "./errors.ts";
import { load_web_settings, load_worker_settings } from "./settings.ts";

const MARKER = "sk-ant-TESTMARKER-9f3";
const BASE = {
  DATABASE_URL: "postgres://u:p@h:5432/d",
  AUDIT_HASH_SALT: "s",
  COLLAB_INTERNAL_TOKEN: "t",
};

function capture(fn: () => unknown): ConfigError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ConfigError);
    return e as ConfigError;
  }
  throw new Error("expected ConfigError, nothing thrown");
}

function expectNoLeak(err: ConfigError, values: string[]) {
  const haystacks = [err.message, err.problem, err.variable, JSON.stringify(err), String(err.stack ?? "")];
  for (const h of haystacks) {
    expect(h).not.toContain(MARKER);
    for (const v of values) expect(h).not.toContain(v);
  }
}

describe("NL-01 AC-6 ConfigError [boundary/negative]", () => {
  it("missing DATABASE_URL names the variable", () => {
    const { DATABASE_URL: _omit, ...env } = BASE;
    const err = capture(() => load_web_settings(env));
    expect(err.variable).toBe("DATABASE_URL");
    expect(err.name).toBe("ConfigError");
    expect(err.message).toContain("DATABASE_URL");
    expectNoLeak(err, []);
  });

  it("GENERATION_CONCURRENCY=9 (range 1-6) names the variable, message lacks the value", () => {
    const err = capture(() => load_worker_settings({ ...BASE, GENERATION_CONCURRENCY: "9" }));
    expect(err.variable).toBe("GENERATION_CONCURRENCY");
    expect(err.message).not.toContain("9");
    expectNoLeak(err, ["9"]);
  });

  it("MODEL_PROVIDER_MODE=real without ANTHROPIC_API_KEY names the key", () => {
    const err = capture(() => load_web_settings({ ...BASE, MODEL_PROVIDER_MODE: "real" }));
    expect(err.variable).toBe("ANTHROPIC_API_KEY");
    expectNoLeak(err, []);
  });

  it("malformed DATABASE_URL carrying the marker does not echo it", () => {
    const err = capture(() => load_web_settings({ ...BASE, DATABASE_URL: `not a url ${MARKER}` }));
    expect(err.variable).toBe("DATABASE_URL");
    expectNoLeak(err, [MARKER]);
  });

  it("malformed MODEL_EFFORT carrying the marker does not echo it", () => {
    const err = capture(() => load_web_settings({ ...BASE, MODEL_EFFORT: MARKER }));
    expect(err.variable).toBe("MODEL_EFFORT");
    expectNoLeak(err, [MARKER]);
  });

  it("marker planted in userinfo of a valid URL never appears in an unrelated error", () => {
    const err = capture(() =>
      load_worker_settings({
        ...BASE,
        DATABASE_URL: `postgres://u:${MARKER}@h:5432/d`,
        GENERATION_CONCURRENCY: "9",
      }),
    );
    expect(err.variable).toBe("GENERATION_CONCURRENCY");
    expectNoLeak(err, [MARKER, "9"]);
  });
});
