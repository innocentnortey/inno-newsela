// A wholly absent section has no node to point at: its issue carries the address the compiler assigns.
import { describe, expect, it } from "vitest";
import { merge_resolutions, submit_gate } from "../../gates.ts";
import { DEFAULT_POLICY, gate_state, make_ctx } from "../../test-helpers.ts";
import { build_ctx } from "../grounding/fixtures/build.ts";
import { section_missing_rule } from "./section_missing.ts";

function absent() {
  const full = build_ctx("wp1");
  const compiled_addr = full.lesson.sections.find((s) => s.name === "Learning in Action")!.address;
  const lesson = { ...full.lesson, sections: full.lesson.sections.filter((s) => s.name !== "Learning in Action") };
  const f = section_missing_rule.run({ ...make_ctx(lesson), row: full.row }, DEFAULT_POLICY).filter((x) => x.message === 'Section "Learning in Action" is missing');
  return { compiled_addr, f };
}

describe("absent section", () => {
  it("absent_section_address_is_the_compiled_address", () => {
    const { compiled_addr, f } = absent();
    expect(f).toHaveLength(1);
    expect(f[0]?.address).toBe(compiled_addr);
    // oracle: PRD R-21 and CON-11 line 721, not the helper
    expect(f[0]?.address).toBe("G6.U4.L4.LearningInAction");
    expect(f[0]?.address).not.toBe("G6.U4.L4.LearninginAction");
  });

  it("absent_section_issue_resolves_through_the_gate", () => {
    const { compiled_addr, f } = absent();
    const open = merge_resolutions(f, []);
    expect(open[0]?.resolved).toBe(false);
    const refused = submit_gate(gate_state({ issues: open }));
    expect(refused.allowed).toBe(false);
    expect(JSON.stringify(refused)).toContain("BLOCKED");
    expect(JSON.stringify(refused)).toContain(compiled_addr);

    const resolved = merge_resolutions(f, [{ kind: "section_missing", address: compiled_addr, code: null }]);
    expect(resolved[0]?.resolved).toBe(true);
    expect(submit_gate(gate_state({ issues: resolved })).allowed).toBe(true);

    const old = merge_resolutions(f, [{ kind: "section_missing", address: "G6.U4.L4.LearninginAction", code: null }]);
    expect(old[0]?.resolved).toBe(false);
  });
});
