// NL-49
import { InvariantViolation } from "@ls/core/errors";
import { describe, expect, it } from "vitest";
import { make_leak_guard } from "./leak-guard.ts";

const KEY = "env-secret-value-1234";
const guard = make_leak_guard({ SOME_API_KEY: KEY, PATH: "/usr/bin" });

describe("leak guard", () => {
  it("clean value passes", () => expect(() => guard("x", { a: "fine" })).not.toThrow());
  it.each([KEY, "sk-test-NL49", "docs/source/restricted/x.md"])("blocks %s without echoing it", (bad) => {
    let err: unknown;
    try { guard("case:1", { v: bad }); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(InvariantViolation);
    const e = err as InvariantViolation;
    expect(e.message).not.toContain(bad);
    expect(JSON.stringify(e.details)).not.toContain(bad);
  });
});
