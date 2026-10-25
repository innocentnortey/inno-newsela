// NL-92 AC-3, AC-8: a scripted review, then scoring through the real CLI entry on the real Postgres repos.
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { run_cli } from "../cli.ts";
import { KIND_CHECKS } from "./mutations.ts";
import { approve, make_world, raise_issue, read_state, run_id_of, send_back, store_version, wp1, type World } from "./test-world.ts";

let w: World;
beforeAll(async () => {
  w = await make_world();
}, 120_000);
afterAll(async () => w.close());

describe("WF-26 scoring", () => {
  it("test_seeded_error_capture", async () => {
    expect(await run_cli(["seed", "--plan", w.write_key("seed-key-s.json", 4)], w.deps())).toBe(0);
    const run_id = run_id_of(w);
    const st = read_state(w, run_id);
    const [a, b, c, d] = st.plants as [(typeof st.plants)[number], (typeof st.plants)[number], (typeof st.plants)[number], (typeof st.plants)[number]];

    await raise_issue(w, a.lesson_id, a.content_hash, "code_not_allowed"); // A: a check
    await store_version(w, { ...wp1(), lesson_id: b.lesson_id }, w.reviewer_id); // B: the reviewer edits it out
    await send_back(w, c.lesson_id, "Page 9999 does not exist in this chapter."); // C: sent back naming it
    await approve(w, d.lesson_id); // D: approved untouched

    w.out.length = 0;
    const code = await run_cli(["seed", "--score", run_id], w.deps());
    expect([code, w.out, w.errs]).toEqual([0, expect.anything(), []]); // 3/4 is reported, not failed
    expect(w.out.join("\n")).toContain("S10 3/4 reported");

    const cases = await w.t.db.with_tx(async (tx) =>
      (await tx.query("SELECT case_id, provenance, source, passed, actual_json FROM eval_case_result WHERE eval_run_id=$1 ORDER BY case_id", [run_id])).rows as Record<string, unknown>[],
    ).catch(async () =>
      w.t.db.with_tx(async (tx) => (await tx.query("SELECT * FROM eval_case_result WHERE eval_run_id=$1 ORDER BY case_id", [run_id])).rows as Record<string, unknown>[]),
    );
    expect(cases.map((r) => [r["case_id"], r["passed"]])).toEqual([["seed-1", true], ["seed-2", true], ["seed-3", true], ["seed-4", false]]);
    expect(cases.every((r) => r["provenance"] === "hand-written" && r["source"] === "seed-key-s")).toBe(true);
    const how = cases.map((r) => ((r["actual_json"] ?? r["actual"]) as { how: string }).how);
    expect(how).toEqual(["check", "reviewer", "reviewer", "missed"]);

    const audits = await w.t.db.with_tx(async (tx) => (await tx.query("SELECT 1 FROM audit_event WHERE action='eval.seed_plant'")).rowCount);
    expect(audits).toBe(4);

    const report = fs.readFileSync(path.join(w.root, `evals/reports/seeded-${run_id}.md`), "utf8");
    expect(report).toContain("our reviewers");
    expect(report).toContain("abc123def456");
    expect(report).toContain("n: 4");
    expect(report).toContain("3/4");
  });

  it("a missed wrong-code plant exits 1", async () => {
    const w2 = await make_world();
    try {
      expect(await run_cli(["seed", "--plan", w2.write_key("seed-key-m.json", 5)], w2.deps())).toBe(0);
      const run_id = run_id_of(w2);
      const st = read_state(w2, run_id);
      for (const p of st.plants.slice(1)) await raise_issue(w2, p.lesson_id, p.content_hash, KIND_CHECKS[p.kind][0] as string); // 4/5 caught, wrong-code missed
      w2.out.length = 0;
      expect(await run_cli(["seed", "--score", run_id], w2.deps())).toBe(1);
      expect(w2.out.join("\n")).toContain("4/5 fail(floor)");
    } finally {
      await w2.close();
    }
  });
});
