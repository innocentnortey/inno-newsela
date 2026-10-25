// NL-87: WF-32 obligations, one case per id, driven through the real CLI entry (ops/import-spike.ts `main`) on the SP-1 fixture.
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
const REPORT = join(FX, "SP-1-one-call-draft.md");
const MARKERS = ["sk-ant-TESTMARKER00112233", "docs/source/restricted/", "HELDOUT-UNIT4-MARKER"];
const scratch = mkdtempSync(join(tmpdir(), "nl87-wf32-"));
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
  const md = join(scratch, "SP-1-one-call-draft.md");
  writeFileSync(md, `${readFileSync(REPORT, "utf8")}\n\nNote: ${MARKERS.join(" ")}\n`);
  const calls = join(scratch, "SP-1-one-call-draft.calls.json");
  const o = JSON.parse(readFileSync(join(FX, "SP-1-one-call-draft.calls.json"), "utf8"));
  o.calls[0].secret_note = MARKERS.join(" ");
  writeFileSync(calls, JSON.stringify(o));
  before = await counts();
  vi.spyOn(process.stdout, "write").mockImplementation((s: string | Uint8Array) => ((out += String(s)), true));
  vi.spyOn(process.stderr, "write").mockImplementation((s: string | Uint8Array) => ((err += String(s)), true));
  code = await main([md, "--calls", calls], {}, deps);
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

describe("WF-32 obligations", () => {
  const mc = async (): Promise<Record<string, unknown>[]> => rows(`SELECT * FROM model_call ORDER BY provider_request_id`);

  it("R-55: calls carry latency and cost so per-lesson time and unit cost are computable [invariant]", async () => {
    const fixture = JSON.parse(readFileSync(join(FX, "SP-1-one-call-draft.calls.json"), "utf8")) as { calls: { latency_ms: number; row: string; run: string; cost_usd: string }[] };
    expect(fixture.calls.every((c) => c.latency_ms >= 1)).toBe(true);
    const stored = await mc();
    expect(stored).toHaveLength(13);
    expect(stored.every((r) => Number(r["cost_usd"]) > 0)).toBe(true);
    for (const row of ["row08", "row09", "row25"]) {
      const sum = fixture.calls.filter((c) => c.row === row && c.run.startsWith("A-")).reduce((s, c) => s + Number(c.cost_usd), 0);
      expect(sum).toBeGreaterThan(0);
      expect(sum).toBeLessThanOrEqual(1);
    }
  });

  it("GR-9: nothing restricted is stored [invariant]", () => {
    expect(dump).not.toContain("restricted");
    expect(readFileSync(join(ROOT, "ops/import-spike.ts"), "utf8")).not.toMatch(/source\/restricted/);
  });

  it("GR-10: prompts are a placeholder; no table, vector or file store is created [invariant]", async () => {
    const stored = await mc();
    expect(new Set(stored.map((r) => r["rendered_prompt"]))).toEqual(new Set(["[spike import: prompt not retained]"]));
    expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());
    const cols = await rows(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('model_call','experiment_run')`);
    expect(cols.some((c) => /vector|file/i.test(String(c["column_name"])) || /vector/i.test(String(c["data_type"])))).toBe(false);
  });

  it("GR-11: no held-out Unit 4 text is stored [invariant]", () => {
    expect(dump).not.toContain("HELDOUT-UNIT4-MARKER");
  });

  it("GR-13: only experiment_run and model_call gained rows; no account data [invariant]", () => {
    expect(code).toBe(0);
    expect(changed()).toEqual(["experiment_run", "model_call"]);
    expect(after["model_call"]).toBe((before["model_call"] ?? 0) + 13);
    expect(after["app_user"]).toBe(before["app_user"]);
  });

  it("OBS-7: no provider key, restricted path or held-out marker reaches rows, stdout or stderr [invariant]", () => {
    expect(code).toBe(0);
    for (const m of MARKERS) expect(dump).not.toContain(m);
  });

  it("OBS-11: WF-32 row registered; ops:import-spike maps to ops/import-spike.ts [invariant]", () => {
    expect(readFileSync(join(ROOT, "docs/design/observability.md"), "utf8")).toContain("| WF-32 |");
    expect(targets()["ops:import-spike"]?.target).toBe("ops/import-spike.ts");
    expect((JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { scripts: Record<string, string> }).scripts["ops:import-spike"]).toContain("ops:import-spike");
  });

  it("M-16: per-lesson time is computable from the stored SP-1 wall_s values [invariant]", async () => {
    const r = (await rows(`SELECT result_json FROM experiment_run`))[0] as { result_json: { rows: { option: string; item: string; wall_s: number }[] } };
    const a = r.result_json.rows.filter((x) => x.option === "A");
    expect(a.find((x) => x.item.startsWith("row 8"))?.wall_s).toBe(83.1);
    expect(a.find((x) => x.item.startsWith("row 9"))?.wall_s).toBe(119.7);
    expect(a.find((x) => x.item.startsWith("row 25"))?.wall_s).toBe(56.6);
  });

  it("M-29: the build-spend query includes the spike calls [invariant]", async () => {
    const m = (await rows(`select sum(cost_usd)/75 as value, count(*) as n from model_call`))[0] as { value: string; n: string };
    expect(Number(m.n)).toBe(13);
    expect(Number(m.value)).toBeGreaterThan(0);
  });
});
