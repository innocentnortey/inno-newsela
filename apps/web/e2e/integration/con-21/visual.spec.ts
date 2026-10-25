// NL-97 AC-10: eight real-data screenshots of SCR-17 (main and cant-load) at 1280 and 390, light and dark.
// Written with page.screenshot because the real config's snapshotPathTemplate is fixed to con-1; no baseline diffing.
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { matrix, setTheme } from "../support/axe";
import { sharedRun, summaryUrl } from "./helpers";

const DIR = "e2e/__screenshots__/integration/con-21";
test.setTimeout(300_000);

for (const state of ["main", "error"] as const) {
  test(`scr17 ${state} view @visual`, async ({ page }) => {
    mkdirSync(DIR, { recursive: true });
    const { up, runId } = await sharedRun(page, "mixed");
    if (state === "error") {
      await page.route("**/api/runs/*/summary", (route) => route.abort());
      await page.goto(summaryUrl(runId, up.unit_key));
      await expect(page.locator("main").getByRole("alert")).toContainText("Couldn't load run summary");
    } else {
      await page.goto(summaryUrl(runId, up.unit_key));
      await expect(page.getByLabel("Run figures")).toBeVisible();
    }
    await matrix(page, async ({ theme, viewport }) => {
      await setTheme(page, theme);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${DIR}/scr17-${state}-${viewport.width}-${theme}.png`, fullPage: true });
    });
  });
}
