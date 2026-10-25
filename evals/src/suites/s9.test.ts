// NL-86 AC-5: S9 thresholds come from stored rows; a corrupted row turns one red.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { InvariantViolation } from "@ls/core/errors";
import { DriverError } from "../driver/types.ts";
import { MemoryEvidenceRepo } from "../testing/memory-evidence.ts";
import { make_stub_world } from "../testing/full-run-world.ts";
import type { EvalOptions } from "../types.ts";
import { make_s9, type S9Deps } from "./s9.ts";

const OPTS: EvalOptions = { repeat: 1, provider_mode: "stub", git_sha: "abc123def456", unit: "G6.U4" };

function deps(world = make_stub_world({ n: 47, seed: 86 }), api_cost?: string): S9Deps {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "nl86-s9-"));
  const honest = world.calls.reduce((a, c) => a.plus(c.cost), new Decimal(0)).toString();
  return {
    driver_factory: () => ({ run: async () => ({ run_id: world.run_id, final_state: "complete", polls: 1, summary: { cost_usd: Number(api_cost ?? honest) } as never }) }),
    ctx: { ports: world.ports, evidence: new MemoryEvidenceRepo(), repo_root: root, git_sha: "abc123def456", prompt_version_id: null, models: {}, provider_mode: "stub", env: {} },
  };
}
async function score_all(suite: ReturnType<typeof make_s9>) {
  const out = [];
  for (const c of suite.cases()) out.push(await suite.score(c, OPTS));
  return out;
}

describe("S9", () => {
  it("has 47 day cases and ten threshold cases", () => {
    const cases = make_s9("stub", deps()).cases();
    expect(cases).toHaveLength(57);
    expect(cases.filter((c) => c.case_id.startsWith("lesson-day-"))).toHaveLength(47);
  });

  it("thresholds_from_rows_and_corruption_detected", async () => {
    const good = await score_all(make_s9("stub", deps()));
    expect(good.filter((o) => !o.passed).map((o) => o.case_id)).toEqual([]);

    const world = make_stub_world({ n: 47, seed: 86 });
    const d = deps(world, world.calls.reduce((a, c) => a.plus(c.cost), new Decimal(0)).toString());
    (world.calls[0] as { cost: Decimal }).cost = new Decimal("9.9"); // one call row changed after the jobs and the API summary were fixed
    const bad = await score_all(make_s9("stub", d));
    expect(bad.filter((o) => !o.passed).map((o) => o.case_id)).toContain("totals_equal_call_sums");
  });

  it("a missing lesson row is a visible failure", async () => {
    const suite = make_s9("stub", deps(make_stub_world({ n: 46, seed: 86 })));
    const o = await suite.score(suite.cases().find((c) => c.case_id === "lesson-day-47") as never, OPTS);
    expect(o).toMatchObject({ passed: false, failure_category: "missing_lesson_row" });
  });

  it("a driver refusal surfaces as an InvariantViolation without secrets", async () => {
    const d = deps();
    d.driver_factory = () => ({ run: async () => { throw new DriverError("CAP_REFUSED", "no cap"); } });
    const suite = make_s9("real", d);
    await expect(suite.score(suite.cases()[0] as never, { ...OPTS, provider_mode: "real" })).rejects.toBeInstanceOf(InvariantViolation);
  });
});
