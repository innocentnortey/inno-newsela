// NL-01 AC-7 (frozen, risk::security). Failure mode: invariant - a planted secret never leaves a
// SecretStr through any serialisation path (OBS-7, GR-13).
import { inspect } from "node:util";
import { describe, expect, it } from "vitest";
import { SecretStr } from "./secret.ts";

const MARKER = "sk-ant-TESTMARKER-9f3";

describe("NL-01 AC-7 SecretStr [invariant]", () => {
  const s = new SecretStr(MARKER);

  it("JSON.stringify prints [redacted]", () => {
    const out = JSON.stringify({ a: s });
    expect(out).toContain("[redacted]");
    expect(out).not.toContain(MARKER);
  });

  it("String() prints [redacted]", () => {
    expect(String(s)).toBe("[redacted]");
  });

  it("template literal prints [redacted]", () => {
    expect(`${s}`).toBe("[redacted]");
  });

  it("util.inspect prints [redacted], also nested", () => {
    expect(inspect(s)).toContain("[redacted]");
    expect(inspect(s)).not.toContain(MARKER);
    expect(inspect({ deep: { s } }, { depth: 5 })).not.toContain(MARKER);
  });

  it("toString and toJSON are [redacted]; reveal() is the only way to read the value", () => {
    expect(s.toString()).toBe("[redacted]");
    expect(s.toJSON()).toBe("[redacted]");
    expect(s.reveal()).toBe(MARKER);
  });

  it("value is not an own enumerable property", () => {
    expect(Object.keys(s)).toEqual([]);
    expect(JSON.stringify(Object.entries(s))).not.toContain(MARKER);
    expect(Object.getOwnPropertyNames(s).join(",")).not.toContain("value");
  });
});
