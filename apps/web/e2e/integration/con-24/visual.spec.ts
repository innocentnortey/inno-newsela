// NL-103 AC-10 (WF-20): eight real-data screenshots of SCR-21 (main with a made candidate, and the stale-base error) at 1280 and 390, light and dark.
// Written with page.screenshot because the real config's snapshotPathTemplate is fixed to con-1; no baseline diffing.
import { mkdirSync } from "node:fs";
import { test } from "@playwright/test";
import { matrix, setTheme } from "../support/axe";
import { authorSession, SHOTS } from "./helpers";
import { reachMade, reachStale } from "./states";
import { seedL4 } from "./seed";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  await seedL4(browser);
});

for (const state of ["main", "error"] as const) {
  test(`scr21 ${state} state @visual`, async ({ page, browser }) => {
    mkdirSync(SHOTS, { recursive: true });
    const { user } = await authorSession(page);
    if (state === "main") await reachMade(page, user);
    else await reachStale(browser, page);
    await matrix(page, async ({ theme, viewport }) => {
      await setTheme(page, theme);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${SHOTS}/scr21-${state}-${viewport.width}-${theme}.png`, fullPage: true });
    });
  });
}
