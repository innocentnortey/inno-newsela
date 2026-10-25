import type { Page } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import { apiGlob } from "../../src/test-utils/sign-in-as";

export type Tile = components["schemas"]["Tile"];
export type RunProgress = components["schemas"]["RunProgress"];
export type RunState = components["schemas"]["RunState"];
export type TileState = Tile["tile_state"];

export const RUN_URL = "/units/g6-u4/runs/run-0001";
const CORS = { "access-control-allow-origin": "*" };

export function tile(
  n: number,
  state: TileState,
  over: Partial<Tile> = {},
): Tile {
  return {
    lesson_id: "G6.U4.L" + n,
    lesson_key: "L" + n,
    number: n,
    title: "Lesson " + n + " (synthetic)",
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
  state: RunState,
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

const busy = JSON.stringify({
  error: {
    code: "SERVICE_BUSY",
    message: "Test message for SERVICE_BUSY",
    details: {},
  },
});

/** Bodies are served in order, one per poll interval, and the last repeats; "always-fail" answers 503 from the start. */
export async function serveProgress(
  page: Page,
  sequence: RunProgress[] | "always-fail",
) {
  const servedAt: number[] = [];
  let n = 0;
  let idx = -1;
  let advancedAt = 0;
  await page.route(apiGlob("/runs/*/progress"), async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    n++;
    if (!Array.isArray(sequence)) {
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        headers: {
          ...CORS,
          "x-request-id": "req-test",
          "access-control-expose-headers": "x-request-id",
        },
        body: busy,
      });
    }
    // The dev server mounts effects twice (StrictMode), so the sequence advances by time (one step per poll interval), not per request.
    if (idx < 0 || Date.now() - advancedAt >= 1500) {
      idx += 1;
      advancedAt = Date.now();
      servedAt.push(advancedAt);
    }
    const body = sequence[Math.min(idx, sequence.length - 1)];
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify(body),
    });
  });
  return { hits: () => n, servedAt: () => servedAt };
}

/** One good body, then 503 for every later request. */
export async function serveThenFail(page: Page, first: RunProgress) {
  let n = 0;
  let firstAt = 0;
  await page.route(apiGlob("/runs/*/progress"), async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    // "First" means the first poll interval: the dev server mounts effects twice (StrictMode) and sends two requests at once.
    if (n++ === 0) firstAt = Date.now();
    if (Date.now() - firstAt < 1500)
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: CORS,
        body: JSON.stringify(first),
      });
    return route.fulfill({
      status: 503,
      contentType: "application/json",
      headers: {
        ...CORS,
        "x-request-id": "req-test",
        "access-control-expose-headers": "x-request-id",
      },
      body: busy,
    });
  });
  return { hits: () => n };
}

export async function serveSummary(page: Page, calls_lost_in_flight: number) {
  const body: components["schemas"]["RunSummary"] = {
    run_id: "run-0001",
    state: "running",
    n: 4,
    wall_time_seconds: 120,
    cost_usd: 1.84,
    cost_per_ready_lesson_usd: 0.46,
    lessons: { ready: 1, failed: 0 },
    retries: 0,
    failures_by_reason: [],
    placeholders_left: 0,
    calls_lost_in_flight,
    brakes_fired: [],
    truncation_retries: 0,
    p95_minutes_per_lesson: null,
    target_minutes_per_lesson: 3,
    report_path: null,
  };
  await page.route(apiGlob("/runs/*/summary"), (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify(body),
    });
  });
}
