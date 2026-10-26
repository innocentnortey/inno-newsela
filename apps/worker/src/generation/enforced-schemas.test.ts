// GEN-8: every schema we can send to a schema-enforced call is free of keywords the provider rejects (after the
// adapter boundary), and Zod still enforces the bounds after the call.
import { describe, expect, it } from "vitest";
import { sanitize_schema_for_anthropic, UNSUPPORTED_KEYWORDS } from "@ls/llm/schema-sanitize";
import { SCHEMA_NAMES, SchemaRegistry } from "@ls/prompts/schemas";
import { LessonDraft } from "@ls/schema/lesson-draft";
import { UnitPlanDraft } from "@ls/schema/unit-plan";

function keywords(n: unknown, out: Set<string> = new Set(), in_properties = false): Set<string> {
  if (Array.isArray(n)) n.forEach((x) => keywords(x, out));
  else if (n !== null && typeof n === "object") {
    for (const [k, v] of Object.entries(n)) {
      if (!in_properties) out.add(k);
      keywords(v, out, k === "properties");
    }
  }
  return out;
}

describe("schemas sent to the provider", () => {
  const registry = new SchemaRegistry();
  for (const name of SCHEMA_NAMES) {
    it(`${name}: sanitised schema has no unsupported keyword`, () => {
      const kw = keywords(sanitize_schema_for_anthropic(registry.json_schema(name)));
      for (const bad of UNSUPPORTED_KEYWORDS) expect(kw.has(bad), `${name} still has ${bad}`).toBe(false);
      const minimal = JSON.stringify(sanitize_schema_for_anthropic(registry.json_schema(name)));
      expect(minimal).not.toMatch(/"minItems":([2-9]|\d\d)/);
    });
  }

  it("the raw UnitPlanDraft schema does carry the integer bounds the provider rejected (guards the test itself)", () => {
    expect(keywords(registry.json_schema("UnitPlanDraft")).has("minimum")).toBe(true);
  });
});

describe("Zod still enforces the bounds the schema no longer states", () => {
  const entry = { lesson_id: "G6.U4.L1", day: 1, purpose: "p", routines: [], hands_forward: "h", performance_task_thread: "t" };
  it("UnitPlanDraft rejects day 0, a negative day and an empty plan", () => {
    expect(UnitPlanDraft.safeParse({ entries: [entry] }).success).toBe(true);
    expect(UnitPlanDraft.safeParse({ entries: [{ ...entry, day: 0 }] }).success).toBe(false);
    expect(UnitPlanDraft.safeParse({ entries: [{ ...entry, day: -3 }] }).success).toBe(false);
    expect(UnitPlanDraft.safeParse({ entries: [] }).success).toBe(false);
  });
  it("LessonDraft still has its own bounds", () => {
    expect(LessonDraft.safeParse({}).success).toBe(false);
  });
});
