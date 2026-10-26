// NL-121 AC-9 (frozen first): WF-27 obligations GR-13 and OBS-11, driven through the real run_heldout on the real test database.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { make_world, REPO, type World } from "../seed/test-world.ts";
import { run_heldout } from "./cli.ts";
import type { GeneratedReader } from "./generated.ts";

let w: World;
let root: string;
let blob = "";

const reader: GeneratedReader = {
  async lessons() {
    return { without_number: 0, lessons: [{ number: 1, facts: { type: "core", sections: ["Launch"], focus: ["RL.6.1"] } }] };
  },
};

beforeAll(async () => {
  w = await make_world();
  root = fs.mkdtempSync(path.join(os.tmpdir(), "nl121-wf27-"));
  spawnSync("git", ["init", "-q"], { cwd: root });
  fs.writeFileSync(path.join(root, ".gitignore"), "evals/local/\n");
  const code = await run_heldout([], {
    evidence: w.evidence, clock: w.clock, reader, git_sha: "abc123def456", repo_root: root,
    published_dir: path.join(REPO, "evals/tests/fixtures/heldout-syn"), out: () => {}, err: () => {}, env: {},
  });
  expect(code).toBe(0);
  const rows = await w.t.db.with_tx(async (tx) => ({
    runs: (await tx.query("SELECT * FROM eval_run")).rows,
    cases: (await tx.query("SELECT * FROM eval_case_result")).rows,
  }));
  blob = JSON.stringify(rows) + fs.readFileSync(path.join(root, "evals/local/held-out/2026-10-25.json"), "utf8");
}, 120_000);
afterAll(async () => {
  fs.rmSync(root, { recursive: true, force: true });
  await w.close();
});

describe("WF-27", () => {
  it("GR-13: every app_user is synthetic and @example.test; no student or teacher-of-record key in the report or rows", async () => {
    expect(blob).not.toMatch(/"(student|teacher_of_record)[a-z_]*"\s*:/i);
    const users = await w.t.db.with_tx(async (tx) => (await tx.query("SELECT email, synthetic FROM app_user")).rows as { email: string; synthetic: boolean }[]);
    expect(users.length).toBeGreaterThan(0);
    expect(users.every((u) => u.synthetic && u.email.endsWith("@example.test"))).toBe(true);
  });

  it("OBS-11: WF-27 is registered and eval:heldout maps to the held-out CLI owned by NL-121", () => {
    expect(fs.readFileSync(path.join(REPO, "docs/design/observability.md"), "utf8")).toContain("WF-27");
    const targets = JSON.parse(fs.readFileSync(path.join(REPO, "scripts/script-targets.json"), "utf8")) as Record<string, { target: string; owner: string }>;
    expect(targets["eval:heldout"]?.target).toBe("evals/src/heldout/cli.ts");
    expect(targets["eval:heldout"]?.owner).toBe("NL-121");
  });
});
