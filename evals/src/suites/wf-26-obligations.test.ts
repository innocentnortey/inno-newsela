// NL-92 AC-10: WF-26 obligations driven through the real entry point (`seed --plan`, then `seed --score`). Needs scripts/test-db.sh up.
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { run_cli } from "../cli.ts";
import { REPO, make_world, read_state, run_id_of, type World } from "../seed/test-world.ts";

let w: World;
let planted_rows = "";
let report = "";

beforeAll(async () => {
  w = await make_world();
  const key = w.write_key("seed-key-o.json");
  expect(await run_cli(["seed", "--plan", key], w.deps())).toBe(0);
  const run_id = run_id_of(w);
  read_state(w, run_id);
  await run_cli(["seed", "--score", run_id], w.deps());
  planted_rows = JSON.stringify(await w.t.db.with_tx(async (tx) => (await tx.query("SELECT * FROM eval_case_result")).rows));
  report = fs.readFileSync(path.join(w.root, `evals/reports/seeded-${run_id}.md`), "utf8");
}, 120_000);
afterAll(async () => w.close());

describe("WF-26", () => {
  it("GR-13: no student or teacher-of-record data; staff authentication only", async () => {
    for (const blob of [planted_rows, report]) expect(blob).not.toMatch(/"(student|teacher_of_record)[a-z_]*"\s*:/i);
    const users = await w.t.db.with_tx(async (tx) => (await tx.query("SELECT email, synthetic FROM app_user")).rows as { email: string; synthetic: boolean }[]);
    expect(users.every((u) => u.synthetic && u.email.endsWith("@example.test"))).toBe(true);
  });

  it("OBS-11: WF-26 is registered and eval:seed maps to the CLI", () => {
    expect(fs.readFileSync(path.join(REPO, "docs/design/observability.md"), "utf8")).toContain("WF-26");
    const targets = JSON.parse(fs.readFileSync(path.join(REPO, "scripts/script-targets.json"), "utf8")) as Record<string, { target: string }>;
    expect(targets["eval:seed"]?.target).toBe("evals/src/cli.ts");
  });
});
