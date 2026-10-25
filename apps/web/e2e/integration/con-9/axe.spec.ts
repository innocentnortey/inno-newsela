// NL-98 AC-10: every SCR-8 state reached with real data, 0 serious and 0 critical axe violations, 2 viewports x 2 themes.
import { expect, test, type Page } from "@playwright/test";
import { axeScan, setTheme, THEMES, VIEWPORTS } from "../support/axe";
import { COPY, openBoard } from "./helpers";
import { insertRun, MAIN_PLAN, seedBareUnit, seedEmptyTileUnit, seedMainUnit, seedOneReviewerUnit, seedUnitOnce, user } from "./seed";

type Setup = (page: Page) => Promise<() => Promise<void> | void>;
const noop = () => undefined;

const STATES: Record<string, Setup> = {
  loading: async (page) => {
    const seeded = await seedMainUnit();
    await openBoard(page, seeded.reviewers[0]!);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route("**/api/units/*/board*", async (route) => { await gate; await route.fallback(); });
    await page.goto("/units/g6-u4/board");
    await expect(page.getByLabel("Loading the unit board")).toBeVisible();
    return () => release();
  },
  "empty-first-use": async (page) => {
    await seedBareUnit("G6.U9");
    await openBoard(page, await user("author", "role-author"), "g6-u9");
    await expect(page.getByText(COPY.noLessons)).toBeVisible();
    return noop;
  },
  "empty-filter": async (page) => {
    const solo = await seedOneReviewerUnit();
    await openBoard(page, solo, "g6-u7", "reopened");
    await expect(page.getByText("No lessons are Reopened.")).toBeVisible();
    return noop;
  },
  "run-in-progress": async (page) => {
    const author = await user("author", "role-author");
    await seedUnitOnce("G6.U12", MAIN_PLAN.slice(0, 6).map((l) => ({ ...l, state: "draft" as const })), { outline: true });
    await insertRun("G6.U12", "running", author);
    await openBoard(page, author, "g6-u12");
    await expect(page.getByText(/Run in progress/)).toBeVisible();
    return noop;
  },
  "failed-rows": async (page) => {
    const seeded = await seedMainUnit();
    await openBoard(page, seeded.reviewers[0]!);
    await expect(page.getByText(COPY.failed).first()).toBeVisible();
    return noop;
  },
  "north-star-empty": async (page) => {
    await seedEmptyTileUnit();
    await openBoard(page, await user("reviewer", "rev1"), "g6-u6");
    await expect(page.getByText(COPY.empty, { exact: true })).toBeVisible();
    return noop;
  },
  stale: async (page) => {
    const seeded = await seedMainUnit();
    await openBoard(page, seeded.reviewers[0]!);
    await expect(page.locator("tbody tr")).toHaveCount(47);
    await page.route("**/api/units**", (r) => r.abort());
    await page.waitForTimeout(11_000); // the stale rule is time-based (polls failing for more than 10 s)
    await expect(page.getByText(/as of|Showing|out of date|stale/i).first()).toBeVisible();
    return noop;
  },
  "cant-load": async (page) => {
    const seeded = await seedMainUnit();
    await openBoard(page, seeded.reviewers[0]!);
    await page.route("**/api/units/*/board*", (r) => r.abort());
    await page.goto("/units/g6-u4/board");
    await expect(page.getByText("Couldn't load the unit board.")).toBeVisible();
    return noop;
  },
};

for (const [state, setup] of Object.entries(STATES)) {
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`${state} ${vp.width}x${vp.height} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const done = await setup(page);
        await setTheme(page, theme);
        const r = await axeScan(page);
        console.log(`axe ${state} ${vp.width}x${vp.height} ${theme}: ${r.serious} serious / ${r.critical} critical`);
        expect(r.violations, `${state} ${vp.width} ${theme}`).toEqual([]);
        await done();
      });
    }
  }
}
