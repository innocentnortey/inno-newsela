// Offline replay (NL-134 follow-up): pure helpers for re-checking stored model outputs on the current code. No database,
// no model call. The reader in replay-finals-main.ts feeds these; this file imports nothing from the project (node builtins
// only) so it can be copied into a worktree of an older commit for a baseline run.

import { createHash } from "node:crypto";

export type Which = "original" | "effective" | "last_repair" | "final";
export type CallPurpose = "lesson_draft" | "truncation_retry" | "repair";
export type StoredCall = { id: string; purpose: string; attempt: number; status: string; stop_reason: string | null; raw_output: string | null; sent_at: string };
export type OutputSource = { call_id: string; purpose: CallPurpose; attempt: number; sent_at: string; stop_reason: string | null };
export type NoOutputReason =
  | "no_draft_call" | "draft_call_has_no_output" | "truncated_without_completed_retry"
  | "retry_truncated" | "no_repair_call" | "repair_has_no_output";
export type Picked =
  | { raw_output: string; source: OutputSource }
  | { raw_output: null; reason: NoOutputReason };
export type ReplayFinding = { kind: string; level: string; message?: string; address: string | null; code: string | null; matched?: string };
export type HistoricalOutcome = { tile_state: string; repairs: number; truncation_retries: number; failure_reasons: string[] };
export type ReviewContextMode = "generation_time" | "current";
export type StateProbe = {
  review_state: { safety_flags: string[]; pending_suggestions: number; confirmations: number; previous_lesson_flags: string[]; unit_coverage_cells: number; first_stored_at: string | null };
  gen_added_blocking_kinds: string[];
  review_added_blocking_kinds: string[];
};
export type IdentityTrace = {
  pinned_outline_version: string; loader_outline_version: string; node_row_hash: string; loader_row_hash: string;
  stored_source_version: string | null; latest_unit_version: string | null; unpinned_would_differ: boolean; choices_hash: string;
};
export type ReplayRecord = {
  lesson: string; which: Which; status: string;
  source: OutputSource | null; no_output_reason: NoOutputReason | null;
  schema_issues: string[]; compile_error: string | null;
  gen: ReplayFinding[] | null; review: ReplayFinding[] | null;
  review_context: ReviewContextMode;
  identity: IdentityTrace | null; state_probe: StateProbe | null;
  historical: HistoricalOutcome;
};

const usable = (c: StoredCall): boolean => c.status === "completed" && c.raw_output !== null;
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** Deterministic call order: sent_at (fixed-width UTC text), then attempt, then id; code-unit comparison, never locale. */
export function order_calls(calls: readonly StoredCall[]): StoredCall[] {
  return [...calls].sort((a, b) => cmp(a.sent_at, b.sent_at) || a.attempt - b.attempt || cmp(a.id, b.id));
}

const src = (c: StoredCall): Picked => ({
  raw_output: c.raw_output as string,
  source: { call_id: c.id, purpose: c.purpose as CallPurpose, attempt: c.attempt, sent_at: c.sent_at, stop_reason: c.stop_reason },
});
const last = <T>(xs: readonly T[]): T | undefined => xs[xs.length - 1];

function effective(o: readonly StoredCall[]): Picked {
  const all_drafts = o.filter((c) => c.purpose === "lesson_draft");
  if (all_drafts.length === 0) return { raw_output: null, reason: "no_draft_call" };
  const d = last(all_drafts.filter(usable));
  if (d === undefined) return { raw_output: null, reason: "draft_call_has_no_output" };
  if (d.stop_reason !== "max_tokens") return src(d);
  const r = last(o.filter((c) => c.purpose === "truncation_retry" && usable(c)));
  if (r === undefined) return { raw_output: null, reason: "truncated_without_completed_retry" };
  if (r.stop_reason === "max_tokens") return { raw_output: null, reason: "retry_truncated" };
  return src(r);
}

/**
 * original = last usable lesson_draft call (even when truncated); effective = what DraftNode accepted (the draft, or the
 * truncation retry when the draft hit max_tokens); last_repair = last usable repair; final = last repair, else effective.
 */
export function select_output(calls: readonly StoredCall[], which: Which): Picked {
  const o = order_calls(calls);
  if (which === "original") {
    const d = last(o.filter((c) => c.purpose === "lesson_draft" && usable(c)));
    if (d !== undefined) return src(d);
    return { raw_output: null, reason: o.some((c) => c.purpose === "lesson_draft") ? "draft_call_has_no_output" : "no_draft_call" };
  }
  if (which === "effective") return effective(o);
  const r = last(o.filter((c) => c.purpose === "repair" && usable(c)));
  if (which === "last_repair") {
    if (r !== undefined) return src(r);
    return { raw_output: null, reason: o.some((c) => c.purpose === "repair") ? "repair_has_no_output" : "no_repair_call" };
  }
  return r !== undefined ? src(r) : effective(o);
}

export type KindCounts = Record<string, { blocking: number; other: number; lessons: number }>;
export type Summary = {
  lessons: number; compiled: number; not_compiled: number;
  no_output: number; schema_invalid: number; compile_error: number;   // no_output + schema_invalid + compile_error === not_compiled
  gen_pass: number; review_pass: number; gen_blocking: KindCounts; review_blocking: KindCounts;
};

function tally(sets: readonly (readonly ReplayFinding[])[]): KindCounts {
  const out: KindCounts = {};
  for (const fs of sets) {
    const seen = new Set<string>();
    for (const f of fs) {
      const e = (out[f.kind] ??= { blocking: 0, other: 0, lessons: 0 });
      if (f.level === "blocking") e.blocking += 1; else e.other += 1;
      if (!seen.has(f.kind)) { seen.add(f.kind); e.lessons += 1; }
    }
  }
  return out;
}

const blocking = (fs: readonly ReplayFinding[] | null): boolean => (fs ?? []).some((f) => f.level === "blocking");

/** A lesson passes a gate when it compiled and the gate raised no blocking finding. */
export function summarize(records: readonly ReplayRecord[]): Summary {
  const compiled = records.filter((r) => r.gen !== null);
  const no_output = records.filter((r) => r.no_output_reason !== null).length;
  const compile_error = records.filter((r) => r.compile_error !== null).length;
  const schema_invalid = records.filter((r) => r.no_output_reason === null && r.compile_error === null && r.gen === null && r.schema_issues.length > 0).length;
  return {
    lessons: records.length,
    compiled: compiled.length,
    not_compiled: records.length - compiled.length,
    no_output, schema_invalid, compile_error,
    gen_pass: compiled.filter((r) => !blocking(r.gen)).length,
    review_pass: compiled.filter((r) => !blocking(r.review)).length,
    gen_blocking: tally(compiled.map((r) => (r.gen ?? []).filter((f) => f.level === "blocking"))),
    review_blocking: tally(compiled.map((r) => (r.review ?? []).filter((f) => f.level === "blocking"))),
  };
}

export function rate_text(count: number, s: Summary): string {
  return `${count}/${s.lessons} of all, ${count}/${s.compiled} of compiled`;
}

/** Among compiled records with a blocking finding in the gate: how many fail, and how many fail only on the listed kinds. */
export function blocked_only_by(records: readonly ReplayRecord[], gate: "gen" | "review", kinds: readonly string[]): { failing: number; only_listed: number } {
  let failing = 0, only_listed = 0;
  for (const r of records) {
    if (r.gen === null) continue;
    const bs = (gate === "gen" ? r.gen : r.review ?? []).filter((f) => f.level === "blocking");
    if (bs.length === 0) continue;
    failing += 1;
    if (bs.every((f) => kinds.includes(f.kind))) only_listed += 1;
  }
  return { failing, only_listed };
}

const clean_first_pass = (h: HistoricalOutcome): boolean => h.tile_state === "ready" && h.repairs === 0 && h.truncation_retries === 0;

/** The run's own stored outcome (lesson_job), not a reanalysis. */
export function historical_summary(records: readonly ReplayRecord[]): { lessons: number; ready: number; failed: number; clean_first_pass: number; repaired: number } {
  const hs = [...new Map(records.map((r) => [r.lesson, r.historical])).values()];
  return {
    lessons: hs.length,
    ready: hs.filter((h) => h.tile_state === "ready").length,
    failed: hs.filter((h) => h.tile_state === "failed").length,
    clean_first_pass: hs.filter(clean_first_pass).length,
    repaired: hs.filter((h) => h.repairs > 0).length,
  };
}

/** Compares the historical first-pass-clean flag with "the effective draft has no blocking generation finding", lesson by lesson. */
export function calibrate(records: readonly ReplayRecord[]): { agree: number; historical_clean_but_replay_fails: string[]; historical_repaired_but_replay_passes: string[] } {
  let agree = 0;
  const clean_fail: string[] = [], rep_pass: string[] = [];
  for (const r of records.filter((x) => x.which === "effective")) {
    const hist = clean_first_pass(r.historical);
    const pass = r.gen !== null && !blocking(r.gen);
    if (hist === pass) agree += 1;
    else if (hist) clean_fail.push(r.lesson);
    else rep_pass.push(r.lesson);
  }
  return { agree, historical_clean_but_replay_fails: clean_fail, historical_repaired_but_replay_passes: rep_pass };
}

export function stable_json(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map((x) => stable_json(x === undefined ? null : x)).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stable_json(o[k])}`).join(",")}}`;
}
export const sha256_hex = (s: string): string => createHash("sha256").update(s).digest("hex");
export const input_hash = (inputs: unknown): string => sha256_hex(stable_json(inputs));

/** Per-kind change in lessons raising a blocking finding, new minus baseline. */
export function delta(base: KindCounts, now: KindCounts): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of new Set([...Object.keys(base), ...Object.keys(now)])) {
    const d = (now[k]?.lessons ?? 0) - (base[k]?.lessons ?? 0);
    if (d !== 0) out[k] = d;
  }
  return out;
}

type Block = { role?: string; section?: string; part?: string | null; text?: string; standard_codes?: string[]; code_origins?: string[]; cfu?: null; minutes?: number | null };

/**
 * SIMULATION, not a measurement and not a forecast. What-if for drafts written before the prompt asked for tags on routine headings: copy the codes a teacher_talk or
 * paragraph block carries onto the routine_heading that opens its section and part, adding a bare heading when the model
 * wrote none. Returns the JSON text unchanged when it does not parse. It mutates the stored drafts to simulate a model that
 * follows the heading instruction; it says nothing about whether a model will.
 */
export function lift_teaching_tags(raw: string): string {
  let d: { blocks?: Block[] };
  try { d = JSON.parse(raw) as { blocks?: Block[] }; } catch { return raw; }
  if (!Array.isArray(d.blocks)) return raw;
  const out: Block[] = [];
  let heading: Block | null = null;
  for (const b of d.blocks) {
    if (b.role === "routine_heading") { heading = b; out.push(b); continue; }
    if (heading !== null && (heading.section !== b.section || (heading.part ?? null) !== (b.part ?? null))) heading = null;
    const codes = b.standard_codes ?? [];
    if ((b.role === "teacher_talk" || b.role === "paragraph") && codes.length > 0) {
      if (heading === null) {
        heading = { role: "routine_heading", section: b.section ?? "", part: b.part ?? null, text: "Routine", standard_codes: [], code_origins: [], cfu: null, minutes: null };
        out.push(heading);
      }
      const have = heading.standard_codes ??= [];
      const have_o = heading.code_origins ??= [];
      codes.forEach((c, i) => { if (!have.includes(c)) { have.push(c); have_o.push((b.code_origins ?? [])[i] ?? "outline"); } });
    }
    out.push(b);
  }
  return JSON.stringify({ ...d, blocks: out });
}
