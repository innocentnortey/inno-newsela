// AC-2: every example in the OpenAPI document parses with its component's mirror.
import { describe, expect, it } from "vitest";
import { collectExamples, loadSpec, mirrors } from "./oracle.ts";

const examples = collectExamples(loadSpec());

describe("openapi examples", () => {
  it("finds 65 examples", () => {
    expect(examples.map((e) => e.where).length, examples.map((e) => e.where).join("\n")).toBe(65);
  });
  it.each(examples.map((e) => [e.where, e] as const))("%s parses", (_where, e) => {
    const mirror = mirrors[e.schemaName];
    expect(mirror, `no mirror ${e.schemaName}`).toBeDefined();
    const items = e.isArrayItems ? (e.value as unknown[]) : [e.value];
    for (const item of items) {
      const r = mirror!.safeParse(item);
      expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    }
  });
});
