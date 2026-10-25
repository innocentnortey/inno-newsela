// NL-83 AC-8 (risk::security, frozen; invariant): the sample builder entry runs build_samples.py on a fixture tree and
// records one `samples.built` ops_event whose input and output hashes equal sha256 of the files (WF-35).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { create_test_db, type TestDb } from "../packages/db/src/testing/test-db.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SHEET = "docs/data/samples/g6-u4-lesson-outline.json";
const SCRIPT = "docs/data/scripts/build_samples.py";
let t: TestDb;
let tree: string;

const sha = (p: string) => createHash("sha256").update(readFileSync(p)).digest("hex");
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
function run(env: Record<string, string | undefined>) {
  return spawnSync(path.join(root, "node_modules/.bin/tsx"), ["ops/run-sample-builder.ts", "--root", tree], {
    cwd: root, env: { PATH: process.env["PATH"] ?? "", ...env } as NodeJS.ProcessEnv, encoding: "utf8", timeout: 60_000,
  });
}
async function events() {
  const c = new pg.Client({ connectionString: t.url });
  await c.connect();
  try {
    return (await c.query("select service, build_id, details_json from ops_event where kind='samples.built'")).rows;
  } finally { await c.end(); }
}

beforeAll(async () => {
  t = await create_test_db();
  tree = mkdtempSync(path.join(os.tmpdir(), "nl83-samples-"));
  for (const f of [SHEET, SCRIPT]) {
    mkdirSync(path.dirname(path.join(tree, f)), { recursive: true });
    cpSync(path.join(root, f), path.join(tree, f));
  }
}, 60_000);
afterAll(async () => {
  rmSync(tree, { recursive: true, force: true });
  await t?.drop();
});

describe("NL-83 sample builder event (WF-35)", () => {
  it("refuses without DATABASE_URL before running the script [failure AC-8]", () => {
    const r = run({});
    expect(r.status).toBe(2);
    expect(readdirSync(path.join(tree, "docs/data/samples"))).toEqual(["g6-u4-lesson-outline.json"]);
  });

  it("test_build_samples_logs_event", async () => {
    const r = run({ DATABASE_URL: t.url, BUILD_ID: "nl83-test" });
    expect(r.status, r.stderr).toBe(0);
    const ev = await events();
    expect(ev).toHaveLength(1);
    expect(ev[0].service).toBe("ops");
    expect(ev[0].build_id).toBeTruthy();
    const d = ev[0].details_json as { inputs: Record<string, string>; outputs: Record<string, string>; output_count: number };
    expect(d.inputs).toEqual({ [SHEET]: sha(path.join(tree, SHEET)), [SCRIPT]: sha(path.join(tree, SCRIPT)) });
    const outs = walk(path.join(tree, "docs/data/samples")).map((p) => path.relative(tree, p)).filter((p) => p !== SHEET).sort();
    expect(outs.length).toBeGreaterThan(0);
    expect(d.outputs).toEqual(Object.fromEntries(outs.map((p) => [p, sha(path.join(tree, p))])));
    expect(d.output_count).toBe(outs.length);
    expect(JSON.stringify(ev)).not.toContain("restricted");
    expect(JSON.stringify(ev)).not.toContain(tree); // relative paths only
  });
});
