// NL-104 AC-10: eight screenshots (populated + can't-load, 1280/390, light/dark) written as evidence for a human look-sheet check.
// playwright.real.config.ts pins snapshotPathTemplate to con-1, so toHaveScreenshot is not used; files are written directly.
import { expect, test } from "@playwright/test";
import { statSync } from "node:fs";
import { setTheme, THEMES, VIEWPORTS } from "../support/axe";
import { signInAs } from "../support/users";
import { COPY, openQuality, QUALITY_URL } from "./helpers";
import { cleanupGlobal, seedAll, UNITS } from "./seed";

const DIR = "e2e/__screenshots__/integration/con-10";
let ids: Awaited<ReturnType<typeof seedAll>>;
test.beforeAll(async () => { ids = await seedAll(); });
test.afterAll(async () => { await cleanupGlobal(ids); });

for (const state of ["populated", "cant-load"] as const) {
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`${state} ${vp.width} ${theme} @visual`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const rev = ids.reviewers[0]!;
        if (state === "cant-load") {
          await signInAs(page, rev);
          await page.route("**/api/units/*/metrics", (r) => r.abort());
          await page.goto(QUALITY_URL(UNITS.main.unit_key));
          await expect(page.getByText(COPY.cantLoad)).toBeVisible();
        } else {
          await openQuality(page, rev, UNITS.main.unit_key);
          await expect(page.locator("main li").first()).toBeVisible();
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
