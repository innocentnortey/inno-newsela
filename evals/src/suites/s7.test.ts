// NL-84
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FakeClock } from "@ls/core/ports/clock";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EvalRunner } from "../runner.ts";
import { MemoryEvidenceRepo } from "../testing/memory-evidence.ts";
import type { EvalOptions, EvalSuite } from "../types.ts";
import { make_s7 } from "./s7.ts";
import { clear_record_ok } from "./s7-support.ts";

const OPTS: EvalOptions = { repeat: 1, provider_mode: "stub", git_sha: "abc123def456", unit: null };
const DIR = path.join(import.meta.dirname, "../../cases/s7");
const score = async (s: EvalSuite, id: string) => {
  const c = s.cases().find((x) => x.case_id === id);
  if (c === undefined) throw new Error(`no case ${id}`);
  return s.score(c, OPTS);
};

let root: string;
let repo: MemoryEvidenceRepo;
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "nl84-"));
  repo = new MemoryEvidenceRepo();
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe("S7 safety notes", () => {
  it("wp4_four_checks", async () => {
    const s = make_s7("stub");
    const ids = ["s7-wp4-1-proposed", "s7-wp4-2-routed-to-tip", "s7-wp4-3-absent-from-student-blocks", "s7-wp4-4-approve-refused-until-cleared"];
    for (const id of ids) expect((await score(s, id)).passed, id).toBe(true);
    // The negative controls live inside the actual values: each check can fail.
    expect((await score(s, ids[1] as string)).actual).toMatchObject({ control_findings_without_tip: 1, control_is_blocking: true });
    expect((await score(s, ids[3] as string)).actual).toMatchObject({ approve_allowed_while_open: false, approve_allowed_with_recorded_resolution: false, approve_allowed_when_cleared: true });
    // A wrong expectation is red.
    const wrong = s.cases().map((c) => (c.case_id === ids[3] ? { ...c, expected: { ...(c.expected as object), approve_allowed_while_open: true } } : c));
    const red = make_s7("stub", { cases: wrong as never });
    expect((await score(red, ids[3] as string)).passed).toBe(false);
  });

  it("recall_and_false_proposals", async () => {
    const s = make_s7("stub");
    const sum = await score(s, "s7-recall-summary");
    expect(sum).toMatchObject({ passed: true, actual: { n: 5, proposed: 5, recall: "5/5", label: "synthetic", decoys_n: 3, false_on_decoys: 0, paraphrases_n: 3 } });
    for (const id of s.cases().map((c) => c.case_id).filter((x) => /^s7-syn4-(warning|decoy)/.test(x))) expect((await score(s, id)).passed, id).toBe(true);
    for (const n of [1, 2, 3]) expect(await score(s, `s7-syn4-paraphrase-${n}`)).toMatchObject({ passed: true, actual: { limit: true } });
    expect(await score(s, "s7-false-proposals-issued")).toMatchObject({ passed: true, actual: { false_proposals: 0 } });
    expect(await score(s, "s7-false-proposals-wp5")).toMatchObject({ passed: true, actual: { false_proposals: 0 } });
    expect((await score(s, "s7-false-proposals-issued")).actual).toHaveProperty("cells_scanned");
    expect((await score(s, "s7-cleared-flag-carries-user-note-time")).passed).toBe(true);
    expect(clear_record_ok([{ status: "cleared", cleared_by: null, note: "x", cleared_at: "t" }])).toBe(false);
    expect(clear_record_ok([{ status: "cleared", cleared_by: "u", note: "  ", cleared_at: "t" }])).toBe(false);
    // A decoy that is proposed is a real false proposal: it fails and is never reworded.
    const flipped = s.cases().map((c) => (c.case_id === "s7-syn4-decoy-1" ? { ...c, input: { line: "Warn students that this graphic scene is upsetting." } } : c));
    expect((await score(make_s7("stub", { cases: flipped as never }), "s7-syn4-decoy-1")).passed).toBe(false);
  });

  it("syn4_manifest_matches_generated_files", () => {
    const m = JSON.parse(fs.readFileSync(path.join(DIR, "syn4-manifest.json"), "utf8")) as { files: Record<string, string>; sha256: string; n: number };
    expect(m.n).toBe(11);
    for (const [f, h] of Object.entries(m.files)) expect(createHash("sha256").update(fs.readFileSync(path.join(DIR, f))).digest("hex"), f).toBe(h);
  });

  it("test_eval_runner_writes_results_s7", async () => {
    const suite: EvalSuite = make_s7("stub");
    const s = await new EvalRunner(repo, [suite], new FakeClock(), { repo_root: root, prompt_version_id: null, models: { generation: "m" }, env: {} }).run("S7", OPTS);
    expect(repo.runs).toHaveLength(1);
    expect(repo.cases).toHaveLength(suite.cases().length);
    for (const c of repo.cases) {
      expect(c.provenance).not.toBe("");
      expect(c.source).not.toBe("");
      expect(c.guards).not.toBe("");
    }
    expect(s.passed).toBe(s.total);
  });
});
