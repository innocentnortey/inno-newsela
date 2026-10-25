/* eslint-disable @typescript-eslint/no-explicit-any -- parsed JSON result trees are asserted by path */
// NL-87: WF-34 obligations, one case per id, driven through the real CLI entry (ops/import-spike.ts `main`) on the SP-3 fixture.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SystemClock } from "@ls/core/ports/clock";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { PgModelCallLog } from "@ls/db/repos/model-calls";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { main, PgSpikeStore, type ImportDeps } from "./import-spike.ts";

const ROOT = resolve(import.meta.dirname, "..");
const FX = join(ROOT, "evals/tests/fixtures/spike");
const REPORT = join(FX, "SP-3-invention-scans.md");
const MARKERS = ["sk-ant-TESTMARKER00112233", "docs/source/restricted/", "HELDOUT-UNIT4-MARKER"];
const scratch = mkdtempSync(join(tmpdir(), "nl87-wf34-"));
let t: TestDb;
let before: Record<string, number> = {};
let after: Record<string, number> = {};
let out = "";
let err = "";
let code = -1;
let dump = "";

async function counts(): Promise<Record<string, number>> {
  return t.db.with_tx(async (tx) => {
    const o: Record<string, number> = {};
    const tables = (await tx.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`)).rows;
    for (const r of tables) o[String(r["table_name"])] = Number((await tx.query(`SELECT count(*)::int AS n FROM "${String(r["table_name"])}"`)).rows[0]?.["n"]);
    return o;
  });
}
const rows = async (sql: string): Promise<Record<string, unknown>[]> => t.db.with_tx(async (tx) => (await tx.query(sql)).rows);

beforeAll(async () => {
  t = await create_test_db();
  const d = { db: t.db, ids: new PrefixedIdGenerator(), clock: new SystemClock() };
  const deps: ImportDeps = { evidence: new PgEvidenceRepo(d), model_calls: new PgModelCallLog(d), store: new PgSpikeStore(t.db) };
  // scratch copy of the fixture carrying the seeded markers (prose and an unknown field)
  const md = join(scratch, "SP-3-invention-scans.md");
  writeFileSync(md, `${readFileSync(REPORT, "utf8")}\n\nNote: ${MARKERS.join(" ")}\n`);
  before = await counts();
  vi.spyOn(process.stdout, "write").mockImplementation((s: string | Uint8Array) => ((out += String(s)), true));
  vi.spyOn(process.stderr, "write").mockImplementation((s: string | Uint8Array) => ((err += String(s)), true));
  code = await main([md], {}, deps);
  vi.restoreAllMocks();
  after = await counts();
  dump = JSON.stringify([await rows(`SELECT * FROM experiment_run`), await rows(`SELECT * FROM model_call`), out, err]);
});
afterAll(async () => {
  await t?.drop();
  rmSync(scratch, { recursive: true, force: true });
});

const changed = (): string[] => Object.keys(after).filter((k) => after[k] !== before[k]).sort();
const targets = (): Record<string, { target: string }> => JSON.parse(readFileSync(join(ROOT, "scripts/script-targets.json"), "utf8"));

describe("WF-34 obligations", () => {
  it("GR-9: nothing restricted is stored; the importer never opens the restricted folder [invariant]", () => {
    expect(dump).not.toContain("restricted");
    expect(readFileSync(join(ROOT, "ops/import-spike.ts"), "utf8")).not.toMatch(/source\/restricted/);
  });

  it("GR-13: only experiment_run gained a row; no account or student data [invariant]", () => {
    expect(code).toBe(0);
    expect(changed()).toEqual(["experiment_run"]);
    expect(after["experiment_run"]).toBe((before["experiment_run"] ?? 0) + 1);
    expect(after["app_user"]).toBe(before["app_user"]);
  });

  it("OBS-1: the real CLI entry produces the row with experiment_id, report_path and the headline numbers [capture]", async () => {
    const r = (await rows(`SELECT id, report_path, result_json FROM experiment_run`))[0] as { id: string; report_path: string; result_json: any };
    expect(r.id).toBe("SP-3-20261025");
    expect(r.report_path).toContain("SP-3-invention-scans.md");
    expect(r.result_json.options.A.plants_caught).toEqual({ caught: 11, total: 11 });
    expect(r.result_json.options.B.plants_caught).toEqual({ caught: 11, total: 11 });
  });

  it("OBS-7: no provider key, restricted path or held-out marker reaches rows, stdout or stderr [invariant]", () => {
    expect(code).toBe(0);
    for (const m of MARKERS) expect(dump).not.toContain(m);
  });

  it("OBS-11: WF-34 row registered; ops:import-spike maps to ops/import-spike.ts [invariant]", () => {
    expect(readFileSync(join(ROOT, "docs/design/observability.md"), "utf8")).toContain("| WF-34 |");
    expect(targets()["ops:import-spike"]?.target).toBe("ops/import-spike.ts");
    expect((JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> }).scripts["ops:import-spike"]).toContain("ops:import-spike");
  });
});
