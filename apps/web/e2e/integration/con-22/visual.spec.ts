// NL-117 AC-10: eight real-data screenshots of SCR-18 (main and cant-load) at 1280 and 390, light and dark.
// Written with page.screenshot because the real config's snapshotPathTemplate is fixed to con-1.
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { matrix, setTheme } from "../support/axe";
import { as, coverageUrl } from "./helpers";
import { seedThreeLessons } from "./seed";

const DIR = "e2e/__screenshots__/integration/con-22";
test.setTimeout(300_000);

for (const state of ["main", "error"] as const) {
  test(`scr18 ${state} view @visual`, async ({ page }) => {
    mkdirSync(DIR, { recursive: true });
    const fx = await seedThreeLessons();
    await as(page, "reviewer");
    if (state === "error") {
      await page.route("**/api/units/*/coverage", (route) => route.abort());
      await page.goto(coverageUrl(fx.unit.unit_key));
      await expect(page.getByText("Couldn't load coverage")).toBeVisible();
    } else {
      await page.goto(coverageUrl(fx.unit.unit_key));
      await expect(page.locator("main table")).toBeVisible();
    }
    await matrix(page, async ({ theme, viewport }) => {
      await setTheme(page, theme);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${DIR}/scr18-${state}-${viewport.width}-${theme}.png`, fullPage: true });
    });
  });
}
