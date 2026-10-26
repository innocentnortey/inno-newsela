import type { Page } from "@playwright/test";
import type { components } from "../../src/lib/api-types";
import { apiGlob } from "../../src/test-utils/sign-in-as";

export type CoverageMatrix = components["schemas"]["CoverageMatrix"];

// The query keeps the page URL from matching the api glob (apiGlob also matches page navigations).
export const COVERAGE_URL = "/units/g6-u4/coverage?view=1";
const CORS = { "access-control-allow-origin": "*" };

const RL61 =
  "Cite textual evidence to support analysis of what the text says explicitly as well as inferences drawn from the text.";

/** Synthetic WP-1 shaped matrix; nothing is read from docs/source/restricted. */
export function matrix(over: Partial<CoverageMatrix> = {}): CoverageMatrix {
  return {
    standards: [
      { code: "RL.6.1", official_text: RL61, never_assessed: false },
      {
        code: "RL.6.2",
        official_text:
          "Determine a theme or central idea of a text and how it is conveyed through particular details.",
        never_assessed: false,
      },
      {
        code: "L.6.4.b",
        official_text:
          "Use common, grade-appropriate Greek or Latin affixes and roots as clues to the meaning of a word.",
        never_assessed: false,
      },
      {
        code: "SL.6.1",
        official_text:
          "Engage effectively in a range of collaborative discussions.",
        never_assessed: true,
      },
    ],
    lessons: [
      { lesson_id: "G6.U4.L3", number: 3 },
      { lesson_id: "G6.U4.L4", number: 4 },
      { lesson_id: "G6.U4.L5", number: 5 },
    ],
    cells: [
      {
        code: "RL.6.1",
        lesson_id: "G6.U4.L4",
        roles: ["P"],
        confirmed_by: "person",
        source: "working",
      },
      {
        code: "RL.6.2",
        lesson_id: "G6.U4.L4",
        roles: ["I", "P"],
        confirmed_by: "judge_only",
        source: "approved",
      },
      {
        code: "L.6.4.b",
        lesson_id: "G6.U4.L4",
        roles: ["A"],
        confirmed_by: "person",
        source: "approved",
      },
      {
        code: "L.6.4.b",
        lesson_id: "G6.U4.L3",
        roles: ["I"],
        confirmed_by: "generator_only",
        source: "working",
      },
    ],
    ...over,
  };
}

export const emptyMatrix = (): CoverageMatrix =>
  matrix({ lessons: [], cells: [] });

export async function serveCoverage(
  page: Page,
  body: CoverageMatrix | (() => CoverageMatrix),
) {
  await page.route(apiGlob("/units/*/coverage"), (route) => {
    const req = route.request();
    // The page itself lives at the same path (client navigation sends an RSC fetch), so let those through.
    if (
      req.method() !== "GET" ||
      req.resourceType() === "document" ||
      req.headers()["rsc"]
    )
      return route.fallback();
    return route.fulfill({
      json: typeof body === "function" ? body() : body,
      headers: CORS,
    });
  });
}
