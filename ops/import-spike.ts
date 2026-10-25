// NL-87: spike report importer (WF-32, WF-33, WF-34).
// usage: tsx ops/import-spike.ts <report.md> [--calls <calls.json>] [--run-suffix <suffix>]
// Reads a committed spike record (docs/analysis/spikes/SP-N-*.md, its Results tables) and writes one experiment_run row;
// for SP-1 also one model_call row per call listed in the *.calls.json sidecar, so M-29 (build spend) includes spike spend.
// Everything is parsed and validated before the first write. Re-importing writes nothing. It stores only parsed numbers
// and labels: never prose, prompts, model output or a cell value in an error (OBS-7, GR-9).
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { pathToFileURL } from "node:url";
import { read_secret_url } from "@ls/config/env";
import { SystemClock } from "@ls/core/ports/clock";
import type { JsonValue, ModelCallId, RequestId } from "@ls/core/ports/common";
import type { EvidenceRepo } from "@ls/core/ports/evidence";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import type { ModelCallLog } from "@ls/core/ports/model-call-log";
import { PgEvidenceRepo } from "@ls/db/repos/evidence";
import { PgModelCallLog } from "@ls/db/repos/model-calls";
import { PgDatabase } from "@ls/db/pool";
import { git_short_sha, resolve_build_id } from "@ls/obs/build-id";
import Decimal from "decimal.js";

export interface ImportReport {
  experiment_id: string;
  model_calls_imported: number;
}

// Narrow port: only what idempotency needs.
export interface SpikeStore {
  has_experiment(experiment_id: string): Promise<boolean>;
  // The row for this provider call, if any: 'sent' means an earlier import stopped between the two writes.
  find_call(experiment_id: string, provider_request_id: string): Promise<{ model_call_id: ModelCallId; status: string } | null>;
}

export interface ImportDeps {
  evidence: EvidenceRepo;
  model_calls: ModelCallLog;
  store: SpikeStore;
}

export type SpikeRule = "missing" | "not_numeric" | "bad_shape" | "unknown_spike";

// The message names the file, the place and the rule. It never holds a cell value.
export class SpikeReportError extends Error {
  constructor(
    readonly file: string,
    readonly where: string,
    readonly rule: SpikeRule,
  ) {
    super(`${file}: ${where}: ${rule}`);
    this.name = "SpikeReportError";
  }
}

export interface SpikeCall {
  call_id: string;
  run: string;
  row: string;
  kind: string;
  attempt: number;
  requested_model: string;
  served_model: string;
  stop_reason: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  cost_usd: string;
  latency_ms: number;
}

export interface ParsedSpike {
  experiment_id: string;
  config: Record<string, JsonValue>;
  result: Record<string, JsonValue>;
  calls: SpikeCall[];
}

const PROMPT_PLACEHOLDER = "[spike import: prompt not retained]";
const DEFAULT_RUN_SUFFIX = "20261025";
const DEFAULT_PLANTS_TOTAL = 12;

// ---------- tables ----------

interface Table {
  n: number; // 1-based position in the file
  header: string[];
  rows: string[][]; // data rows, separator removed
}

const strip = (s: string): string => s.replaceAll("**", "").replaceAll("`", "").trim();

function split_cells(line: string): string[] {
  const parts = line.split("|").map((c) => c.trim());
  return parts.slice(1, parts.length - 1);
}

function read_tables(text: string): Table[] {
  const lines = text.split("\n");
  const tables: Table[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!(lines[i] ?? "").startsWith("|")) {
      i += 1;
      continue;
    }
    const run: string[] = [];
    while (i < lines.length && (lines[i] ?? "").startsWith("|")) {
      run.push(lines[i] as string);
      i += 1;
    }
    if (run.length >= 2) {
      const [head, , ...body] = run;
      tables.push({ n: tables.length + 1, header: split_cells(head as string).map(strip), rows: body.map(split_cells) });
    }
  }
  return tables;
}

const NUM = /-?\d[\d,]*(\.\d+)?/g;

function numbers_in(cell: string): number[] {
  return [...cell.matchAll(NUM)].map((m) => Number(m[0].replaceAll(",", "")));
}

class Reader {
  constructor(readonly file: string) {}

  where(t: Table, r: number, c: number): string {
    return `table ${t.n} row ${r + 1} col ${c + 1}`;
  }

  cell(t: Table, r: number, c: number): string {
    const v = t.rows[r]?.[c];
    if (v === undefined) throw new SpikeReportError(this.file, this.where(t, r, c), "missing");
    return v;
  }

  num(t: Table, r: number, c: number): number {
    const n = numbers_in(this.cell(t, r, c))[0];
    if (n === undefined || !Number.isFinite(n)) throw new SpikeReportError(this.file, this.where(t, r, c), "not_numeric");
    return n;
  }

  // "20/20, 0 ✓" -> {pass: 20, total: 20}
  fraction(t: Table, r: number, c: number): { pass: number; total: number } {
    const m = /^(\d+)\/(\d+)/.exec(strip(this.cell(t, r, c)));
    if (!m) throw new SpikeReportError(this.file, this.where(t, r, c), "not_numeric");
    return { pass: Number(m[1]), total: Number(m[2]) };
  }

  // exactly `count` numbers, in order
  list(t: Table, r: number, c: number, count: number): number[] {
    const ns = numbers_in(strip(this.cell(t, r, c)));
    if (ns.length < count) throw new SpikeReportError(this.file, this.where(t, r, c), "not_numeric");
    return ns.slice(0, count);
  }

  table(tables: Table[], what: string, pred: (t: Table) => boolean): Table {
    const found = tables.filter(pred);
    const last = found[found.length - 1];
    if (!last) throw new SpikeReportError(this.file, `table ${what}`, "missing");
    return last;
  }

  row_by_prefix(t: Table, key: string, prefix: string): number {
    const r = t.rows.findIndex((row) => strip(row[0] ?? "").startsWith(prefix));
    if (r < 0) throw new SpikeReportError(this.file, `table ${t.n} row ${key}`, "missing");
    return r;
  }

  col_by_prefix(t: Table, key: string, prefix: string): number {
    const c = t.header.findIndex((h, i) => i >= 2 && h.startsWith(prefix));
    if (c < 0) throw new SpikeReportError(this.file, `table ${t.n} col ${key}`, "missing");
    return c;
  }
}

// ---------- SP-1 ----------

function sp1_result(rd: Reader, text: string, tables: Table[]): Record<string, JsonValue> {
  const t = rd.table(tables, "comparison", (x) => x.header[0] === "Option" && x.header[1] === "Item");
  const rows: JsonValue[] = t.rows.map((row, r) => {
    const schema = strip(rd.cell(t, r, 2));
    const slash = schema.indexOf("/");
    const first = schema.startsWith("yes");
    const final = slash >= 0 ? schema.slice(slash + 1).trim().startsWith("yes") : first;
    const words_cell = strip(rd.cell(t, r, 6));
    const req_cell = strip(rd.cell(t, r, 7));
    const dash = (s: string): boolean => s.startsWith("—") || s.startsWith("-");
    let required_passed: number | null = null;
    let required_total: number | null = null;
    if (!dash(req_cell)) {
      const f = rd.fraction(t, r, 7);
      required_passed = f.pass;
      required_total = f.total;
    }
    return {
      option: strip(rd.cell(t, r, 0)),
      item: strip(rd.cell(t, r, 1)),
      valid_first_try: first,
      valid_final: final,
      truncations: rd.num(t, r, 3),
      wall_s: rd.num(t, r, 4),
      cost_usd: rd.num(t, r, 5),
      words: dash(words_cell) ? null : rd.num(t, r, 6),
      required_passed,
      required_total,
      within_pass_line: rd.cell(t, r, 8).includes("✓"),
    };
  });
  const rl = rd.table(tables, "rate-limit", (x) => x.header[0] === "Header" && x.header[1] === "Value");
  const key_of = (label: string): string | null =>
    label.includes("requests-limit") ? "requests" : label.includes("input-tokens-limit") ? "input_tokens" : label.includes("output-tokens-limit") ? "output_tokens" : null;
  const rate_limit: Record<string, number> = {};
  rl.rows.forEach((row, r) => {
    const k = key_of(strip(row[0] ?? ""));
    if (k) rate_limit[k] = rd.num(rl, r, 1);
  });
  for (const k of ["requests", "input_tokens", "output_tokens"]) {
    if (rate_limit[k] === undefined) throw new SpikeReportError(rd.file, `table ${rl.n} row ${k}`, "missing");
  }
  return { overall_pass: text.includes("OVERALL: PASS"), rows, rate_limit };
}

// imported = the sum as the model_call column stores it (each call rounded to 6 dp), i.e. what M-29 sums.
// The record states the ledger total and the real provider spend; the imported calls cover only part of it.
function sp1_spend(file: string, text: string, imported: Decimal): Record<string, JsonValue> {
  const led = /Spend used \(ledger\):\**\s*\$(\d+(?:\.\d+)?)/.exec(text);
  const real = /real provider spend\s*≈\s*\$(\d+(?:\.\d+)?)/.exec(text);
  if (!led || !real) throw new SpikeReportError(file, "spend", "bad_shape");
  const recorded = Number(led[1]);
  return { imported_usd: Number(imported.toFixed(6)), recorded_ledger_usd: recorded, real_spend_approx_usd: Number(real[1]), partial: imported.lessThan(new Decimal(recorded)) };
}

// ---------- SP-1 calls sidecar ----------

const STR_FIELDS = ["call_id", "run", "row", "kind", "requested_model", "served_model", "stop_reason"] as const;
const INT_FIELDS = ["attempt", "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens", "latency_ms"] as const;

function read_calls(calls_path: string): { experiment_id: string; calls: SpikeCall[] } {
  let raw: string;
  try {
    raw = readFileSync(calls_path, "utf8");
  } catch {
    throw new SpikeReportError(calls_path, "calls file", "missing");
  }
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch {
    throw new SpikeReportError(calls_path, "calls file", "bad_shape");
  }
  const top = (doc ?? {}) as Record<string, unknown>;
  const experiment_id = top["experiment_id"];
  if (typeof experiment_id !== "string" || !experiment_id.startsWith("SP-1")) throw new SpikeReportError(calls_path, "experiment_id", "bad_shape");
  const ledger = top["recorded_calls_total_usd"];
  if (typeof ledger !== "string" || !/^\d+(\.\d+)?$/.test(ledger)) throw new SpikeReportError(calls_path, "recorded_calls_total_usd", "not_numeric");
  const list = top["calls"];
  if (!Array.isArray(list) || list.length === 0) throw new SpikeReportError(calls_path, "calls", "missing");
  const calls: SpikeCall[] = [];
  const seen = new Set<string>();
  list.forEach((item, idx) => {
    const i = idx + 1;
    const o = (item ?? {}) as Record<string, unknown>;
    const out: Record<string, string | number> = {};
    for (const f of STR_FIELDS) {
      const v = o[f];
      if (v === undefined || v === null || v === "") throw new SpikeReportError(calls_path, `call ${i} ${f}`, "missing");
      if (typeof v !== "string") throw new SpikeReportError(calls_path, `call ${i} ${f}`, "bad_shape");
      out[f] = v;
    }
    for (const f of INT_FIELDS) {
      const v = o[f];
      if (v === undefined || v === null) throw new SpikeReportError(calls_path, `call ${i} ${f}`, "missing");
      if (typeof v !== "number" || !Number.isInteger(v) || v < 0) throw new SpikeReportError(calls_path, `call ${i} ${f}`, "not_numeric");
      out[f] = v;
    }
    const cost = o["cost_usd"];
    if (cost === undefined || cost === null) throw new SpikeReportError(calls_path, `call ${i} cost_usd`, "missing");
    if (typeof cost !== "string" || !/^\d+(\.\d+)?$/.test(cost)) throw new SpikeReportError(calls_path, `call ${i} cost_usd`, "not_numeric");
    if (seen.has(out["call_id"] as string)) throw new SpikeReportError(calls_path, `call ${i} call_id`, "bad_shape");
    seen.add(out["call_id"] as string);
    calls.push({ ...(out as unknown as Omit<SpikeCall, "cost_usd">), cost_usd: cost });
  });
  const total = calls.reduce((s, c) => s.plus(new Decimal(c.cost_usd)), new Decimal(0));
  if (total.toDecimalPlaces(6).minus(new Decimal(ledger)).abs().greaterThan(new Decimal("0.00001"))) {
    throw new SpikeReportError(calls_path, "recorded_calls_total_usd", "bad_shape");
  }
  return { experiment_id, calls };
}

// ---------- SP-2 ----------

const SP2_ASSERTIONS: [string, string][] = [
  ["no_edits_after_lock", "No edits after a lock"],
  ["no_silent_keystroke_losses", "No silent keystroke losses"],
  ["round_trip_hash_stable", "Round trip keeps the hash"],
  ["stale_approve_409_no_change", "Stale approve"],
  ["approver_client_hash_matches", "Approver client hash"],
];

function sp2_result(rd: Reader, tables: Table[]): { result: Record<string, JsonValue>; trials: number } {
  const t = rd.table(tables, "measure", (x) => x.header[0] === "Measure" && x.header[1] === "Pass line");
  const cols = { A: rd.col_by_prefix(t, "A", "A"), B: rd.col_by_prefix(t, "B", "B"), Control: rd.col_by_prefix(t, "Control", "Control") };
  const rows = {
    store: rd.row_by_prefix(t, "store_ms", "Store transaction"),
    submit: rd.row_by_prefix(t, "submit_ms", "Submit duration"),
    resurrected: rd.row_by_prefix(t, "resurrected", "Resurrected keystrokes"),
    verdict: rd.row_by_prefix(t, "verdict", "Verdict"),
  };
  const options: Record<string, JsonValue> = {};
  for (const opt of ["A", "B"] as const) {
    const c = cols[opt];
    const assertions: Record<string, JsonValue> = {};
    for (const [key, prefix] of SP2_ASSERTIONS) assertions[key] = rd.fraction(t, rd.row_by_prefix(t, key, prefix), c);
    const [p50, p95, n] = rd.list(t, rows.store, c, 3);
    const [s50, s95] = rd.list(t, rows.submit, c, 2);
    options[opt] = {
      assertions,
      store_ms: { p50: p50 as number, p95: p95 as number, n: n as number },
      submit_ms: { p50: s50 as number, p95: s95 as number },
      resurrected: rd.num(t, rows.resurrected, c),
    };
  }
  const control: Record<string, JsonValue> = {};
  for (const [key, prefix] of SP2_ASSERTIONS) control[key] = rd.fraction(t, rd.row_by_prefix(t, key, prefix), cols.Control);
  const verdict_of = (c: number): string => strip(rd.cell(t, rows.verdict, c)).split(/\s+/)[0] ?? "";
  const first_a = (options["A"] as { assertions: Record<string, { total: number }> }).assertions["no_edits_after_lock"];
  return {
    result: { options, control: { assertions: control }, verdict: { A: verdict_of(cols.A), B: verdict_of(cols.B) } },
    trials: first_a?.total ?? 0,
  };
}

// ---------- SP-3 ----------

function sp3_result(rd: Reader, text: string, tables: Table[]): Record<string, JsonValue> {
  const t = rd.table(tables, "measure", (x) => x.header[0] === "Measure" && x.header[1] === "Pass line");
  const cols = { A: rd.col_by_prefix(t, "A", "A"), B: rd.col_by_prefix(t, "B", "B") };
  const r_plants = rd.row_by_prefix(t, "plants_caught", "Code-detectable plants caught");
  const r_all = rd.row_by_prefix(t, "false_flags_per_lesson", "False flags per clean lesson");
  const r_cfu = rd.row_by_prefix(t, "false_flags_cfu", "False flags in check items");
  const r_scope = rd.row_by_prefix(t, "name_scan_scope", "Name scan scope verdict");
  const four = (r: number, c: number): JsonValue => {
    const [a, b, c2, d] = rd.list(t, r, c, 4);
    return { row08: a as number, row09: b as number, row25: c2 as number, row39: d as number };
  };
  const options: Record<string, JsonValue> = {};
  for (const opt of ["A", "B"] as const) {
    const c = cols[opt];
    const f = rd.fraction(t, r_plants, c);
    options[opt] = {
      plants_caught: { caught: f.pass, total: f.total },
      false_flags_per_lesson: four(r_all, c),
      false_flags_cfu: four(r_cfu, c),
      name_scan_scope: strip(rd.cell(t, r_scope, c)),
    };
  }
  const rec_at = text.indexOf("Recommendation:");
  const rec = rec_at >= 0 ? /option \*\*([A-Z])\*\*/.exec(text.slice(rec_at)) : null;
  const thr = /span\s*[≥>=]+\s*(\d+)\s*words/i.exec(text);
  if (!rec || !thr) throw new SpikeReportError(rd.file, "recommendation", "bad_shape");
  return { options, recommended_option: rec[1] as string, quote_threshold_words: Number(thr[1]) };
}

// ---------- parse ----------

export interface ImportOpts {
  calls_path?: string;
  run_suffix?: string; // experiment id suffix for SP-2 and SP-3 (SP-1 takes its id from the sidecar)
}

export function parse_spike_report(path: string, opts: ImportOpts = {}): ParsedSpike {
  const m = /^(SP-[123])-/.exec(basename(path));
  if (!m) throw new SpikeReportError(path, "file name", "unknown_spike");
  const spike = m[1] as string;
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    throw new SpikeReportError(path, "report file", "missing");
  }
  const tables = read_tables(text);
  const rd = new Reader(path);
  const source_record = basename(path);
  const suffix = opts.run_suffix ?? DEFAULT_RUN_SUFFIX;
  if (spike === "SP-1") {
    const model = "claude-sonnet-5-5";
    if (!text.includes(model)) throw new SpikeReportError(path, "model", "bad_shape");
    const result = sp1_result(rd, text, tables);
    const { experiment_id, calls } = read_calls(opts.calls_path ?? path.replace(/\.md$/, ".calls.json"));
    return { experiment_id, config: { spike, model, source_record, spend: sp1_spend(path, text, calls.reduce((t, c) => t.plus(new Decimal(c.cost_usd).toFixed(6)), new Decimal(0))) }, result, calls };
  }
  if (spike === "SP-2") {
    const { result, trials } = sp2_result(rd, tables);
    return { experiment_id: `SP-2-${suffix}`, config: { spike, trials, source_record }, result, calls: [] };
  }
  const planted = /(\d+) planted errors/.exec(text);
  const plants_total = planted ? Number(planted[1]) : DEFAULT_PLANTS_TOTAL;
  return { experiment_id: `SP-3-${suffix}`, config: { spike, plants_total, source_record }, result: sp3_result(rd, text, tables), calls: [] };
}

// ---------- import ----------

export async function import_spike_report(path: string, deps: ImportDeps, opts: ImportOpts = {}): Promise<ImportReport> {
  const parsed = parse_spike_report(path, opts); // validate everything before the first write
  let imported = 0;
  for (const call of parsed.calls) {
    const existing = await deps.store.find_call(parsed.experiment_id, call.call_id);
    if (existing && existing.status !== "sent") continue;
    // The two writes are separate transactions (the port owns them). The provider call id goes in request_id on insert,
    // so a run that stopped between them leaves a findable 'sent' row, which the next run completes instead of duplicating.
    const id: ModelCallId = existing?.model_call_id ?? await deps.model_calls.insert_sent({
      run_id: null,
      lesson_id: null,
      job_id: null,
      attempt: call.attempt,
      purpose: "spike",
      alias: "GENERATION",
      requested_model: call.requested_model,
      rendered_prompt: PROMPT_PLACEHOLDER,
      request_id: call.call_id as RequestId,
      experiment_id: parsed.experiment_id,
      reservation_id: null,
    });
    await deps.model_calls.complete(id, {
      raw_output: "",
      stop_reason: call.stop_reason,
      usage: {
        input_tokens: call.input_tokens,
        output_tokens: call.output_tokens,
        cache_read_tokens: call.cache_read_tokens,
        cache_write_tokens: call.cache_write_tokens,
      },
      cost_usd: new Decimal(call.cost_usd),
      served_model: call.served_model,
      provider_request_id: call.call_id,
      latency_ms: call.latency_ms,
    });
    imported += 1;
  }
  if (!(await deps.store.has_experiment(parsed.experiment_id))) {
    await deps.evidence.insert_experiment_run({ experiment_id: parsed.experiment_id, config: parsed.config, result: parsed.result, report_path: path });
  }
  return { experiment_id: parsed.experiment_id, model_calls_imported: imported };
}

export class PgSpikeStore implements SpikeStore {
  constructor(private readonly db: PgDatabase) {}

  has_experiment(experiment_id: string): Promise<boolean> {
    return this.db.with_tx(async (tx) => (await tx.query(`SELECT 1 FROM experiment_run WHERE id = $1`, [experiment_id])).rows.length > 0);
  }

  // No unique index on (experiment_id, provider_request_id) exists yet: two concurrent imports could still double-insert.
  find_call(experiment_id: string, provider_request_id: string): Promise<{ model_call_id: ModelCallId; status: string } | null> {
    return this.db.with_tx(async (tx) => {
      const r = (
        await tx.query<{ id: string; status: string }>(
          `SELECT id, status FROM model_call WHERE experiment_id = $1 AND (provider_request_id = $2 OR request_id = $2) ORDER BY (status = 'sent') LIMIT 1`,
          [experiment_id, provider_request_id],
        )
      ).rows[0];
      return r ? { model_call_id: r.id as ModelCallId, status: r.status } : null;
    });
  }
}

// ---------- CLI ----------

export async function main(argv: string[], env: NodeJS.ProcessEnv = process.env, deps?: ImportDeps): Promise<number> {
  const args = [...argv];
  let calls_path: string | undefined;
  const flag = args.indexOf("--calls");
  if (flag >= 0) {
    calls_path = args[flag + 1];
    args.splice(flag, 2);
  }
  let run_suffix: string | undefined;
  const sflag = args.indexOf("--run-suffix");
  if (sflag >= 0) {
    run_suffix = args[sflag + 1];
    args.splice(sflag, 2);
  }
  const report = args[0];
  if (!report || (flag >= 0 && !calls_path) || (sflag >= 0 && !run_suffix)) {
    process.stderr.write("usage: import-spike <report.md> [--calls <calls.json>] [--run-suffix <suffix>]\n");
    return 2;
  }
  let db: PgDatabase | undefined;
  try {
    let use = deps;
    if (!use) {
      const build_id = env["BUILD_ID"] ? env["BUILD_ID"] : resolve_build_id(env, git_short_sha);
      const settings = {
        database_url: read_secret_url(env, "DATABASE_URL", ["postgres:", "postgresql:"]),
        pg_pool_max: 1,
        build_id,
        log_level: "info" as const,
      };
      db = new PgDatabase(settings, 1, 2000);
      const d = { db, ids: new PrefixedIdGenerator(), clock: new SystemClock() };
      use = { evidence: new PgEvidenceRepo(d), model_calls: new PgModelCallLog(d), store: new PgSpikeStore(db) };
    }
    const r = await import_spike_report(report, use, { ...(calls_path !== undefined ? { calls_path } : {}), ...(run_suffix !== undefined ? { run_suffix } : {}) });
    process.stdout.write(`${JSON.stringify({ event: "spike_import", experiment_id: r.experiment_id, model_calls_imported: r.model_calls_imported })}\n`);
    return 0;
  } catch (e) {
    if (e instanceof SpikeReportError) process.stderr.write(`${e.message}\n`);
    else process.stderr.write(`import-spike failed: ${e instanceof Error ? e.name : "Error"}\n`);
    return 1;
  } finally {
    if (db) await db.close().catch(() => undefined);
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).then((c) => process.exit(c));
}
