// NL-09 AC-2 [invariant]. Fixtures derive from docs/data/samples (synthetic) and worked-pairs WP-1/WP-5.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NormalizedOutline, NormalizedRow } from "./outline.ts";

const load = (n: string): unknown => JSON.parse(readFileSync(new URL(`../tests/fixtures/${n}`, import.meta.url), "utf8"));

describe("NormalizedRow", () => {
  it("WP-1 row re-serialises equal", () => {
    const x = load("wp1-row.json");
    expect(NormalizedRow.parse(x)).toEqual(x);
  });
  it("WP-5 clean control row re-serialises equal", () => {
    const x = load("wp5-row.json");
    expect(NormalizedRow.parse(x)).toEqual(x);
  });
  it("outline keeps original_text and proposed_fix on findings", () => {
    const outline = {
      unit_as_written: "Unit 4", unit_from_filenames: "U4",
      rows: [NormalizedRow.parse(load("wp1-row.json"))],
      findings: [{ finding_id: "f1", row_number: 8, level: "error", kind: "focus_missing_strand", original_text: "RL.6.1, 6.2 L.6.4", proposed_fix: "RL.6.1, RL.6.2, L.6.4", default_choice: null }],
      unit_rules: [],
      counts: { lessons: 1, flex_days: 0, arc_headers: 0, totals: 0, errors: 1, warnings: 0 },
    };
    const p = NormalizedOutline.parse(outline);
    expect(p.findings[0]?.original_text).toBe("RL.6.1, 6.2 L.6.4");
    expect(p.findings[0]?.proposed_fix).toBe("RL.6.1, RL.6.2, L.6.4");
    expect(p).toEqual(outline);
  });
});
