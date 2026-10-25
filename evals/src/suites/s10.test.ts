// NL-92 AC-4, AC-5, AC-7: thresholds, report and rows, no secrets. The last two need scripts/test-db.sh up.
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { run_cli } from "../cli.ts";
import { KIND_CHECKS } from "../seed/mutations.ts";
import { make_world, raise_issue, read_state, run_id_of, type World } from "../seed/test-world.ts";
import { s10_floor_met, verdict } from "./s10-verdict.ts";
import { make_s10 } from "./s10.ts";

const KINDS = ["wrong_standard_code", "invented_quote", "page_out_of_range", "safety_in_student_block", "missing_section"];
const caught = (flags: boolean[]) => verdict(flags.map((c, i) => ({ kind: KINDS[i] as string, caught: c })));

describe("S10 verdicts", () => {
  it("thresholds_and_wrong_code_floor", () => {
    expect(caught([true, true, true, true, true])).toMatchObject({ caught: 5, n: 5, rate: 1, status: "meets" });
    expect(caught([true, true, true, true, false])).toMatchObject({ rate: 0.8, status: "reported" });
    expect(caught([true, true, true, false, false]).status).toBe("fail(guard)");
    expect(caught([false, true, true, true, true]).status).toBe("fail(floor)"); // 80% overall, wrong code missed
    expect(caught([true, true, true, true, true].map(() => false)).status).toBe("fail(floor)");
    expect(verdict([])).toMatchObject({ n: 0, status: "fail(floor)" });
    expect(s10_floor_met(5, 5, true)).toBe(true);
    expect(s10_floor_met(4, 5, true)).toBe(true);
    expect(s10_floor_met(3, 5, true)).toBe(false);
    expect(s10_floor_met(4, 5, false)).toBe(false);
  });

  it("without a plan the suite is empty, so it can never read as passing", () => {
    expect(make_s10("stub").cases()).toEqual([]);
  });
});

describe("S10 report and rows", () => {
  let w: World;
  let run_id = "";
  let report = "";
  beforeAll(async () => {
    w = await make_world();
    expect(await run_cli(["seed", "--plan", w.write_key("seed-key-r.json")], w.deps())).toBe(0);
    run_id = run_id_of(w);
    for (const p of read_state(w, run_id).plants) await raise_issue(w, p.lesson_id, p.content_hash, KIND_CHECKS[p.kind][0] as string);
    expect(await run_cli(["seed", "--score", run_id], w.deps())).toBe(0);
    report = fs.readFileSync(path.join(w.root, `evals/reports/seeded-${run_id}.md`), "utf8");
  }, 120_000);
  afterAll(async () => w.close());

  it("report_and_case_results", async () => {
    expect(report).toContain("our reviewers");
    expect(report).toContain("git_sha: abc123def456");
    expect(report).toContain("n: 5");
    expect(report).toContain("5/5");
    expect(report).toContain("verdict: meets");
    expect(report.match(/^\| seed-\d \|/gm)).toHaveLength(5);
    const n = await w.t.db.with_tx(async (tx) => (await tx.query("SELECT 1 FROM eval_case_result WHERE eval_run_id=$1", [run_id])).rowCount);
    expect(n).toBe(5);
    const run = await w.t.db.with_tx(async (tx) => (await tx.query("SELECT passed, total, report_path FROM eval_run WHERE id=$1", [run_id])).rows[0]);
    expect(run).toMatchObject({ passed: 5, total: 5, report_path: `evals/reports/seeded-${run_id}.md` });
  });

  it("no_secrets_in_report", async () => {
    const rows = JSON.stringify(await w.t.db.with_tx(async (tx) => (await tx.query("SELECT * FROM eval_case_result WHERE eval_run_id=$1", [run_id])).rows));
    const keyed = JSON.parse(fs.readFileSync(path.join(w.root, "evals/local/seed-key-r.json"), "utf8")) as { plant_id: string; marker: string }[];
    for (const blob of [report, rows, w.logs.join("\n")]) {
      expect(blob).not.toContain("sk-test-NL92-key");
      expect(blob).not.toMatch(/\bsk-[A-Za-z0-9_-]{8,}/);
      expect(blob).not.toMatch(/restricted\//i);
      for (const k of keyed) {
        expect(blob).not.toContain(k.marker);
        expect(blob).not.toContain(k.plant_id);
      }
    }
  });
});
