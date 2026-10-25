// NL-94 AC-12: eight real-data screenshots of SCR-4 (main and one error state) for the look-sheet comparison.
// Written with page.screenshot because the real config's snapshotPathTemplate is fixed to con-1; no baseline diffing.
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { matrix, setTheme } from "../support/axe";
import { authorWithUpload, screenUrl } from "./helpers";

const DIR = "e2e/__screenshots__/integration/con-3";
test.setTimeout(120_000);

for (const state of ["main", "error"] as const) {
  test(`scr4 ${state} state @visual`, async ({ page }) => {
    mkdirSync(DIR, { recursive: true });
    const { up } = await authorWithUpload(page);
    await page.goto(screenUrl(up));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    if (state === "error") {
      await page.getByRole("button", { name: "Edit fix for row 39" }).click();
      await page.getByLabel("Corrected code for row 39").fill("ZZ.9.9");
      await page.getByRole("button", { name: "Save", exact: true }).click();
      await expect(page.getByText("That is not a known standard code.").first()).toBeVisible();
    }
    await matrix(page, async ({ theme, viewport }) => {
      await setTheme(page, theme);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${DIR}/scr4-${state}-${viewport.width}-${theme}.png`, fullPage: true });
    });
  });
}
