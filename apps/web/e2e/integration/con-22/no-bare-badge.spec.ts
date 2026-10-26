// NL-117 AC-4: every cell shows I/P/A letters and a confirmed-by mark; no "standards-aligned" wording anywhere.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { as, coverageUrl, screenCells } from "./helpers";
import { seedThreeLessons } from "./seed";

test.setTimeout(240_000);

test("no_bare_badge: every cell shows I/P/A letters and a confirmed-by mark; no standards-aligned wording", async ({ page }) => {
  const fx = await seedThreeLessons();
  await as(page, "reviewer");
  await page.goto(coverageUrl(fx.unit.unit_key));
  await expect(page.locator("main table")).toBeVisible();
  const filled = (await screenCells(page)).filter((c) => c.letters !== "");
  expect(filled).toHaveLength(8);
  for (const c of filled) {
    expect(c.letters, `${c.code} L${c.lesson}`).toMatch(/^[IPA]( [IPA])*$/);
    expect(["Person", "Judge only", "Generator only"], `${c.code} L${c.lesson}`).toContain(c.mark);
  }
  expect(await page.locator("main").innerText()).not.toMatch(/standards-aligned/i);
  expect(await page.locator("main table caption").innerText()).not.toMatch(/standards-aligned/i);
  const dir = resolve(__dirname, "../../../src/features/coverage");
  const g = spawnSync("grep", ["-rniE", "standards-aligned", dir], { encoding: "utf8" });
  expect(g.status, g.stdout).toBe(1);
});
