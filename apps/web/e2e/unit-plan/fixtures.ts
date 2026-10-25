import type { Page } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import { apiGlob } from "../../src/test-utils/sign-in-as";

export type UnitPlan = components["schemas"]["UnitPlan"];
export type PlanEntry = components["schemas"]["PlanEntry"];

export const PLAN_URL = "/units/g6-u4/runs/run-0001/plan";
const CORS = { "access-control-allow-origin": "*" };

/** 47 synthetic entries (days 1-47), returned in reverse order so the page's sort is what the test sees. */
export function planEntries(): PlanEntry[] {
  const out: PlanEntry[] = [];
  for (let day = 1; day <= 47; day++) {
    out.push({
      lesson_id: day <= 40 ? "G6.U4.L" + day : "G6.U4.F" + (day - 40),
      day,
      purpose: "Synthetic plan line for day " + day,
      routines: ["Think-Pair-Share"],
      hands_forward: "Synthetic hand-forward from day " + day,
      performance_task_thread: "Identifying and explaining emerging themes",
    });
  }
  const texts: Record<number, Partial<PlanEntry>> = {
    4: {
      purpose: "Infer what Percy's sarcastic narration shows about his world.",
      hands_forward:
        "Lesson 5 compares Percy with the hare in The Hare and the Lion.",
    },
    5: { purpose: "Compare Percy with the hare in The Hare and the Lion." },
  };
  return out.map((e) => ({ ...e, ...texts[e.day] })).reverse();
}

export function storedPlan(over: Partial<UnitPlan> = {}): UnitPlan {
  return {
    run_id: "run-0001",
    state: "stored",
    stored_at: "2026-10-25T15:21:10Z",
    entries: planEntries(),
    lesson_links: [
      {
        link_id: "lnk-4-5",
        from_lesson_id: "G6.U4.L4",
        from_address: "G6.U4.L4.Homework",
        to_lesson_id: "G6.U4.L5",
        to_slot_id: "slot-L5-PartA-excerpt",
        label: "Lesson 4 Homework → Lesson 5 excerpt slot",
      },
    ],
    ...over,
  };
}
export const planningPlan = () =>
  storedPlan({
    state: "planning",
    stored_at: null,
    entries: [],
    lesson_links: [],
  });
export const failedPlan = () =>
  storedPlan({
    state: "failed",
    stored_at: null,
    entries: [],
    lesson_links: [],
  });
export const emptyPlan = () => storedPlan({ entries: [], lesson_links: [] });

/** Bodies are served in order, one per poll interval, and the last repeats. */
export async function servePlan(page: Page, sequence: UnitPlan[]) {
  let n = 0;
  let idx = -1;
  let advancedAt = 0;
  await page.route(apiGlob("/runs/*/plan"), async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    n++;
    // The dev server mounts effects twice (StrictMode), so the sequence advances by time, not per request.
    if (idx < 0 || Date.now() - advancedAt >= 1500) {
      idx += 1;
      advancedAt = Date.now();
    }
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify(sequence[Math.min(idx, sequence.length - 1)]),
    });
  });
  await letDocumentThrough(page);
  return { hits: () => n };
}

/**
 * The API glob `**\/runs/*\/plan` also matches this screen's own page URL. Register this AFTER any route
 * that uses the glob (the last route runs first) so the page document is never answered by a mock.
 */
export async function letDocumentThrough(page: Page) {
  await page.route(apiGlob("/runs/*/plan"), (route) =>
    route.request().resourceType() === "document"
      ? route.continue()
      : route.fallback(),
  );
}
