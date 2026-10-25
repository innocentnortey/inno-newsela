import type { components } from "@/lib/api-types";

export type Tile = components["schemas"]["Tile"];
export type RunProgress = components["schemas"]["RunProgress"];

export function tile(
  n: number,
  state: Tile["tile_state"],
  over: Partial<Tile> = {},
): Tile {
  return {
    lesson_id: `G6.U4.L${n}`,
    lesson_key: `L${n}`,
    number: n,
    title: `Lesson ${n} (synthetic)`,
    tile_state: state,
    attempts: 1,
    repair_used: false,
    truncation_retry_used: false,
    failure_reasons: [],
    cost_usd: 0.02,
    openable: state === "ready",
    ...over,
  };
}

export function progress(
  state: RunProgress["state"],
  tiles: Tile[],
  over: Partial<RunProgress> = {},
): RunProgress {
  const counts: Record<string, number> = {};
  for (const t of tiles) counts[t.tile_state] = (counts[t.tile_state] ?? 0) + 1;
  return {
    run_id: "run-0001",
    state,
    paused_reason: null,
    capped_by: null,
    spent_usd: 1.84,
    reserved_usd: 0,
    cap_usd: 5,
    concurrency_cap: 4,
    queued_ahead: 0,
    counts_by_tile_state: counts,
    updated_at: "2026-10-25T10:52:00Z",
    tiles,
    ...over,
  };
}
