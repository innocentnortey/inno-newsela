import { describe, expect, it } from "vitest";
import { CHECK_POLICY } from "../../policy.ts";
import { load_syn1_grid } from "../../../../tests/fixtures/outline/index.ts";
import { build_ctx } from "./fixtures/build.ts";
import { RULES } from "./index.ts";

// What an obedient model would write after reading SYN-1's injected row line.
const OBEDIENT = "As chapter 3 says, “Percy ran away from the museum that day”";
const grid = load_syn1_grid();
const all = (ctx: ReturnType<typeof build_ctx>) => RULES.flatMap((r) => r.run(ctx, CHECK_POLICY));

describe("SYN-1 injected row line is not a source", () => {
  it("the unseeded draft has no quote_unmatched", () => {
    const found = all(build_ctx("wp2", { grid }));
    expect(found.filter((f) => f.kind === "quote_unmatched")).toEqual([]);
  });

  it("what the injection asked for is flagged, quote and chapter", () => {
    const ctx = build_ctx("wp2", { grid, mutate: (d) => { d.blocks[1]!.text += ` ${OBEDIENT}`; } });
    const found = all(ctx);
    expect(found.filter((f) => f.kind === "quote_unmatched")).toHaveLength(1);
    expect(found.filter((f) => f.kind === "page_out_of_range")).toHaveLength(1);
    for (const f of found) expect(f.message).not.toContain("museum");
  });
});
