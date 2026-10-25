import type { Page } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import { apiGlob } from "../../src/test-utils/sign-in-as";

export type RunSummary = components["schemas"]["RunSummary"];

// The query keeps the page URL from matching the api glob (apiGlob also matches page navigations).
export const SUMMARY_URL = "/units/g6-u4/runs/run-0001/summary?view=1";
const CORS = { "access-control-allow-origin": "*" };

export function summary(over: Partial<RunSummary> = {}): RunSummary {
  return {
    run_id: "run-0001",
    state: "complete",
    n: 3,
    wall_time_seconds: 612,
    cost_usd: 1.61,
    cost_per_ready_lesson_usd: 0.54,
    lessons: { ready: 3, failed: 0 },
    retries: 1,
    failures_by_reason: [],
    placeholders_left: 3,
    calls_lost_in_flight: 0,
    brakes_fired: [],
    truncation_retries: 0,
    p95_minutes_per_lesson: 3.4,
    target_minutes_per_lesson: 5,
    report_path: null,
    ...over,
  };
}

export const failing = (): RunSummary =>
  summary({
    state: "partial",
    lessons: { ready: 1, failed: 2 },
    failures_by_reason: [
      { reason: "Look Back is 3 minutes (needs 5)", count: 1 },
      { reason: "truncated", count: 1 },
    ],
    brakes_fired: [{ brake: "per-run cap $13.00", count: 1 }],
    calls_lost_in_flight: 1,
    truncation_retries: 1,
    report_path: "/reports/run-0001.txt",
  });

/** Bodies are served in order, one per poll interval; the last repeats. */
export async function serveSummary(page: Page, bodies: RunSummary[]) {
  let n = 0;
  let idx = -1;
  let advancedAt = 0;
  await page.route(apiGlob("/runs/*/summary"), async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    n++;
    // Effects run twice in the dev server, so advance by time, not per request.
    if (idx < 0 || Date.now() - advancedAt >= 1500) {
      idx += 1;
      advancedAt = Date.now();
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify(bodies[Math.min(idx, bodies.length - 1)]),
    });
  });
  return { hits: () => n };
}
