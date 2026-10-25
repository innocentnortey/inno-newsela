// NL-01 AC-11: 17 root scripts exist; unbuilt targets exit 2 naming the owner.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
const map = JSON.parse(fs.readFileSync(path.join(root, "scripts/script-targets.json"), "utf8")) as Record<
  string,
  { target: string; owner: string }
>;
const NAMES = [
  "lint", "typecheck", "test", "test:e2e", "db:migrate", "db:seed", "schemas:emit", "eval:golden", "eval:grounding",
  "eval:faults", "eval:full-run", "eval:seed", "eval:heldout", "eval:judge-calibrate", "load:spike", "ops:backup", "dev",
];

describe("NL-01 AC-11 root scripts", () => {
  it("all 17 exist", () => {
    for (const n of NAMES) expect(pkg.scripts[n], n).toBeTruthy();
    expect(NAMES).toHaveLength(17);
  });
  it("lint, typecheck, test are real commands, not in the map", () => {
    for (const n of ["lint", "typecheck", "test"]) expect(map[n]).toBeUndefined();
    expect(Object.keys(map)).toHaveLength(16);
  });
  it.each(Object.entries(map))("%s exits 2 while unbuilt", (name, e) => {
    if (fs.existsSync(path.join(root, e.target))) return; // built by its owner: skip
    const r = spawnSync("node", ["scripts/run-target.mjs", name], { cwd: root, encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain(`NOT BUILT: owned by ${e.owner}`);
  });
  it("--probe exits 2 for a missing target", () => {
    const r = spawnSync("node", ["scripts/run-target.mjs", "--probe", "does/not/exist.ts", "NL-99"], { cwd: root, encoding: "utf8" });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("NOT BUILT: owned by NL-99");
  });
});
