// NL-85 AC-11: WF-42 obligations driven through the real entry point (`grounding`).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FakeClock } from "@ls/core/ports/clock";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { run_cli } from "../cli.ts";
import { default_suite_factory } from "../registry.ts";
import { MemoryEvidenceRepo } from "../testing/memory-evidence.ts";

const REPO = path.join(import.meta.dirname, "../../..");
const CASES = path.join(import.meta.dirname, "../../cases");
let root: string;
let repo: MemoryEvidenceRepo;
let code: number;
let report: string;
let case_files: string;

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "nl85-wf42-"));
  repo = new MemoryEvidenceRepo();
  code = await run_cli(["grounding"], {
    evidence: repo, clock: new FakeClock(), suite_factory: default_suite_factory, git_sha: "abc123def456", repo_root: root,
    prompt_version_id: null, models: { generation: "m" }, env: { ANTHROPIC_API_KEY: "sk-test-NL85-key" }, out: () => {}, err: () => {},
  });
  report = fs.readFileSync(path.join(root, "evals/reports/grounding-abc123def456.md"), "utf8");
  case_files = ["plants.json", "clean.json"].map((f) => fs.readFileSync(path.join(CASES, "s4", f), "utf8")).join("\n");
}, 120_000);
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe("WF-42", () => {
  it("GR-9: nothing restricted is stored or reported", () => {
    expect(code).toBe(0);
    for (const blob of [report, case_files, JSON.stringify(repo.cases), JSON.stringify(repo.runs)]) {
      expect(blob).not.toContain("docs/source/restricted");
      expect(blob).not.toMatch(/restricted\//i);
    }
  });

  it("GR-13: no student or teacher-of-record field", () => {
    for (const blob of [case_files, JSON.stringify(repo.cases)]) {
      expect(blob).not.toMatch(/"(student|teacher_of_record)[a-z_]*"\s*:/i);
    }
  });

  it("OBS-7: no provider key or secret-looking value in rows, report or cases", () => {
    for (const blob of [report, case_files, JSON.stringify(repo.cases), JSON.stringify(repo.runs)]) {
      expect(blob).not.toContain("sk-test-NL85-key");
      expect(blob).not.toMatch(/\bsk-[A-Za-z0-9_-]{8,}/);
    }
  });

  it("OBS-11: WF-42 is documented and eval:grounding maps to the CLI", () => {
    expect(fs.readFileSync(path.join(REPO, "docs/design/observability.md"), "utf8")).toContain("WF-42");
    const targets = JSON.parse(fs.readFileSync(path.join(REPO, "scripts/script-targets.json"), "utf8")) as Record<string, { target: string }>;
    expect(targets["eval:grounding"]?.target).toBe("evals/src/cli.ts");
    expect(repo.runs).toHaveLength(1);
    expect(repo.runs[0]).toMatchObject({ suite: "S4", passed: 19, total: 19 });
    expect(repo.cases).toHaveLength(19);
  });
});
