// NL-95 AC-11: eight real-data screenshots of SCR-5 (main and the day-cap error), written with page.screenshot because the
// real config's snapshotPathTemplate is fixed to con-1; no baseline diffing.
import { mkdirSync } from "node:fs";
import { test } from "@playwright/test";
import { matrix, setTheme } from "../support/axe";
import { authorWithConfirmedUpload, COPY, insertSpend, releaseSpend, openDialog } from "./helpers";

const DIR = "e2e/__screenshots__/integration/con-5";
test.setTimeout(120_000);

test.afterEach(releaseSpend);

for (const state of ["main", "error"] as const) {
  test(`scr5 ${state} state @visual`, async ({ page }) => {
    mkdirSync(DIR, { recursive: true });
    const { user, up } = await authorWithConfirmedUpload(page);
    if (state === "error") await insertSpend(user.user_id, 20);
    const dialog = await openDialog(page, up);
    if (state === "error") {
      await dialog.getByRole("button", { name: COPY.startRun }).click();
      await dialog.getByText(COPY.dayCap("6.00")).waitFor();
    }
    await matrix(page, async ({ theme, viewport }) => {
      await setTheme(page, theme);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${DIR}/scr5-${state}-${viewport.width}-${theme}.png`, fullPage: true });
    });
  });
}
