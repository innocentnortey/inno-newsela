import { describe, expect, it } from "vitest";
import type { WebDeps } from "./deps.ts";

const CASES: [string, string, string[]][] = [
  ["review", "wire_review", ["lesson_reads", "issues", "slots", "candidates", "transitions", "approvals"]],
  ["assist", "wire_assist", ["suggestions"]],
  ["exports", "wire_exports", ["exports"]],
  ["coverage", "wire_coverage", ["coverage"]],
];

describe("NL-06 AC-4 wiring stubs", () => {
  it.each(CASES)("%s exports %s and leaves every slot unset", async (file, fn, keys) => {
    const mod = (await import(`./wiring/${file}.ts`)) as Record<string, (d: WebDeps) => Record<string, unknown>>;
    const wire = mod[fn];
    expect(wire).toBeTypeOf("function");
    expect(wire!.name).toBe(fn);
    const out = wire!({} as WebDeps);
    expect(Object.keys(out).sort()).toEqual([...keys].sort());
    for (const k of keys) expect(out[k]).toBeUndefined();
  });
});
