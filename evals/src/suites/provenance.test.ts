// NL-85 AC-7, AC-8
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FakeClock } from "@ls/core/ports/clock";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EvalRunner } from "../runner.ts";
import { MemoryEvidenceRepo } from "../testing/memory-evidence.ts";
import type { EvalOptions } from "../types.ts";
import { make_s2 } from "./s2.ts";
import { make_s4 } from "./s4.ts";

const OPTS: EvalOptions = { repeat: 1, provider_mode: "stub", git_sha: "abc123def456", unit: null };
const CASES = path.join(import.meta.dirname, "../../cases");
let root: string;
const reports: Record<string, string> = {};

const files_under = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files_under(path.join(dir, e.name)) : [path.join(dir, e.name)]));

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "nl85-"));
  for (const [name, suite] of [["S2", make_s2("stub")], ["S4", make_s4("stub")]] as const) {
    const r = new EvalRunner(new MemoryEvidenceRepo(), [suite], new FakeClock(), { repo_root: root, prompt_version_id: null, models: { generation: "m" }, env: {} });
    const s = await r.run(name, OPTS);
    reports[name] = fs.readFileSync(path.join(root, s.report_path), "utf8");
  }
}, 120_000);
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe("S2/S4 provenance", () => {
  it("s2_s4_cases_and_reports_named", () => {
    for (const [name, suite] of [["S2", make_s2("stub")], ["S4", make_s4("stub")]] as const) {
      const cases = suite.cases();
      expect(cases.length).toBeGreaterThan(0);
      for (const c of cases) {
        expect(c.provenance, c.case_id).not.toBe("");
        expect(c.source, c.case_id).not.toBe("");
        expect(c.guards, c.case_id).not.toBe("");
        if (name === "S4" && /^plant-P\d\d/.test(c.case_id)) expect(c.source).toMatch(/^SP-3 P\d\d$/);
      }
      expect(reports[name]).toContain("git_sha: abc123def456");
      expect(reports[name]).toContain(`n: ${cases.length}`);
      expect(reports[name]).toContain("prompt_version: none (stub)");
    }
  });

  it("s2_s4_no_restricted_or_heldout", () => {
    const blobs = [...files_under(path.join(CASES, "s2")), ...files_under(path.join(CASES, "s4"))].map((f) => [f, fs.readFileSync(f, "utf8")] as const);
    expect(blobs.length).toBe(4);
    for (const [f, text] of [...blobs, ["report S2", reports.S2!], ["report S4", reports.S4!]] as const) {
      expect(text, f).not.toMatch(/restricted\//i);
      expect(text, f).not.toMatch(/held-?out/i);
      expect(text, f).not.toMatch(/\bsk-[A-Za-z0-9_-]{8,}/);
    }
  });
});
