// NL-84
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { InvariantViolation } from "@ls/core/errors";
import { FakeClock } from "@ls/core/ports/clock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { make_leak_guard } from "../leak-guard.ts";
import { EvalRunner } from "../runner.ts";
import { MemoryEvidenceRepo } from "../testing/memory-evidence.ts";
import type { EvalSuite } from "../types.ts";
import { load_cases, parse_case_file } from "./case-files.ts";
import { make_s1 } from "./s1.ts";
import { make_s7 } from "./s7.ts";

const CASES = path.join(import.meta.dirname, "../../cases");
let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "nl84-"));
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

const good = { case_id: "s1-x", provenance: "synthetic", source: "SYN-1", guards: "g", input: {}, expected: {} };
const parse = (o: object) => parse_case_file("s1-x.json", JSON.stringify(o), "evals/cases/s1/s1-x.json");

async function run_both(): Promise<{ reports: string; counts: Record<string, number> }> {
  const repo = new MemoryEvidenceRepo();
  const suites: EvalSuite[] = [make_s1("stub"), make_s7("stub")];
  const runner = new EvalRunner(repo, suites, new FakeClock(), { repo_root: root, prompt_version_id: null, models: { generation: "m" }, env: {} });
  const counts: Record<string, number> = {};
  for (const s of suites) {
    await runner.run(s.name, { repeat: 1, provider_mode: "stub", git_sha: "abc123def456", unit: null });
    counts[s.name] = s.cases().length;
  }
  const dir = path.join(root, "evals/reports");
  return { reports: fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n"), counts };
}

describe("case provenance", () => {
  it("cases_carry_provenance_and_report_names_run", async () => {
    expect(() => parse(good)).not.toThrow();
    for (const bad of [{ ...good, provenance: undefined }, { ...good, provenance: "invented" }, { ...good, source: " " }, { ...good, guards: "" }, { ...good, case_id: "other" }]) {
      expect(() => parse(bad)).toThrow(InvariantViolation);
    }
    for (const [suite, prefix] of [["s1", "s1-"], ["s7", "s7-"]] as const) {
      const cases = load_cases(path.join(CASES, suite), `evals/cases/${suite}`, prefix);
      expect(cases.length).toBeGreaterThan(5);
      for (const c of cases) expect([c.provenance, c.source.trim(), c.guards.trim()].every((x) => x !== "")).toBe(true);
    }
    const { reports, counts } = await run_both();
    expect(reports).toContain("git_sha: abc123def456");
    expect(reports).toContain("prompt_version: none (stub)");
    expect(reports).toContain("models: ");
    expect(reports).toContain(`n: ${counts["S1"]}`);
    expect(reports).toContain(`n: ${counts["S7"]}`);
  });

  it("no_restricted_or_real_data", async () => {
    const guard = make_leak_guard(process.env);
    const texts: [string, string][] = [];
    for (const suite of ["s1", "s7"]) {
      for (const f of fs.readdirSync(path.join(CASES, suite))) texts.push([`${suite}/${f}`, fs.readFileSync(path.join(CASES, suite, f), "utf8")]);
    }
    texts.push(["reports", (await run_both()).reports]);
    expect(texts.length).toBeGreaterThan(30);
    for (const [where, t] of texts) {
      expect(t, where).not.toMatch(/restricted\//);
      expect(t, where).not.toMatch(/\bsk-[A-Za-z0-9_-]{8,}/);
      expect(t, where).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
      expect(() => guard(where, t)).not.toThrow();
    }
  });
});
