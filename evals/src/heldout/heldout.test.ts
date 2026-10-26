// NL-121 (frozen first): AC-1, AC-2, AC-3, AC-5, AC-7 against the synthetic stand-in in evals/tests/fixtures/heldout-syn.
// Needs scripts/test-db.sh up for the real-database cases (canary_absent, test_heldout_report_counts_only).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FakeClock } from "@ls/core/ports/clock";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MemoryEvidenceRepo } from "../testing/memory-evidence.ts";
import { make_world, REPO, type World } from "../seed/test-world.ts";
import { run_heldout, type HeldoutDeps } from "./cli.ts";
import type { LessonFacts } from "./compare.ts";
import type { GeneratedReader } from "./generated.ts";
import { assert_output_ignored, RefusedPath } from "./guard.ts";
import { published_file_name, read_published } from "./published.ts";
import { HeldoutReport } from "./schema.ts";

const CANARY = "CANARY-HELDOUT-7f3a";
const SYN = path.join(REPO, "evals/tests/fixtures/heldout-syn");
const SHA = "deadbeefcafe";
const REFUSAL = "held-out report path is not ignored or is tracked; refusing to run";

const f = (type: string, sections: string[], focus: string[]): LessonFacts => ({ type, sections, focus });
// Lessons 1..6: 4 compared (1,2,3,5), 4 unreadable (stand-in is truncated), 6 has no published file.
const reader: GeneratedReader = {
  async lessons() {
    return {
      without_number: 0,
      lessons: [
        { number: 1, facts: f("core", ["Launch", "Literacy Lab", "Wrap Up"], ["RL.6.1", "RL.6.2"]) },
        { number: 2, facts: f("core", ["Launch", "Research", "Homework"], ["RL.6.1", "RL.6.2"]) },
        { number: 3, facts: f("flex", ["Launch", "Wrap Up"], ["W.6.1"]) },
        { number: 4, facts: f("core", ["Launch"], []) },
        { number: 5, facts: f("core", ["Launch", "Wrap Up"], []) },
        { number: 6, facts: f("core", ["Launch"], []) },
      ],
    };
  },
};

function git(cwd: string, ...args: string[]): { status: number | null; stdout: string } {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  return { status: r.status, stdout: r.stdout };
}
function temp_repo(ignore: boolean): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nl121-"));
  git(root, "init", "-q");
  if (ignore) fs.writeFileSync(path.join(root, ".gitignore"), "evals/local/\n");
  return root;
}
interface Run { code: number; out: string[]; errs: string[]; deps: HeldoutDeps }
async function run(root: string, over: Partial<HeldoutDeps> & Pick<HeldoutDeps, "evidence">, argv: string[] = []): Promise<Run> {
  const out: string[] = [];
  const errs: string[] = [];
  const deps: HeldoutDeps = {
    clock: new FakeClock(new Date("2026-10-25T10:00:00.000Z")), reader, git_sha: SHA, repo_root: root, published_dir: SYN,
    out: (l) => out.push(l), err: (l) => errs.push(l), env: {}, ...over,
  };
  return { code: await run_heldout(argv, deps), out, errs, deps };
}
const report_path = (root: string): string => path.join(root, "evals/local/held-out/2026-10-25.json");
function read_dir_text(dir: string): string {
  if (!fs.existsSync(dir)) return "";
  return fs.readdirSync(dir).map((n) => fs.readFileSync(path.join(dir, n), "utf8")).join("\n");
}

describe("published reader (synthetic stand-in)", () => {
  it("names files g6-u4-lNN.json", () => expect(published_file_name(4)).toBe("g6-u4-l04.json"));
  it("ok: derives type, section titles and focus codes only", () => {
    const r = read_published(SYN, 2);
    expect(r).toEqual({ kind: "ok", facts: { type: "Core", sections: ["Launch", "Research: Invented subtitle", "Homework"], focus: ["RL.6.1"] } });
  });
  it("unreadable: truncated JSON, and the result carries no text from the file", () => {
    const r = read_published(SYN, 4);
    expect(r).toEqual({ kind: "unreadable" });
    expect(JSON.stringify(r)).not.toContain(CANARY);
  });
  it("missing: no file for that number", () => expect(read_published(SYN, 6)).toEqual({ kind: "missing" }));
});

describe("output guard", () => {
  it("passes only when ignored and untracked", () => {
    expect(() => assert_output_ignored("/x", "a", (args) => (args[0] === "check-ignore" ? 0 : 1))).not.toThrow();
    expect(() => assert_output_ignored("/x", "a", () => 1)).toThrow(RefusedPath);
    expect(() => assert_output_ignored("/x", "a", (args) => (args[0] === "check-ignore" ? 0 : 0))).toThrow(RefusedPath);
  });
});

describe("with the real database", () => {
  let w: World;
  let root: string;
  let result: Run;
  beforeAll(async () => {
    w = await make_world();
    root = temp_repo(true);
    result = await run(root, { evidence: w.evidence });
  }, 120_000);
  afterAll(async () => {
    fs.rmSync(root, { recursive: true, force: true });
    await w.close();
  });

  it("canary_absent: the published canary reaches no output, row, report or tracked file (AC-1)", async () => {
    expect(result.code).toBe(0);
    const rows = JSON.stringify(await w.t.db.with_tx(async (tx) => (await tx.query("SELECT * FROM eval_run")).rows))
      + JSON.stringify(await w.t.db.with_tx(async (tx) => (await tx.query("SELECT * FROM eval_case_result")).rows));
    const blobs = [fs.readFileSync(report_path(root), "utf8"), result.out.join("\n"), result.errs.join("\n"), rows, read_dir_text(path.join(root, "evals/local/reports"))];
    for (const b of blobs) expect(b.split(CANARY).length - 1).toBe(0);
    const g = git(REPO, "grep", "-l", "-F", CANARY);
    const hits = g.stdout.split("\n").filter(Boolean);
    for (const h of hits) expect(h.startsWith("evals/tests/fixtures/heldout-syn/") || /^evals\/src\/heldout\/[^/]+\.test\.ts$/.test(h)).toBe(true);
  });

  it("counts_only: the report parses, every leaf is a number, and extra or string fields are rejected (AC-2)", () => {
    const json = JSON.parse(fs.readFileSync(report_path(root), "utf8")) as Record<string, unknown>;
    const parsed = HeldoutReport.parse(json);
    const leaves: unknown[] = [];
    const walk = (v: unknown): void => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v !== null && typeof v === "object") Object.values(v).forEach(walk);
      else leaves.push(v);
    };
    walk(json);
    expect(leaves.length).toBeGreaterThan(0);
    expect(leaves.every((l) => typeof l === "number")).toBe(true);
    expect(parsed).toMatchObject({
      lessons_generated: 6, lessons_compared: 4, lessons_unreadable: 1, lessons_no_published: 1,
      type_match_count: 2, sequence_match_count: 3, type_match_rate: 0.5, sequence_match_rate: 0.75,
      focus_shared_total: 4, focus_generated_total: 5, focus_published_total: 4, focus_jaccard_mean: 0.625,
    });
    expect(HeldoutReport.safeParse({ ...json, extra: "x" }).success).toBe(false);
    expect(HeldoutReport.safeParse({ ...json, lessons_compared: "4" }).success).toBe(false);
    expect(HeldoutReport.safeParse({ ...json, per_lesson: [{ ...(json["per_lesson"] as object[])[0], number: "1" }] }).success).toBe(false);
  });

  it("test_heldout_report_counts_only: path, git state and evidence rows hold counts and the injected SHA only (AC-7)", async () => {
    expect(path.resolve(report_path(root)).startsWith(path.join(root, "evals/local") + path.sep)).toBe(true);
    expect(git(root, "ls-files").stdout.trim()).toBe("");
    expect(git(root, "status", "--porcelain").stdout).not.toContain("evals/local");
    expect(result.out).toHaveLength(1);
    expect(result.out[0]).toMatch(/^heldout compared=4 type_match=2 sequence_match=3 eval_run_id=\S+$/);
    const runs = (await w.t.db.with_tx(async (tx) => (await tx.query("SELECT * FROM eval_run")).rows)) as Record<string, unknown>[];
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ suite: "S11", git_sha: SHA, total: 6, passed: 4 });
    const cases = (await w.t.db.with_tx(async (tx) => (await tx.query("SELECT * FROM eval_case_result")).rows)) as Record<string, unknown>[];
    expect(cases).toHaveLength(6);
    const blob = JSON.stringify(runs) + JSON.stringify(cases);
    expect(blob).not.toContain("heldout-syn");
    expect(blob).not.toContain(SYN);
    const cats = cases.map((c) => c["failure_category"]).filter((x) => x !== null && x !== undefined);
    expect(cats.sort()).toEqual(["no_published", "unreadable"]);
  });
});

describe("refusals and failures (in-memory evidence)", () => {
  it("refuses_tracked_path: a path that is not ignored is refused before the published folder is touched (AC-3a)", async () => {
    const root = temp_repo(false);
    const ev = new MemoryEvidenceRepo();
    const r = await run(root, { evidence: ev, published_dir: path.join(root, "does-not-exist") });
    expect(r.code).toBe(2);
    expect(r.errs).toEqual([REFUSAL]);
    expect(fs.existsSync(report_path(root))).toBe(false);
    expect(ev.runs).toHaveLength(0);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("refuses_tracked_path: an ignored but force-added (tracked) path is refused (AC-3b)", async () => {
    const root = temp_repo(true);
    fs.mkdirSync(path.dirname(report_path(root)), { recursive: true });
    fs.writeFileSync(report_path(root), "{}\n");
    expect(git(root, "add", "-f", "evals/local/held-out/2026-10-25.json").status).toBe(0);
    const r = await run(root, { evidence: new MemoryEvidenceRepo() });
    expect(r.code).toBe(2);
    expect(r.errs).toEqual([REFUSAL]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("refuses_tracked_path: the real repo ignores evals/local/held-out", () => {
    const r = git(REPO, "check-ignore", "-v", "evals/local/held-out/x.json");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("evals/local/");
  });

  it("unreadable_and_missing: an unreadable lesson is reported by number only and the run continues (AC-5)", async () => {
    const root = temp_repo(true);
    const r = await run(root, { evidence: new MemoryEvidenceRepo() });
    expect(r.code).toBe(0);
    expect(r.errs).toContain("lesson 4 unreadable");
    for (const line of r.errs) expect(line).toMatch(/^[a-z0-9 ]+$/i);
    expect(r.errs.join("\n")).not.toContain(CANARY);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("unreadable_and_missing: a missing published folder exits 2 with one fixed sentence (AC-5)", async () => {
    const root = temp_repo(true);
    const r = await run(root, { evidence: new MemoryEvidenceRepo(), published_dir: path.join(root, "never-created") });
    expect(r.code).toBe(2);
    expect(r.errs).toEqual(["published folder is missing"]);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("an unknown flag exits 2 with a one-line usage", async () => {
    const root = temp_repo(true);
    const r = await run(root, { evidence: new MemoryEvidenceRepo() }, ["--unit", "G7-U1"]);
    expect(r.code).toBe(2);
    expect(r.errs).toHaveLength(1);
    fs.rmSync(root, { recursive: true, force: true });
  });
});
