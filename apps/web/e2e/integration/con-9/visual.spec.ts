// NL-98 AC-11: eight screenshots (main + can't-load, 1280/390, light/dark) written as evidence for a human look-sheet check.
// playwright.real.config.ts pins snapshotPathTemplate to con-1, so toHaveScreenshot is not used; files are written directly.
import { expect, test } from "@playwright/test";
import { statSync } from "node:fs";
import { setTheme, THEMES, VIEWPORTS } from "../support/axe";
import { openBoard } from "./helpers";
import { seedMainUnit } from "./seed";

const DIR = "e2e/__screenshots__/integration/con-9";

for (const state of ["main", "cant-load"] as const) {
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`${state} ${vp.width} ${theme} @visual`, async ({ page }) => {
        const seeded = await seedMainUnit();
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await openBoard(page, seeded.reviewers[0]!);
        if (state === "cant-load") {
          await page.route("**/api/units/*/board*", (r) => r.abort());
          await page.goto("/units/g6-u4/board");
          await expect(page.getByText("Couldn't load the unit board.")).toBeVisible();
        } else {
          await expect(page.locator("tbody tr")).toHaveCount(47);
        }
        await setTheme(page, theme);
        await page.evaluate(() => document.fonts.ready);
        const path = `${DIR}/${state}-${vp.width}-${theme}.png`;
        await page.screenshot({ path, fullPage: true });
        expect(statSync(path).size).toBeGreaterThan(5 * 1024);
      });
    }
  }
}
