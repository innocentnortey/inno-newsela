import type { Page } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import { apiGlob } from "../../src/test-utils/sign-in-as";

// Synthetic metrics, not data: shaped like CON-10 getUnitMetrics, traceable to this file only.
export type UnitMetrics = components["schemas"]["UnitMetrics"];

// The query keeps the page URL from matching the api glob (apiGlob also matches page navigations).
export const QUALITY_URL = "/units/g6-u4/quality?view=1";
const CORS = { "access-control-allow-origin": "*" };

type Quality = NonNullable<UnitMetrics["quality"]>;
const tile = (id: string, value: number | null, n: number, label: string) => ({
  id,
  value,
  n,
  label,
});

export function metrics(over: Partial<UnitMetrics> = {}): UnitMetrics {
  return {
    north_star: {
      median_minutes: 31,
      n: 3,
      fast_approvals: { count: 0, of: 3 },
      approved: { k: 3, total: 47 },
      caption: "No baseline yet (AQ-14). Measured with us as reviewers.",
      segment_label: "one reviewer, n = 3",
    },
    quality: {
      tiles: [
        tile("V-1", 66.7, 3, "Usable as drafted"),
        tile("V-2", 100, 3, "Standards aligned"),
        tile("V-5", 0, 3, "Rewritten"),
        tile("O-1", 0.54, 3, "Cost per ready lesson"),
        tile("O-2", 1.9, 3, "Lessons per reviewer hour"),
        tile("H-1", 100, 47, "Lessons that passed checks"),
        tile("H-2", 3.4, 47, "Slowest lesson time"),
        tile("V-4", null, 0, "Agreement between judges"),
      ],
      rating_counts: {
        usable_as_drafted: 1,
        usable_with_edits: 2,
        rewritten: 0,
        n: 3,
      },
      seeded_errors: { planted: 5, caught: 4, label: "our reviewers" },
    } satisfies Quality,
    ...over,
  };
}

export function emptyMetrics(): UnitMetrics {
  const m = metrics();
  return {
    north_star: {
      ...m.north_star,
      median_minutes: null,
      n: 0,
      fast_approvals: { count: 0, of: 0 },
      approved: { k: 0, total: 47 },
      segment_label: null,
    },
    quality: {
      tiles: m.quality!.tiles.map((t) => ({ ...t, value: null, n: 0 })),
      rating_counts: {
        usable_as_drafted: 0,
        usable_with_edits: 0,
        rewritten: 0,
        n: 0,
      },
      seeded_errors: { planted: 0, caught: 0, label: "our reviewers" },
    },
  };
}

export const cutMetrics = (): UnitMetrics => metrics({ quality: null });

export function zeroMedian(): UnitMetrics {
  const m = metrics();
  return { ...m, north_star: { ...m.north_star, median_minutes: 0 } };
}

export async function serveMetrics(page: Page, body: UnitMetrics) {
  await page.route(apiGlob("/units/*/metrics"), (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: CORS,
      body: JSON.stringify(body),
    });
  });
}
