import { describe, expect, it } from "vitest";
import { CHECK_POLICY } from "../../policy.ts";
import type { CheckKind } from "../../types.ts";
import { build_ctx, build_planted, load_plants } from "./fixtures/build.ts";
import { collect } from "./fields.ts";
import { page_out_of_range_rule } from "./page_out_of_range.ts";
import { proper_noun_unsourced_rule } from "./proper_noun_unsourced.ts";
import { quote_unmatched_rule } from "./quote_unmatched.ts";

const RULES = [quote_unmatched_rule, page_out_of_range_rule, proper_noun_unsourced_rule];
const run = (ctx: ReturnType<typeof build_ctx>, kind: CheckKind) =>
  RULES.flatMap((r) => r.run(ctx, CHECK_POLICY)).filter((f) => f.kind === kind);

describe("seeded plants", () => {
  const plants = load_plants();
  it("has 12 plants, 11 code-detectable", () => {
    expect(plants).toHaveLength(12);
    expect(plants.filter((p) => p.code_detectable)).toHaveLength(11);
  });

  for (const plant of plants.filter((p) => p.code_detectable)) {
    it(`${plant.id} is caught at the plant's address`, () => {
      const kind = plant.expected_kind as CheckKind;
      const ctx = build_planted(plant);
      const address = collect(ctx).fields.find((f) => f.text.includes(plant.needle))?.address;
      expect(address).toBeDefined();
      const base = run(build_ctx(plant.fixture), kind).filter((f) => f.address === address);
      const hits = run(ctx, kind).filter((f) => f.address === address);
      expect(hits.length).toBeGreaterThan(base.length);
    });
  }

  it("P05 (nameless invented event) is reported as not caught by code", () => {
    const plant = plants.find((p) => p.id === "P05")!;
    expect(plant.code_detectable).toBe(false);
    const base = RULES.flatMap((r) => r.run(build_ctx(plant.fixture), CHECK_POLICY));
    const seeded = RULES.flatMap((r) => r.run(build_planted(plant), CHECK_POLICY));
    expect(seeded).toHaveLength(base.length);
  });
});
