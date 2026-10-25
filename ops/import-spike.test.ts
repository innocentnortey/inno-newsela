/* eslint-disable @typescript-eslint/no-explicit-any -- parsed JSON result trees are asserted by path */
// NL-87: spike importer behaviour tests (WF-32, WF-33, WF-34). Real Postgres via create_test_db; the CLI entry `main` is the driver.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { SystemClock } from "@ls/core/ports/clock";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { PgModelCallLog } from "@ls/db/repos/model-calls";
import { create_test_db, type TestDb } from "@ls/db/testing/test-db";
import Decimal from "decimal.js";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { main, parse_spike_report, PgSpikeStore, type ImportDeps } from "./import-spike.ts";

const ROOT = resolve(import.meta.dirname, "..");
const FX = join(ROOT, "evals/tests/fixtures/spike");
const SP1 = join(FX, "SP-1-one-call-draft.md");
const SP2 = join(FX, "SP-2-freeze-at-submit.md");
const SP3 = join(FX, "SP-3-invention-scans.md");
const REAL = join(ROOT, "docs/analysis/spikes");
const M29 = `select sum(cost_usd)/75 as value, count(*) as n from model_call`;

let t: TestDb;
let deps: ImportDeps;
const scratch = mkdtempSync(join(tmpdir(), "nl87-"));

beforeAll(async () => {
  t = await create_test_db();
  const d = { db: t.db, ids: new PrefixedIdGenerator(), clock: new SystemClock() };
  deps = { evidence: new PgEvidenceRepo(d), model_calls: new PgModelCallLog(d), store: new PgSpikeStore(t.db) };
});
afterAll(async () => {
  await t?.drop();
  rmSync(scratch, { recursive: true, force: true });
});
afterEach(async () => {
  vi.restoreAllMocks();
  await t.db.with_tx((tx) => tx.query(`TRUNCATE experiment_run, model_call`));
});

async function run(argv: string[]): Promise<{ code: number; out: string; err: string }> {
  let out = "";
  let err = "";
  vi.spyOn(process.stdout, "write").mockImplementation((s: string | Uint8Array) => ((out += String(s)), true));
  vi.spyOn(process.stderr, "write").mockImplementation((s: string | Uint8Array) => ((err += String(s)), true));
  const code = await main(argv, {}, deps);
  vi.restoreAllMocks();
  return { code, out, err };
}

async function rows(sql: string, params: unknown[] = []): Promise<Record<string, unknown>[]> {
  return t.db.with_tx(async (tx) => (await tx.query(sql, params)).rows);
}
const count = async (table: string): Promise<number> => Number((await rows(`SELECT count(*)::int AS n FROM ${table}`))[0]?.["n"]);

// a scratch copy of the SP-1 fixture pair, optionally edited
function scratch_sp1(name: string, edit_md: (s: string) => string = (s) => s, edit_calls: (o: any) => void = () => undefined): { md: string; calls: string } {
  const dir = join(scratch, name);
  mkdirSync(dir, { recursive: true });
  const md = join(dir, "SP-1-one-call-draft.md");
  const calls = join(dir, "SP-1-one-call-draft.calls.json");
  writeFileSync(md, edit_md(readFileSync(SP1, "utf8")));
  const o = JSON.parse(readFileSync(join(FX, "SP-1-one-call-draft.calls.json"), "utf8"));
  edit_calls(o);
  writeFileSync(calls, JSON.stringify(o));
  return { md, calls };
}

describe("import-spike", () => {
  it("test_experiment_import: SP-1 writes one experiment_run and one model_call per recorded call", async () => {
    const r = await run([SP1]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toEqual({ event: "spike_import", experiment_id: "SP-1-20261025", model_calls_imported: 13 });
    const exp = await rows(`SELECT id, report_path, config_json, result_json FROM experiment_run`);
    expect(exp).toHaveLength(1);
    expect(exp[0]?.["id"]).toBe("SP-1-20261025");
    expect(exp[0]?.["report_path"]).toBe(SP1);
    const fixture = JSON.parse(readFileSync(join(FX, "SP-1-one-call-draft.calls.json"), "utf8")) as { calls: Record<string, any>[] };
    const mc = await rows(`SELECT * FROM model_call ORDER BY provider_request_id`);
    expect(mc).toHaveLength(13);
    for (const row of mc) {
      const c = fixture.calls.find((x) => x["call_id"] === row["provider_request_id"]);
      expect(c).toBeDefined();
      expect(row["purpose"]).toBe("spike");
      expect(row["run_id"]).toBeNull();
      expect(row["reservation_id"]).toBeNull();
      expect(row["experiment_id"]).toBe("SP-1-20261025");
      expect(row["status"]).toBe("completed");
      expect(row["input_tokens"]).toBe(c?.["input_tokens"]);
      expect(row["output_tokens"]).toBe(c?.["output_tokens"]);
      expect(row["cache_read_tokens"]).toBe(c?.["cache_read_tokens"]);
      expect(row["cache_write_tokens"]).toBe(c?.["cache_write_tokens"]);
      expect(row["stop_reason"]).toBe(c?.["stop_reason"]);
      expect(row["served_model"]).toBe(c?.["served_model"]);
      expect(Number(row["cost_usd"])).toBe(Number(new Decimal(c?.["cost_usd"]).toFixed(6)));
    }
    // imported numbers equal the committed record
    const real = parse_spike_report(join(REAL, "SP-1-one-call-draft.md"), { calls_path: join(FX, "SP-1-one-call-draft.calls.json") });
    expect(exp[0]?.["result_json"]).toEqual(real.result);
  });

  it("test_experiment_import: SP-2 writes assertion results and store p95, no model_call", async () => {
    const r = await run([SP2]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toEqual({ event: "spike_import", experiment_id: "SP-2-20261025", model_calls_imported: 0 });
    const exp = await rows(`SELECT id, report_path, config_json, result_json FROM experiment_run`);
    expect(exp).toHaveLength(1);
    expect(exp[0]?.["report_path"]).toBe(SP2);
    const res = exp[0]?.["result_json"] as any;
    expect(res.options.A.assertions.no_edits_after_lock).toEqual({ pass: 20, total: 20 });
    expect(res.options.A.store_ms.p95).toBe(25.1);
    expect(res.options.B.store_ms.p95).toBe(25.8);
    expect(res.options.B.resurrected).toBe(120);
    expect(res.control.assertions.no_edits_after_lock).toEqual({ pass: 0, total: 3 });
    expect(res.verdict).toEqual({ A: "PASS", B: "PASS" });
    expect((exp[0]?.["config_json"] as any).trials).toBe(20);
    expect(await count("model_call")).toBe(0);
    expect(res).toEqual(parse_spike_report(join(REAL, "SP-2-freeze-at-submit.md")).result);
  });

  it("test_experiment_import: SP-3 writes plant results, no model_call", async () => {
    const r = await run([SP3]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out)).toEqual({ event: "spike_import", experiment_id: "SP-3-20261025", model_calls_imported: 0 });
    const exp = await rows(`SELECT report_path, result_json FROM experiment_run`);
    expect(exp).toHaveLength(1);
    expect(exp[0]?.["report_path"]).toBe(SP3);
    const res = exp[0]?.["result_json"] as any;
    expect(res.options.B.plants_caught).toEqual({ caught: 11, total: 11 });
    expect(res.options.A.false_flags_per_lesson).toEqual({ row08: 30, row09: 24, row25: 8, row39: 3 });
    expect(res.options.B.false_flags_cfu).toEqual({ row08: 0, row09: 0, row25: 0, row39: 0 });
    expect(res.recommended_option).toBe("B");
    expect(res.quote_threshold_words).toBe(3);
    expect(await count("model_call")).toBe(0);
    expect(res).toEqual(parse_spike_report(join(REAL, "SP-3-invention-scans.md")).result);
  });

  it("idempotent_reimport: a second import writes nothing", async () => {
    for (const [file, calls] of [[SP1, 13], [SP2, 0], [SP3, 0]] as const) {
      await t.db.with_tx((tx) => tx.query(`TRUNCATE experiment_run, model_call`));
      const first = await run([file]);
      expect(first.code).toBe(0);
      const before = [await count("experiment_run"), await count("model_call")];
      const second = await run([file]);
      expect(second.code).toBe(0);
      expect(JSON.parse(second.out).model_calls_imported).toBe(0);
      expect([await count("experiment_run"), await count("model_call")]).toEqual(before);
      expect(before).toEqual([1, calls]);
    }
  });

  it("build_spend_includes_spike_calls: the M-29 query sees the imported spend and the data says it is partial", async () => {
    await run([SP1]);
    const fixture = JSON.parse(readFileSync(join(FX, "SP-1-one-call-draft.calls.json"), "utf8")) as { calls: { cost_usd: string }[]; recorded_calls_total_usd: string };
    // two independent figures: the sidecar's recorded total, and the per-call costs rounded the way the column stores them
    const per_call = fixture.calls.reduce((s, c) => s.plus(new Decimal(c.cost_usd).toFixed(6)), new Decimal(0));
    const sum = new Decimal(String((await rows(`select sum(cost_usd) as s from model_call`))[0]?.["s"]));
    expect(sum.toFixed(6)).toBe(per_call.toFixed(6));
    expect(fixture.recorded_calls_total_usd).toBe("0.964289");
    expect(sum.minus(fixture.recorded_calls_total_usd).abs().lessThanOrEqualTo("0.000007")).toBe(true);
    const m29 = (await rows(M29))[0] as { value: string; n: string };
    expect(Number(m29.value)).toBeGreaterThan(0);
    expect(Number(m29.n)).toBe(13);
    const cfg = (await rows(`SELECT config_json FROM experiment_run`))[0]?.["config_json"] as { spend: Record<string, unknown> };
    expect(cfg.spend).toEqual({ imported_usd: Number(sum.toFixed(6)), recorded_ledger_usd: 3.55, real_spend_approx_usd: 1.7, partial: true });
  });

  it("interrupted_import_resumes: a stop between insert_sent and complete leaves no duplicate on the next run", async () => {
    let completes = 0;
    const flaky: ImportDeps = {
      ...deps,
      model_calls: {
        insert_sent: (s) => deps.model_calls.insert_sent(s),
        complete: async (id, d) => {
          completes += 1;
          if (completes === 3) throw new Error("killed between the two writes");
          return deps.model_calls.complete(id, d);
        },
        fail: (id, e) => deps.model_calls.fail(id, e),
        mark_lost: (j) => deps.model_calls.mark_lost(j),
        completed_for: (j, p, a) => deps.model_calls.completed_for(j, p, a),
        totals_for_run: (r) => deps.model_calls.totals_for_run(r),
      },
    };
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    expect(await main([SP1], {}, flaky)).toBe(1);
    vi.restoreAllMocks();
    expect(await count("model_call")).toBe(3);
    expect(await count("experiment_run")).toBe(0);
    expect((await rows(`SELECT status FROM model_call WHERE status='sent'`)).length).toBe(1);
    const r = await run([SP1]);
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).model_calls_imported).toBe(11); // the orphan is completed, ten new rows
    expect(await count("model_call")).toBe(13);
    expect(await count("experiment_run")).toBe(1);
    expect((await rows(`SELECT count(DISTINCT provider_request_id)::int AS n FROM model_call WHERE status='completed'`))[0]?.["n"]).toBe(13);
    expect((await rows(`SELECT 1 FROM model_call WHERE status <> 'completed'`)).length).toBe(0);
  });

  it("run_suffix_and_plants: --run-suffix sets the SP-2/SP-3 id; plants_total is read from the record when present", async () => {
    const r = await run([SP3, "--run-suffix", "99990101"]);
    expect(JSON.parse(r.out).experiment_id).toBe("SP-3-99990101");
    expect(parse_spike_report(join(REAL, "SP-3-invention-scans.md")).config["plants_total"]).toBe(12);
  });

  it("malformed_report_writes_nothing: bad cells exit non-zero before any write and name the place, not the value", async () => {
    const a = scratch_sp1("bad-cost", undefined, (o) => (o.calls[2].cost_usd = "abc"));
    const b = scratch_sp1("no-tokens", undefined, (o) => delete o.calls[4].output_tokens);
    const c_dir = join(scratch, "bad-sp2");
    mkdirSync(c_dir, { recursive: true });
    const c = join(c_dir, "SP-2-freeze-at-submit.md");
    writeFileSync(c, readFileSync(SP2, "utf8").replace("| 20/20, 0 ✓ |", "| n/a |"));
    const cases: [string[], string, string, string][] = [
      [[a.md, "--calls", a.calls], a.calls, "call 3 cost_usd", "abc"],
      [[b.md, "--calls", b.calls], b.calls, "call 5 output_tokens", "output_tokens: missing"],
      [[c], c, "table 1 row 1 col 3", "n/a"],
    ];
    for (const [argv, file, where, value] of cases) {
      const r = await run(argv);
      expect(r.code).toBe(1);
      expect(r.err).toContain(file);
      expect(r.err).toContain(where.split(" ")[0] ?? "");
      if (value !== "output_tokens: missing") expect(r.err).not.toContain(value);
      expect(r.out).toBe("");
      expect(await count("experiment_run")).toBe(0);
      expect(await count("model_call")).toBe(0);
    }
    expect((await run([a.md, "--calls", a.calls])).err).toContain("call 3 cost_usd: not_numeric");
    expect((await run([c])).err).toContain("table 1 row 1 col 3: not_numeric");
    expect((await run([join(scratch, "SP-9-x.md")])).err).toContain("unknown_spike");
  });

  it("no_secrets_or_restricted_text: seeded markers never reach rows or output", async () => {
    const markers = ["sk-ant-TESTMARKER00112233", "docs/source/restricted/", "HELDOUT-UNIT4-MARKER"];
    const s = scratch_sp1(
      "markers",
      (md) => `${md}\n\nNote: ${markers.join(" ")}\n`,
      (o) => {
        o.calls[0].secret_note = markers.join(" ");
        o.note = markers.join(" ");
      },
    );
    const r = await run([s.md, "--calls", s.calls]);
    expect(r.code).toBe(0);
    const dump = JSON.stringify([await rows(`SELECT * FROM experiment_run`), await rows(`SELECT * FROM model_call`), r.out, r.err]);
    for (const m of markers) expect(dump).not.toContain(m);
    const mc = await rows(`SELECT rendered_prompt, raw_output FROM model_call`);
    expect(new Set(mc.map((x) => x["rendered_prompt"]))).toEqual(new Set(["[spike import: prompt not retained]"]));
    expect(new Set(mc.map((x) => x["raw_output"]))).toEqual(new Set([""]));
  });
});
