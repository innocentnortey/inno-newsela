// Per-lesson replay (F4): re-checks one stored job's selected outputs through the REAL CompileCheckNode and rule sets,
// with the context pinned to the run (replay-finals-pin.ts) and the reviewer state chosen explicitly (review context).
import { CheckContextLoader } from "@ls/core/checks/context-loader";
import { CHECK_POLICY } from "@ls/core/checks/policy";
import { CHECK_RULES, run_checks } from "@ls/core/checks/registry";
import type { CheckContext, CheckFinding } from "@ls/core/checks/types";
import type { Clock } from "@ls/core/ports/clock";
import type { AlignmentRepo } from "@ls/core/ports/alignment";
import type { LessonDocReader } from "@ls/core/ports/lesson-docs";
import type { LessonGraphRepo } from "@ls/core/ports/lesson-graph";
import type { OutlineRepo } from "@ls/core/ports/outlines";
import type { SafetyFlagRepo } from "@ls/core/ports/safety-flags";
import type { StandardRepo } from "@ls/core/ports/standards";
import type { SuggestionRepo } from "@ls/core/ports/suggestions";
import { CompileCheckNode } from "@ls/worker/generation/nodes/compile-check-node";
import { generation_rules } from "@ls/worker/wiring/generation";
import {
  lift_teaching_tags, select_output, sha256_hex, stable_json,
  type HistoricalOutcome, type IdentityTrace, type NoOutputReason, type ReplayFinding, type ReplayRecord, type ReviewContextMode, type StateProbe, type StoredCall, type Which,
} from "./replay-finals.ts";
import { PinTrace, PinnedOutlines, assert_same_identity, pinned_graph, type RunPin } from "./replay-finals-pin.ts";

export interface LoaderPorts { outlines: OutlineRepo; standards: StandardRepo; graph: LessonGraphRepo; reader: LessonDocReader; suggestions: SuggestionRepo; flags: SafetyFlagRepo; alignment: AlignmentRepo; clock: Clock }
export interface ReplayJob { job_id: string; run_id: string; lesson_id: string; status: string; historical: HistoricalOutcome; calls: StoredCall[] }
export interface InputItem { lesson: string; row_hash: string; standards_sha256: string; selections: { which: Which; call_id: string | null; output_sha256: string | null; reason: NoOutputReason | null }[] }
export type Omitted = { links: number; linked_lessons: number; dependency_states: number };

/** Cross-lesson fields are always cleared (counted first). In generation_time mode the five reviewer-state fields are emptied too. */
export function apply_review_context(ctx: CheckContext, mode: ReviewContextMode): { ctx: CheckContext; omitted: Omitted } {
  const omitted = { links: ctx.links.length, linked_lessons: ctx.linked_lessons.length, dependency_states: Object.keys(ctx.linked_states ?? {}).length };
  const base = { ...ctx, links: [], linked_lessons: [], linked_states: {} };
  if (mode === "current") return { ctx: base, omitted };
  return { ctx: { ...base, pending_suggestions: [], safety_flags: [], confirmations: [], previous_lesson_flags: [], unit_coverage: [] }, omitted };
}

const blocking_kinds = (fs: readonly CheckFinding[]): Set<string> => new Set(fs.filter((f) => f.level === "blocking").map((f) => f.kind));
const added = (cur: Set<string>, base: Set<string>): string[] => [...cur].filter((k) => !base.has(k)).sort();

export function make_replay_env(ports: LoaderPorts, pin: RunPin, opts: {
  lift: boolean; review_context: ReviewContextMode; messages: boolean; first_stored_at: (lesson_id: string) => Promise<string | null>;
}) {
  const trace = new PinTrace();
  const loader_outlines = new PinnedOutlines(ports.outlines, pin, trace);
  const node_outlines = new PinnedOutlines(ports.outlines, pin, new PinTrace()); // detached: the loader's call is the one recorded
  const real = new CheckContextLoader(loader_outlines, ports.standards, pinned_graph(ports.graph, pin, trace), ports.reader, ports.suggestions, ports.flags, ports.alignment, ports.clock);
  const totals: Omitted = { links: 0, linked_lessons: 0, dependency_states: 0 };
  let raw: CheckContext | null = null;
  let applied: CheckContext | null = null;
  const loader = {
    async load(...a: Parameters<typeof real.load>): Promise<CheckContext> {
      raw = await real.load(...a);
      const r = apply_review_context(raw, opts.review_context);
      totals.links += r.omitted.links; totals.linked_lessons += r.omitted.linked_lessons; totals.dependency_states += r.omitted.dependency_states;
      applied = r.ctx;
      return r.ctx;
    },
  };
  const gen_rules = generation_rules(CHECK_RULES);
  const node = new CompileCheckNode(loader as never, gen_rules, CHECK_POLICY, ports.standards as never);
  const shape = (fs: readonly CheckFinding[]): ReplayFinding[] =>
    fs.map((f) => ({ kind: f.kind, level: f.level, ...(opts.messages ? { message: f.message } : {}), address: f.address ?? null, code: f.code ?? null }));
  let probed = false;

  async function replay_job(job: ReplayJob, whiches: readonly Which[]): Promise<{ records: ReplayRecord[]; input: InputItem }> {
    if (!probed) { await loader_outlines.probe_latest(); probed = true; }
    const rc = await node_outlines.row_context(pin.outline_version_id, job.lesson_id as never, null);
    const idx = await ports.standards.index();
    const codes = [...new Set([...rc.row.focus_codes, ...rc.row.eld_codes, ...rc.row.msls_codes].flatMap((c) => idx.leaves_of(c)))];
    const standards = await ports.standards.texts(codes);
    const unit_id = job.lesson_id.slice(0, job.lesson_id.lastIndexOf("."));
    const first_stored_at = await opts.first_stored_at(job.lesson_id);
    const records: ReplayRecord[] = [];
    const input: InputItem = { lesson: job.lesson_id, row_hash: rc.row_hash, standards_sha256: sha256_hex(stable_json(standards)), selections: [] };
    for (const which of whiches) {
      const picked = select_output(job.calls, which);
      const base = { lesson: job.lesson_id, which, status: job.status, review_context: opts.review_context, historical: job.historical, identity: null, state_probe: null, gen: null, review: null };
      if (picked.raw_output === null) {
        input.selections.push({ which, call_id: null, output_sha256: null, reason: picked.reason });
        records.push({ ...base, source: null, no_output_reason: picked.reason, schema_issues: [], compile_error: null });
        continue;
      }
      const raw_output = opts.lift ? lift_teaching_tags(picked.raw_output) : picked.raw_output;
      input.selections.push({ which, call_id: picked.source.call_id, output_sha256: sha256_hex(raw_output), reason: null });
      raw = null; applied = null; trace.reset();
      const state = {
        job: { job_id: job.job_id, run_id: job.run_id, unit_id, lesson_id: job.lesson_id, schema_version: 1, prompt_version_id: "replay", outline_version_id: pin.outline_version_id },
        context: { row_context: rc, standards, raw_output, calls: [] },
      };
      const res = await node.run(state as never);
      const rec: ReplayRecord = { ...base, source: picked.source, no_output_reason: null, schema_issues: [...(res.schema_issues ?? [])], compile_error: res.compile_error ?? null };
      const r = raw as CheckContext | null, a = applied as CheckContext | null;
      if (res.check_result && r !== null && a !== null) {
        const identity: IdentityTrace = assert_same_identity(rc, r, trace, pin);
        rec.identity = identity;
        rec.gen = shape(res.check_result.findings);
        rec.review = shape(run_checks(a, CHECK_RULES, CHECK_POLICY).findings);
        const empty = apply_review_context(r, "generation_time").ctx, cur = apply_review_context(r, "current").ctx;
        const probe: StateProbe = {
          review_state: {
            safety_flags: r.safety_flags.map((f) => f.flag_id), pending_suggestions: r.pending_suggestions.length, confirmations: r.confirmations.length,
            previous_lesson_flags: r.previous_lesson_flags.map((f) => f.flag_id), unit_coverage_cells: r.unit_coverage.length, first_stored_at,
          },
          gen_added_blocking_kinds: added(blocking_kinds(run_checks(cur, gen_rules, CHECK_POLICY).findings), blocking_kinds(run_checks(empty, gen_rules, CHECK_POLICY).findings)),
          review_added_blocking_kinds: added(blocking_kinds(run_checks(cur, CHECK_RULES, CHECK_POLICY).findings), blocking_kinds(run_checks(empty, CHECK_RULES, CHECK_POLICY).findings)),
        };
        rec.state_probe = probe;
      }
      records.push(rec);
    }
    return { records, input };
  }
  return { replay_job, trace_omissions: (): Omitted => ({ ...totals }) };
}
