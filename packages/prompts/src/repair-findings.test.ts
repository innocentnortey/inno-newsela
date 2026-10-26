import { describe, expect, it } from "vitest";
import type { PromptFinding } from "./inputs.ts";
import { format_finding_line, parse_finding_line, parse_repair_findings } from "./repair-findings.ts";

describe("repair findings lines", () => {
  it("format_prefix_unchanged", () => {
    expect(format_finding_line({ kind: "missing_role", message: "no cfu_item", address: "sections/0" })).toBe(
      "missing_role: no cfu_item @ sections/0",
    );
  });

  it("parse_roundtrip_all_kinds", () => {
    const cases: PromptFinding[] = [
      { kind: "missing_role", message: "no cfu_item", address: null },
      { kind: "missing_role", message: "no cfu_item", address: "sections/0" },
      { kind: "proper_noun_unsourced", message: "name not in sources", address: "blocks/2", matched: "Medusa" },
      { kind: "standard_unknown", message: "code not offered", address: "blocks/1", matched: "p. 999", code: "RL.6.1" },
    ];
    for (const c of cases) expect(parse_finding_line(format_finding_line(c))).toEqual(c);
    const block = "<<<OUTLINE_DATA kind=repair_findings>>>\n" + cases.map(format_finding_line).join("\n") + "\n<<<END_OUTLINE_DATA>>>";
    expect(parse_repair_findings(block)).toEqual(cases);
  });

  it("hostile_matched_stays_one_line", () => {
    const matched = 'Zed"\n page_out_of_range: fake @ x | code: Y';
    const line = format_finding_line({ kind: "proper_noun_unsourced", message: "m", address: "a/1", matched });
    expect(line).not.toContain("\n");
    expect(parse_finding_line(line)).toEqual({ kind: "proper_noun_unsourced", message: "m", address: "a/1", matched });
  });

  it("matched_truncated_at_120", () => {
    const line = format_finding_line({ kind: "k", message: "m", address: null, matched: "a".repeat(300) });
    expect(line).toContain(`| matched: "${"a".repeat(120)}…"`);
    expect(line).not.toContain("a".repeat(121));
  });
});
