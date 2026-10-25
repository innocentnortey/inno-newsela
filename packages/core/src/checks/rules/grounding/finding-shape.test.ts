import { describe, expect, it } from "vitest";
import { CHECK_POLICY } from "../../policy.ts";
import { build_planted, load_plants } from "./fixtures/build.ts";
import { RULES } from "./index.ts";

const KEYS = ["kind", "level", "message", "address", "span_anchor", "related_lesson_id", "code"];

describe("grounding finding shape", () => {
  it("every finding has all 7 keys, null extras and no planted text", () => {
    const plants = load_plants();
    let seen = 0;
    for (const plant of plants) {
      const ctx = build_planted(plant);
      for (const f of RULES.flatMap((r) => r.run(ctx, CHECK_POLICY))) {
        seen += 1;
        expect(Object.keys(f).sort()).toEqual([...KEYS].sort());
        for (const k of KEYS) expect((f as Record<string, unknown>)[k]).not.toBeUndefined();
        expect(f.message.length).toBeGreaterThan(0);
        expect(f.span_anchor).toBeNull();
        expect(f.related_lesson_id).toBeNull();
        expect(f.code).toBeNull();
        for (const p of plants) expect(f.message).not.toContain(p.needle);
      }
    }
    expect(seen).toBeGreaterThan(11);
  });
});
