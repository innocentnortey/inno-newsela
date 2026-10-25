import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHECK_KINDS } from "./types.ts";
import { build_registry, CHECK_RULES, RULE_GROUPS } from "./registry.ts";
import { DEFAULT_POLICY, make_ctx, reading_lesson } from "./test-helpers.ts";

const STRUCTURAL = [
  "schema_invalid",
  "section_missing",
  "minutes_out_of_range",
  "vocabulary_word_missing",
];

describe("registry", () => {
  it("holds 28 rules in CheckKind order", () => {
    expect(CHECK_RULES).toHaveLength(28);
    expect(CHECK_RULES.map((r) => r.kind)).toEqual([...CHECK_KINDS]);
  });

  it("has a file per rule at rules/<group>/<kind>.ts", () => {
    for (const [group, rules] of Object.entries(RULE_GROUPS)) {
      for (const r of rules) {
        const url = new URL(`./rules/${group}/${r.kind}.ts`, import.meta.url);
        expect(existsSync(url), `${group}/${r.kind}`).toBe(true);
      }
    }
    expect(Object.values(RULE_GROUPS).flat()).toHaveLength(28);
  });

  it("24 non-structural rules return [] on a rich context", () => {
    const ctx = make_ctx(reading_lesson(), ["word"]);
    const stubs = CHECK_RULES.filter((r) => !STRUCTURAL.includes(r.kind));
    expect(stubs).toHaveLength(24);
    for (const r of stubs) expect(r.run(ctx, DEFAULT_POLICY)).toEqual([]);
  });

  it("build_registry throws on missing, duplicate or unknown kinds", () => {
    const groups = Object.values(RULE_GROUPS);
    const flat = groups.flat();
    expect(() => build_registry([flat.slice(1)])).toThrow(/no rule for kind/);
    expect(() => build_registry([flat, flat.slice(0, 1)])).toThrow(
      /duplicate rule for kind/,
    );
    const extra = {
      kind: "new_kind",
      level: "blocking",
      run: () => [],
    } as never;
    expect(() => build_registry([flat, [extra]])).toThrow(/unknown kind/);
  });
});
