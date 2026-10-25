// NL-102 AC-11: eight real-data screenshots of SCR-20 (main and cant-load) at 1280 and 390, light and dark.
// Written with page.screenshot because the real config's snapshotPathTemplate is fixed to con-1; no baseline diffing.
import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { matrix, setTheme } from "../support/axe";
import { as, createExport, exportUrl } from "./helpers";
import { approverUser, ensureSeeded, freshUnit, linkLessons, reapprove, seedApproved, seedDraft } from "./seed";

const DIR = "e2e/__screenshots__/integration/con-23";
test.setTimeout(300_000);

for (const state of ["main", "error"] as const) {
  test(`scr20 ${state} view @visual`, async ({ page }) => {
    mkdirSync(DIR, { recursive: true });
    await ensureSeeded();
    const unit = await freshUnit();
    const approver = await approverUser();
    const lessons = [];
    for (const n of [1, 2, 3, 4]) lessons.push(await seedApproved({ unit, number: n, approver_id: approver.user_id }));
    await seedDraft({ unit, number: 5 });
    await linkLessons(unit, 4, 5);
    await as(page, approver);
    if (state === "main") {
      // two earlier versions plus the live plan, so the whole screen is populated
      expect((await createExport(page, unit.unit_key)).status()).toBe(201);
      await reapprove(lessons[0]!, "VISUAL-SECOND-VERSION", approver.user_id);
      expect((await createExport(page, unit.unit_key)).status()).toBe(201);
      await page.goto(exportUrl(unit.unit_key));
      await expect(page.getByRole("table", { name: "Export versions" })).toBeVisible();
      await expect(page.getByRole("list", { name: "Held back" })).toBeVisible();
    } else {
      await page.route("**/api/units/*/exports", (route) => route.abort());
      await page.goto(exportUrl(unit.unit_key));
      await expect(page.locator("main").getByRole("alert")).toContainText("Couldn't load export");
    }
    await matrix(page, async ({ theme, viewport }) => {
      await setTheme(page, theme);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${DIR}/scr20-${state}-${viewport.width}-${theme}.png`, fullPage: true });
    });
  });
}
