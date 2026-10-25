import { describe, expect, it } from "vitest";
import { CHECK_POLICY } from "../../policy.ts";
import type { CheckContext } from "../../types.ts";
import { build_ctx } from "./fixtures/build.ts";
import { proper_noun_unsourced_rule } from "./proper_noun_unsourced.ts";

const planted = (): CheckContext =>
  build_ctx("wp1", {
    mutate: (d) => {
      d.blocks[16]!.cfu!.rationales[3] += " Grover also gets into trouble.";
      d.blocks[1]!.text += " Grover comes up in the next chapter.";
    },
  });
const run = (ctx: CheckContext, policy = CHECK_POLICY) =>
  proper_noun_unsourced_rule.run(ctx, policy);

describe("name scan level by location", () => {
  it("is blocking in a CFU rationale and advisory elsewhere", () => {
    const found = run(planted());
    expect(found.filter((f) => f.level === "blocking")).toHaveLength(1);
    expect(found.filter((f) => f.level === "advisory")).toHaveLength(1);
  });
  it("is blocking everywhere when the policy says so", () => {
    const found = run(planted(), { ...CHECK_POLICY, name_scan_scope: "blocking_everywhere" });
    expect(found).toHaveLength(2);
    expect(found.every((f) => f.level === "blocking")).toBe(true);
  });
  it("ignores an allow-listed word", () => {
    const ctx = build_ctx("wp1", { mutate: (d) => { d.blocks[1]!.text += " Then Launch the routine."; } });
    expect(run(ctx)).toEqual([]);
  });
  it("ignores a name the row gives", () => {
    const ctx = planted();
    const row = { ...ctx.row, title: "Grover Camp" };
    expect(run({ ...ctx, row })).toEqual([]);
  });
});
