// NL-85
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CHECK_RULES } from "@ls/core/checks/registry";
import { FakeClock } from "@ls/core/ports/clock";
import { describe, expect, it } from "vitest";
import { run_cli, type CliDeps } from "../cli.ts";
import { MemoryEvidenceRepo } from "../testing/memory-evidence.ts";
import type { CaseOutcome, EvalOptions } from "../types.ts";
import { make_s4 } from "./s4.ts";

const OPTS: EvalOptions = { repeat: 1, provider_mode: "stub", git_sha: "x", unit: null };
const score_all = async (suite = make_s4("stub")): Promise<Map<string, CaseOutcome>> => {
  const m = new Map<string, CaseOutcome>();
  for (const c of suite.cases()) m.set(c.case_id, await suite.score(c, OPTS));
  return m;
};
const without = (kind: string) => CHECK_RULES.filter((r) => r.kind !== kind);

describe("S4 grounding plants", () => {
  it("eleven_of_eleven_caught", async () => {
    const all = await score_all();
    expect(all.size).toBe(19);
    const plants = [...all.values()].filter((o) => /^plant-P\d\d$/.test(o.case_id));
    expect(plants).toHaveLength(11);
    for (const o of plants) expect(o).toMatchObject({ passed: true, actual: { caught: true } });
    expect(all.get("s4-rollup")).toMatchObject({ passed: true, actual: { caught: 11, detectable: 11 } });
    expect(all.get("plant-P08")?.actual).toMatchObject({ kind: "proper_noun_unsourced", level: "advisory" });
    expect(all.get("plant-P12")?.actual).toMatchObject({ kind: "proper_noun_unsourced", level: "blocking" });
  });

  it("p05_reported_not_caught", async () => {
    const o = (await score_all()).get("plant-P05-not-caught-by-code");
    expect(o).toMatchObject({ passed: true, actual: { reported: "not caught by code" } });
  });

  it("false_flags_per_clean_lesson", async () => {
    const all = await score_all();
    const flags = (id: string) => (all.get(id)?.actual as { false_flags: number }).false_flags;
    expect(flags("clean-wp3")).toBe(0);
    for (const id of ["clean-wp1", "clean-wp2", "clean-wp4", "clean-syn1-twin"]) expect(flags(id)).toBeLessThanOrEqual(1);
    for (const id of ["clean-wp1", "clean-wp2", "clean-wp3", "clean-wp4", "clean-syn1-twin"]) expect(all.get(id)?.passed).toBe(true);
  });

  it("syn1_obedient_quote_is_flagged", async () => {
    expect((await score_all()).get("syn1-obedient-flagged")).toMatchObject({ passed: true, actual: { quote_unmatched: 1, page_out_of_range: 1 } });
  });

  it("missed_plant_fails_the_suite", async () => {
    const all = await score_all(make_s4("stub", without("quote_unmatched")));
    expect(all.get("plant-P01")).toMatchObject({ passed: false, failure_category: "plant_missed" });
    expect(all.get("s4-rollup")?.failure_category).toMatch(/^plants_caught_\d+_of_11$/);
    expect(all.get("s4-rollup")?.passed).toBe(false);
    // One rule off: only that rule's plants go red; P03 (page) stays caught.
    expect(all.get("plant-P03")?.passed).toBe(true);

    const root = fs.mkdtempSync(path.join(os.tmpdir(), "nl85-"));
    try {
      const out: string[] = [];
      const deps: CliDeps = {
        evidence: new MemoryEvidenceRepo(), clock: new FakeClock(), suite_factory: () => [make_s4("stub", without("quote_unmatched"))],
        git_sha: "abc123def456", repo_root: root, prompt_version_id: null, models: { generation: "m" }, env: {},
        out: (l) => out.push(l), err: () => {},
      };
      expect(await run_cli(["grounding"], deps)).toBe(1);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("a_page_rule_off_misses_exactly_the_page_plants", async () => {
    const all = await score_all(make_s4("stub", without("page_out_of_range")));
    const red = [...all.values()].filter((o) => o.case_id.startsWith("plant-P") && !o.passed).map((o) => o.case_id);
    expect(red).toEqual(["plant-P03", "plant-P09"]);
  });
});
