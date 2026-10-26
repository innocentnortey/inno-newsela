// The residual recorded in docs/testing/error-analysis/name-scan-residual-2026-10-26.md: a limitation, not a classification.
import { describe, expect, it } from "vitest";
import { NON_RESOLVABLE, merge_resolutions } from "../../gates.ts";
import { CHECK_POLICY } from "../../policy.ts";
import { build_ctx } from "./fixtures/build.ts";
import { build_name_index, scan_names } from "./name-scan.ts";
import { proper_noun_unsourced_rule } from "./proper_noun_unsourced.ts";

const empty = () => build_name_index(["Percy fights."], ["Percy fights."]);
const RESIDUAL = ["Length does not matter.", "Preference is not evidence.", "Describes the setting only."];

describe("name scan residual", () => {
  it("residual_words_are_flagged_only_when_nothing_in_the_lesson_uses_them", () => {
    const words = ["Length", "Preference", "Describes"];
    RESIDUAL.forEach((t, i) => {
      expect(scan_names(`B. Incorrect: ${t}`, empty())).toEqual([words[i]]);
    });
    const used = build_name_index(["Percy fights."], ["The length is short.", "A preference is clear.", "It describes the scene."]);
    for (const t of RESIDUAL) expect(scan_names(`B. Incorrect: ${t}`, used)).toEqual([]);
  });

  it("invented_names_stay_flagged_in_the_same_position", () => {
    for (const name of ["Medusa", "Brindle", "Quillon"]) {
      expect(scan_names(`B. Incorrect: ${name} would wait.`, empty())).toEqual([name]);
    }
  });

  // The opposite limit, a MISSED name: a name the tagger reads as a verb, adjective or noun when written in lower case
  // is not flagged as the first word after a label (first_word_is_name returns false). Recorded, not fixed.
  it("missed_names_that_read_as_ordinary_words_are_not_flagged_after_a_label", () => {
    for (const name of ["Hunter", "Storm", "Hope", "Bishop", "Dash", "Sparky"]) {
      expect(scan_names(`B. Incorrect: ${name} would wait.`, empty()), name).toEqual([]);
    }
  });

  it("lowercase_use_elsewhere_in_the_lesson_clears_a_capitalised_form", () => {
    expect(scan_names("B. Incorrect: Brindle would wait.", empty())).toEqual(["Brindle"]);
    const used = build_name_index(["Percy fights."], ["A brindle coat is striped."]);
    expect(scan_names("B. Incorrect: Brindle would wait.", used)).toEqual([]);
    expect(scan_names("B. Incorrect: The dog Brindle would wait.", used)).toEqual([]);
  });

  const finding = () => {
    const ctx = build_ctx("wp1", { mutate: (d) => { d.blocks[16]!.cfu!.rationales[1] = "Length does not matter."; } });
    return proper_noun_unsourced_rule.run(ctx, CHECK_POLICY).filter((f) => f.matched === "Length");
  };

  it("residual_finding_is_resolvable_by_a_named_reviewer", () => {
    const [f] = finding();
    expect(f).toBeDefined();
    expect(NON_RESOLVABLE.has("proper_noun_unsourced")).toBe(false);
    const [issue] = merge_resolutions([f!], [{ kind: "proper_noun_unsourced", address: f!.address, code: f!.code ?? null }]);
    expect(issue?.resolved).toBe(true);
  });

  it("finding_carries_the_exact_word_for_repair", () => {
    const [f] = finding();
    expect(f?.matched).toBe("Length");
  });
});
