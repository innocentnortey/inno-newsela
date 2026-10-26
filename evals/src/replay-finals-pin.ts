// F4-1: the replay's check context is pinned to the stored run (its outline version and the choices it hashed), not to
// whatever the database holds today. CheckContextLoader takes its ports in the constructor, so pinned adapters give it the
// pinned identity without touching production files (the production gap is request R-1 in the F4 plan).
import { canonical_json } from "@ls/schema/content-hash";
import type { CheckContext } from "@ls/core/checks/types";
import type { OutlineVersionId } from "@ls/core/ports/common";
import type { LessonGraphRepo } from "@ls/core/ports/lesson-graph";
import type { IntakeChoiceRow, OutlineRepo, RowContext } from "@ls/core/ports/outlines";
import { sha256_hex, type IdentityTrace } from "./replay-finals.ts";

export type IdentityCode = "outline_version_mismatch" | "latest_unit_fallback" | "row_mismatch" | "choices_hash_mismatch" | "run_not_found" | "unsupported_call";
export class ReplayIdentityError extends Error {
  constructor(readonly code: IdentityCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "ReplayIdentityError";
  }
}

export interface RunPin {
  run_id: string; unit_id: string; outline_version_id: OutlineVersionId;
  choices: IntakeChoiceRow[]; choices_hash: string; choices_hash_basis: "parsed" | "raw_json";
  prompt_version_id: string; prompt_locked_hash: string | null; created_at: string;
}

export class PinTrace {
  loader_row_hash: string | null = null;
  stored_source_version: string | null = null;
  latest_unit_version: string | null = null;
  reset(): void {
    this.loader_row_hash = null;
    this.stored_source_version = null;
    // latest_unit_version is a property of the database, not of one lesson: kept.
  }
}

const by_finding = <T extends { finding_id: string }>(xs: readonly T[]): T[] =>
  [...xs].sort((a, b) => (a.finding_id < b.finding_id ? -1 : a.finding_id > b.finding_id ? 1 : 0));
const hash_choices = (xs: readonly { finding_id: string }[]): string => sha256_hex(canonical_json(by_finding(xs)));

export async function load_run_pin(deps: {
  runs: { get(run_id: string): Promise<{ outline_version_id: string; unit_id: string; choices_hash: string; prompt_version_id: string; created_at: Date } | null>; pinned_choices(run_id: string): Promise<IntakeChoiceRow[]> };
  prompts: { get(id: string): Promise<{ locked_hash: string } | null> };
  raw_choices_json(run_id: string): Promise<unknown>;
}, run_id: string): Promise<RunPin> {
  const run = await deps.runs.get(run_id);
  if (run === null) throw new ReplayIdentityError("run_not_found", run_id);
  const choices = await deps.runs.pinned_choices(run_id);
  let basis: RunPin["choices_hash_basis"] | null = hash_choices(choices) === run.choices_hash ? "parsed" : null;
  if (basis === null) {
    const raw = await deps.raw_choices_json(run_id);
    if (Array.isArray(raw) && hash_choices(raw as { finding_id: string }[]) === run.choices_hash) basis = "raw_json";
  }
  if (basis === null) throw new ReplayIdentityError("choices_hash_mismatch", `run ${run_id}: neither the parsed rows nor the raw choices_json hash to the run's choices_hash`);
  const prompt = await deps.prompts.get(run.prompt_version_id);
  return {
    run_id, unit_id: run.unit_id, outline_version_id: run.outline_version_id as OutlineVersionId, choices, choices_hash: run.choices_hash,
    choices_hash_basis: basis, prompt_version_id: run.prompt_version_id, prompt_locked_hash: prompt?.locked_hash ?? null, created_at: run.created_at.toISOString(),
  };
}

const unsupported = (m: string): never => { throw new ReplayIdentityError("unsupported_call", m); };

export class PinnedOutlines implements OutlineRepo {
  constructor(private readonly real: OutlineRepo, private readonly pin: RunPin, private readonly trace: PinTrace) {}

  private check(v: OutlineVersionId): void {
    if (v !== this.pin.outline_version_id) throw new ReplayIdentityError("outline_version_mismatch", `asked ${v}, run pinned ${this.pin.outline_version_id}`);
  }
  async rows(v: OutlineVersionId) { this.check(v); return this.real.rows(v); }
  async row_context(v: OutlineVersionId, lesson_id: Parameters<OutlineRepo["row_context"]>[1], _choices: readonly IntakeChoiceRow[] | null): Promise<RowContext> {
    this.check(v);
    const rc = await this.real.row_context(this.pin.outline_version_id, lesson_id, this.pin.choices);
    this.trace.loader_row_hash = rc.row_hash;
    return rc;
  }
  /** Records the unit's newest version (what an unpinned loader would fall back to) without letting the loader use it. */
  async probe_latest(): Promise<void> {
    const us = await this.real.list_units();
    this.trace.latest_unit_version = us.find((u) => u.unit_id === this.pin.unit_id)?.latest_outline_version_id ?? null;
  }
  async list_units(): Promise<never> {
    await this.probe_latest();
    throw new ReplayIdentityError("latest_unit_fallback", "the loader asked for the unit's latest outline version");
  }
  async insert_version(): Promise<never> { return unsupported("insert_version"); }
  async version(): Promise<never> { return unsupported("version"); }
  async choices(): Promise<never> { return unsupported("choices"); }
  async upsert_choice(): Promise<never> { return unsupported("upsert_choice"); }
  async mark_confirmed(): Promise<never> { return unsupported("mark_confirmed"); }
  async generate_gate_inputs(): Promise<never> { return unsupported("generate_gate_inputs"); }
  async links(): Promise<never> { return unsupported("links"); }
}

export function pinned_graph(real: LessonGraphRepo, pin: RunPin, trace: PinTrace): LessonGraphRepo {
  return {
    dependencies: (id) => real.dependencies(id),
    dependants: (id) => real.dependants(id),
    async source_outline_version(lesson_id) {
      trace.stored_source_version = await real.source_outline_version(lesson_id);
      return pin.outline_version_id;
    },
  };
}

export function assert_same_identity(node_rc: RowContext, ctx: CheckContext, trace: PinTrace, pin: RunPin): IdentityTrace {
  if (node_rc.outline_version_id !== pin.outline_version_id || ctx.outline_version_id !== pin.outline_version_id) {
    throw new ReplayIdentityError("outline_version_mismatch", `node ${node_rc.outline_version_id}, loader ${ctx.outline_version_id}, pin ${pin.outline_version_id}`);
  }
  if (trace.loader_row_hash === null || node_rc.row_hash !== trace.loader_row_hash || canonical_json(node_rc.row) !== canonical_json(ctx.row)) {
    throw new ReplayIdentityError("row_mismatch", `node row ${node_rc.row_hash.slice(0, 12)}, loader row ${String(trace.loader_row_hash).slice(0, 12)}`);
  }
  return {
    pinned_outline_version: pin.outline_version_id, loader_outline_version: ctx.outline_version_id,
    node_row_hash: node_rc.row_hash, loader_row_hash: trace.loader_row_hash,
    stored_source_version: trace.stored_source_version, latest_unit_version: trace.latest_unit_version,
    unpinned_would_differ: (trace.stored_source_version ?? trace.latest_unit_version) !== pin.outline_version_id,
    choices_hash: pin.choices_hash,
  };
}
