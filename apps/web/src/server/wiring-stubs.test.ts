import { describe, expect, it } from "vitest";
import type { WebDeps } from "./deps.ts";

// Every service is wired now (NL-102 was the last stub); the slot names are checked by wiring/exports.test.ts.
describe("NL-06 AC-4 wiring stubs", () => {
  it("wire_exports is built and exposes the exports slot", async () => {
    const mod = (await import("./wiring/exports.ts")) as Record<string, (d: WebDeps) => Record<string, unknown>>;
    expect(mod["wire_exports"]).toBeTypeOf("function");
    expect(mod["wire_exports"]!.name).toBe("wire_exports");
  });
});
