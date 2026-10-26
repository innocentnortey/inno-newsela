// NL-86 test helper: a seeded, deterministic stored-rows world of n lessons behind the FullRunReadPorts fakes.
// Astra slice B: the draft outputs are real LessonDraft JSON (the WP-2 stub draft), so the report's own classifier runs on them.
import Decimal from "decimal.js";
import { normalize_outline } from "@ls/core/intake/normalize";
import { load_standards_index } from "@ls/core/intake/standards-index";
import type { NormalizedRow } from "@ls/schema/outline";
import { load_issued_grid } from "../../../packages/core/tests/fixtures/outline/index.ts";
import type { FullRunReadPorts } from "../full-run-facts.ts";
import { stub_drafts } from "../suites/s3-run.ts";

export interface WorldCall { lesson_id: string; purpose: "lesson_draft" | "repair"; cost: Decimal }
export interface WorldLesson {
  lesson_id: string; repairs: number; slots: { quote_placeholder: number; excerpt_slot: number }; open_grounding: string[]; disclosure_open: boolean;
  confirmations: number; started: Date; finished: Date; tile_state: "ready" | "failed" | "queued"; round_trip_ok: boolean;
  initial: "valid" | "schema_invalid" | "compile_error" | "unparseable" | "none";
  repair_output: "valid" | "none";
  check_state: "checked" | "pending";
  reasons: { check: string; check_kind?: string }[];
  blocking_open: number;
}
export interface World {
  run_id: string; cap: Decimal; created: Date; finished: Date;
  lessons: WorldLesson[]; calls: WorldCall[];
  /** Extra non-lesson job rows (the unit-plan job) and the cost the unit-plan call booked outside any job. */
  extra_jobs: { cost: Decimal }[]; unattributed: Decimal;
  /** Overrides what the job's completed calls sum to, per lesson id (a job-cost mismatch). */
  calls_cost_override: Record<string, Decimal>;
  ports: FullRunReadPorts;
}

const wp2_row = normalize_outline(load_issued_grid(), load_standards_index(), 200).rows.find((r) => r.row_number === 9) as NormalizedRow;

function draft_for(lesson_id: string, kind: WorldLesson["initial"] | "valid"): string | null {
  if (kind === "none") return null;
  if (kind === "unparseable") return "{";
  const d = structuredClone(stub_drafts("wp-2", null).repair) as { lesson_id: string; blocks: Record<string, unknown>[] };
  d.lesson_id = lesson_id;
  if (kind === "schema_invalid") d.blocks[d.blocks.findIndex((b) => b["role"] === "cfu_item")]!["cfu"] = null;
  if (kind === "compile_error") d.blocks[0]!["section"] = "Not A Section";
  return JSON.stringify(d);
}

export function make_stub_world(opts: { n: number; seed: number }): World {
  let s = opts.seed;
  const rnd = (m: number): number => { s = (s * 1103515245 + 12345) % 2147483648; return (s >> 8) % m; };
  const ids: string[] = [];
  for (let i = 1; i <= Math.min(opts.n, 41); i++) ids.push(`G6.U4.L${i}`);
  for (let i = 0; ids.length < opts.n; i++) ids.push(`G6.U4.FLEX-${1 + (i >> 2)}${"abcd"[i % 4]}`);
  const t0 = Date.UTC(2026, 9, 25, 10, 0, 0);
  const created = new Date(t0);
  const lessons: WorldLesson[] = ids.map((lesson_id, i) => {
    const wp = lesson_id === "G6.U4.L8" ? 0 : lesson_id === "G6.U4.L9" ? 1 : lesson_id === "G6.U4.L25" ? 2 : -1;
    const started = new Date(t0 + i * 60_000);
    return {
      lesson_id, repairs: wp === 0 ? 1 : wp >= 1 ? 0 : (rnd(40) === 0 ? 1 : 0),
      slots: wp === 0 ? { quote_placeholder: 2, excerpt_slot: 0 } : wp === 1 ? { quote_placeholder: 0, excerpt_slot: 1 } : { quote_placeholder: 0, excerpt_slot: 0 },
      open_grounding: rnd(5) === 0 ? ["quote_unmatched"] : [], disclosure_open: false, confirmations: rnd(4),
      started, finished: new Date(started.getTime() + (60 + rnd(120)) * 1000), tile_state: "ready", round_trip_ok: true,
      initial: "valid", repair_output: "valid", check_state: "checked", reasons: [], blocking_open: 0,
    };
  });
  const calls: WorldCall[] = [];
  for (const l of lessons) {
    calls.push({ lesson_id: l.lesson_id, purpose: "lesson_draft", cost: new Decimal(`0.${3 + rnd(4)}`) });
    if (l.repairs > 0) calls.push({ lesson_id: l.lesson_id, purpose: "repair", cost: new Decimal("0.1") });
  }
  const world: World = {
    run_id: "run_world", cap: new Decimal("60"), created, finished: new Date(t0 + 3_600_000), lessons, calls,
    extra_jobs: [], unattributed: new Decimal(0), calls_cost_override: {}, ports: null as unknown as FullRunReadPorts,
  };
  const cost_of = (id: string): Decimal => world.calls.filter((c) => c.lesson_id === id).reduce((a, c) => a.plus(c.cost), new Decimal(0));
  const by_job = (job_id: string): WorldLesson => world.lessons[Number(job_id.slice(4))] as WorldLesson;
  const hash = (id: string): string => `hash-${id}`;
  world.ports = {
    runs: {
      async summary_rows() {
        const slot_total = world.lessons.reduce((a, l) => a + l.slots.quote_placeholder + l.slots.excerpt_slot, 0);
        return {
          run: { run_id: world.run_id, unit_id: "G6.U4", outline_version_id: "ov_world", cap_usd: world.cap, created_at: world.created, finished_at: world.finished },
          jobs: [
            ...world.extra_jobs.map((j, i) => ({
              job_id: `plan_${i}`, run_id: world.run_id, kind: "unit_plan", lesson_id: null, status: "ready", tile_state: "ready", attempt: 1,
              queued_at: new Date(t0 - 1000), started_at: null, finished_at: null, failure_reasons: [], brakes_fired: [],
              repairs: 0, truncation_retries: 0, retries: 0, calls_lost: 0, cost_usd: j.cost,
            })),
            ...world.lessons.map((l, i) => ({
              job_id: `job_${i}`, run_id: world.run_id, kind: "lesson", lesson_id: l.lesson_id, status: "ready", tile_state: l.tile_state, attempt: 1,
              queued_at: new Date(t0 + i), started_at: l.started, finished_at: l.finished, failure_reasons: l.reasons, brakes_fired: [],
              repairs: l.repairs, truncation_retries: 0, retries: 0, calls_lost: 0, cost_usd: cost_of(l.lesson_id),
            })),
          ],
          calls: {}, placeholders_left: slot_total, report_path: null,
        } as never;
      },
      async report_facts() {
        const lessons = world.lessons.map((l, i) => ({
          job_id: `job_${i}`, lesson_id: l.lesson_id,
          version: { version_id: `ver_${i}`, number: 1, content_hash: hash(l.lesson_id), schema_version: 1 },
          slot_nodes: l.slots,
          check: { state: l.check_state, checked_at: l.check_state === "checked" ? new Date(t0 + 3_600_000) : null },
          open_issues: [
            ...l.open_grounding.map((kind) => ({ kind, level: "advisory", count: 1 })),
            ...(l.disclosure_open ? [{ kind: "disclosure_prompt", level: "advisory", count: 1 }] : []),
            ...(l.blocking_open > 0 ? [{ kind: "quote_unmatched", level: "blocking", count: l.blocking_open }] : []),
          ],
          unconfirmed_alignment: l.confirmations,
          seed_doc_hash: l.round_trip_ok ? hash(l.lesson_id) : "other",
          calls_cost_usd: world.calls_cost_override[l.lesson_id] ?? cost_of(l.lesson_id),
        }));
        return { run_id: world.run_id, lessons, checks_pending: lessons.filter((l) => l.check.state === "pending").length, checked_through: null } as never;
      },
    },
    calls: {
      async totals_for_run() {
        const lesson_calls = world.calls.reduce((a, c) => a.plus(c.cost), new Decimal(0));
        return {
          run_id: world.run_id, repairs: world.calls.filter((c) => c.purpose === "repair").length, cost_usd: lesson_calls.plus(world.unattributed),
          unattributed_cost_usd: world.unattributed,
        } as never;
      },
      async completed_for(job_id, purpose) {
        const l = by_job(job_id);
        const raw = purpose === "lesson_draft" ? draft_for(l.lesson_id, l.initial) : purpose === "repair" ? draft_for(l.lesson_id, l.repair_output) : null;
        return raw === null ? null : ({ raw_output: raw, cost_usd: new Decimal(0) } as never);
      },
    },
    outlines: {
      async rows() {
        return world.lessons.map((l) => ({ row: { ...wp2_row, lesson_id: l.lesson_id } })) as never;
      },
    },
  };
  return world;
}
