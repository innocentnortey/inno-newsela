// NL-118 (AC-9): the WF-29 obligations GR-9, GR-13 and OBS-11.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { start_probe_stack, type ProbeStack } from "./src/testing/stack.ts";

const ROOT = path.resolve(import.meta.dirname, "..");

function load_files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    if (n === "node_modules") return [];
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? load_files(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("WF-29 obligations", () => {
  let stack: ProbeStack;
  beforeAll(async () => {
    stack = await start_probe_stack();
  }, 240_000);
  afterAll(async () => {
    await stack?.stop();
  }, 60_000);

  it("GR-9: the restricted folder is ignored, untracked and never named by the load tool", () => {
    execFileSync("git", ["check-ignore", "-q", "docs/source/restricted/x"], { cwd: ROOT });
    expect(execFileSync("git", ["ls-files", "docs/source/restricted"], { cwd: ROOT, encoding: "utf8" }).trim()).toBe("");
    const needle = ["docs", "source", "restricted"].join("/");
    for (const f of load_files(path.join(ROOT, "load"))) {
      if (f.endsWith("wf-29-obligations.int.test.ts") || f.endsWith("wf-30-obligations.int.test.ts")) continue;
      expect(readFileSync(f, "utf8"), f).not.toContain(needle);
    }
  });

  it("GR-13: the probe signs in only as synthetic staff accounts and logs no student or teacher-of-record field", async () => {
    const rows = await stack.query<{ email: string; synthetic: boolean; role: string }>("select email, synthetic, role from app_user where email = any($1)", [Object.values(stack.emails)]);
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.synthetic).toBe(true);
      expect(["author", "reviewer", "approver"]).toContain(r.role);
    }
    const src = load_files(path.join(ROOT, "load")).filter((f) => !f.endsWith(".test.ts")).map((f) => readFileSync(f, "utf8")).join("\n");
    expect(src).not.toMatch(/student|teacher_of_record/i);
  });

  it("OBS-11: WF-29 is registered and reachable by npm run load:spike", () => {
    const doc = readFileSync(path.join(ROOT, "docs/design/observability.md"), "utf8");
    expect(doc).toMatch(/\| WF-29 \|[^\n]*npm run load:spike/);
    const targets = JSON.parse(readFileSync(path.join(ROOT, "scripts/script-targets.json"), "utf8")) as Record<string, { target: string }>;
    expect(targets["load:spike"]?.target).toBe("load/spike.ts");
  });
});
