// NL-86 test helper: a seeded, deterministic stored-rows world of n lessons behind the FullRunReadPorts fakes.
import Decimal from "decimal.js";
import type { FullRunReadPorts } from "../full-run-report.ts";

export interface WorldCall { lesson_id: string; purpose: "lesson_draft" | "repair"; cost: Decimal }
export interface WorldLesson {
  lesson_id: string; repairs: number; placeholders: number; open_grounding: string[]; disclosure_open: boolean;
  confirmations: number; started: Date; finished: Date; tile_state: "ready" | "failed"; round_trip_ok: boolean;
}
export interface World {
  run_id: string; cap: Decimal; created: Date; finished: Date;
  lessons: WorldLesson[]; calls: WorldCall[]; ports: FullRunReadPorts;
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
      lesson_id, repairs: wp === 0 ? 1 : wp >= 1 ? 0 : (rnd(40) === 0 ? 1 : 0), placeholders: wp === 0 ? 2 : wp === 1 ? 1 : 0,
      open_grounding: rnd(5) === 0 ? ["quote_unmatched"] : [], disclosure_open: false, confirmations: rnd(4),
      started, finished: new Date(started.getTime() + (60 + rnd(120)) * 1000), tile_state: "ready", round_trip_ok: true,
    };
  });
  const calls: WorldCall[] = [];
  for (const l of lessons) {
    calls.push({ lesson_id: l.lesson_id, purpose: "lesson_draft", cost: new Decimal(`0.${3 + rnd(4)}`) });
    if (l.repairs > 0) calls.push({ lesson_id: l.lesson_id, purpose: "repair", cost: new Decimal("0.1") });
  }
  const world: World = {
    run_id: "run_world", cap: new Decimal("60"), created, finished: new Date(t0 + 3_600_000), lessons, calls,
    ports: null as unknown as FullRunReadPorts,
  };
  const cost_of = (id: string): Decimal => world.calls.filter((c) => c.lesson_id === id).reduce((a, c) => a.plus(c.cost), new Decimal(0));
  const by_id = (id: string): WorldLesson => world.lessons.find((l) => l.lesson_id === id) as WorldLesson;
  const hash = (id: string): string => `hash-${id}`;
  world.ports = {
    runs: {
      async summary_rows() {
        return {
          run: { run_id: world.run_id, cap_usd: world.cap, created_at: world.created, finished_at: world.finished },
          jobs: world.lessons.map((l, i) => ({
            job_id: `job_${i}`, run_id: world.run_id, kind: "lesson", lesson_id: l.lesson_id, status: "ready", tile_state: l.tile_state, attempt: 1,
            queued_at: new Date(t0 + i), started_at: l.started, finished_at: l.finished, failure_reasons: [], brakes_fired: [],
            repairs: l.repairs, truncation_retries: 0, retries: 0, calls_lost: 0, cost_usd: cost_of(l.lesson_id),
          })),
          calls: {}, placeholders_left: world.lessons.reduce((a, l) => a + l.placeholders, 0), report_path: null,
        } as never;
      },
    },
    calls: {
      async totals_for_run() {
        return { run_id: world.run_id, repairs: world.calls.filter((c) => c.purpose === "repair").length, cost_usd: world.calls.reduce((a, c) => a.plus(c.cost), new Decimal(0)) } as never;
      },
    },
    issues: {
      async current(lesson_id) {
        const l = by_id(lesson_id);
        const mk = (kind: string) => ({ kind, level: "advisory", resolved_at: null, cleared_by: null });
        return { issues: [...l.open_grounding.map(mk), ...(l.disclosure_open ? [mk("disclosure_prompt")] : [])] } as never;
      },
    },
    alignment: {
      async for_lesson(lesson_id) {
        const l = by_id(lesson_id);
        return [
          ...Array.from({ length: l.confirmations }, (_, i) => ({ content_hash: hash(lesson_id), origin: "narrowed", confirmed_by: null, code: `c${i}` })),
          { content_hash: hash(lesson_id), origin: "outline", confirmed_by: null, code: "o" },
          { content_hash: "stale", origin: "added", confirmed_by: null, code: "s" },
        ] as never;
      },
    },
    versions: { async generated_version(lesson_id) { return { content_hash: hash(lesson_id) } as never; } },
    docs: { async latest_derived(lesson_id) { return { content_hash: by_id(lesson_id).round_trip_ok ? hash(lesson_id) : "other" } as never; } },
  };
  return world;
}
