import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { collect_code_identity, omissions, parse_porcelain_z, tree_identity } from "./replay-finals-provenance.ts";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "f4-prov-"));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const put = (root: string, rel: string, body: string) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), body); };

describe("git identity", () => {
  it("test_parse_porcelain_z_handles_rename_untracked_and_modified", () => {
    const s = " M packages/a.ts\0R  new.ts\0old.ts\0?? evals/src/x.ts\0D  gone.ts\0";
    expect(parse_porcelain_z(s)).toEqual([
      { status: " M", path: "packages/a.ts" }, { status: "R ", path: "new.ts" }, { status: "??", path: "evals/src/x.ts" }, { status: "D ", path: "gone.ts" },
    ]);
  });
  it("test_code_identity_lists_only_code_paths_and_counts_the_rest", () => {
    const root = path.join(tmp, "git");
    put(root, "packages/a.ts", "A");
    put(root, "apps/web/e2e/__screenshots__/x.png", "P");
    const status = " M packages/a.ts\0 M apps/web/e2e/__screenshots__/x.png\0 D packages/gone.ts\0?? tsconfig.tsbuildinfo\0";
    const run = (_c: string, a: string[]) => (a[0] === "rev-parse" ? "abc123\n" : a[0] === "show" ? "2026-10-26T00:00:00+00:00\n" : a[0] === "status" ? status : "DIFF");
    const id = collect_code_identity(root, run);
    expect(id.commit).toBe("abc123");
    expect(id.dirty_files.map((f) => f.path)).toEqual(["packages/a.ts", "packages/gone.ts"]);
    expect(id.dirty_files[0]!.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(id.dirty_files[1]!.sha256).toBeNull();
    expect(id.dirty_other_count).toBe(2);
    expect(id.tracked_diff_sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("tree_identity", () => {
  it("test_tree_identity_excludes_tests_fixtures_and_changes_with_content", () => {
    const root = path.join(tmp, "tree");
    put(root, "d/a.ts", "a"); put(root, "d/sub/b.ts", "b");
    put(root, "d/a.test.ts", "t"); put(root, "d/x.int.test.ts", "t"); put(root, "d/fixtures/f.json", "f"); put(root, "d/testing/t.ts", "t"); put(root, "d/test-helpers.ts", "h"); put(root, "d/node_modules/m.js", "m");
    const one = tree_identity(root, "d");
    expect(Object.keys(one.files)).toEqual(["a.ts", "sub/b.ts"]);
    put(root, "d/a.test.ts", "changed test");
    expect(tree_identity(root, "d").sha256).toBe(one.sha256);
    put(root, "d/a.ts", "changed");
    expect(tree_identity(root, "d").sha256).not.toBe(one.sha256);
  });
  it("test_tree_identity_absent_directory", () => {
    expect(tree_identity(tmp, "nope")).toEqual({ sha256: "absent", files: {} });
  });
  it("test_tree_identity_order_independent", () => {
    const r1 = path.join(tmp, "o1"), r2 = path.join(tmp, "o2");
    put(r1, "d/a.ts", "1"); put(r1, "d/b.ts", "2");
    put(r2, "d/b.ts", "2"); put(r2, "d/a.ts", "1");
    expect(tree_identity(r1, "d").sha256).toBe(tree_identity(r2, "d").sha256);
  });
});

describe("omissions", () => {
  const at = new Date("2026-10-26T17:00:00.000Z");
  const counts = { links: 3, linked_lessons: 2, dependency_states: 1 };
  it("test_omissions_carry_the_timestamp_and_mode", () => {
    for (const mode of ["generation_time", "current"] as const) {
      const os_ = omissions(at, mode, counts);
      expect(os_).toHaveLength(5);
      expect(os_.every((o) => o.as_of === "2026-10-26T17:00:00.000Z")).toBe(true);
    }
    expect(omissions(at, "generation_time", counts)[1]!.effect).toContain("emptied");
    expect(omissions(at, "current", counts)[1]!.effect).toContain("NOT what the original gate saw");
    expect(omissions(at, "current", counts)[0]!.effect).toContain("3 links");
  });
  it("test_omissions_name_every_cleared_field", () => {
    const text = JSON.stringify(omissions(at, "generation_time", counts));
    for (const w of ["cross_lesson_link", "safety flags", "pending suggestions", "confirmations", "previous-lesson flags", "unit coverage", "standards texts", "prompt", "no model call"]) expect(text).toContain(w);
  });
});
