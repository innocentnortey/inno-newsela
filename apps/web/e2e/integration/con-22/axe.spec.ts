// NL-117 AC-9: axe (WCAG 2.2 AA tags) on every SCR-18 state reached on the real backend, 2 viewports x 2 themes.
import { expect, test, type Page } from "@playwright/test";
import { axeScan, matrix, setTheme } from "../support/axe";
import { as, coverageUrl } from "./helpers";
import { ensureSeeded, freshUnit, seedThreeLessons } from "./seed";
import { seedLesson } from "../con-20/seed";

test.setTimeout(300_000);

async function check(page: Page, state: string): Promise<void> {
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    const r = await axeScan(page);
    console.log(`axe ${state} ${viewport.width}px ${theme}: ${r.serious} serious, ${r.critical} critical`);
    expect(r.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
  });
}

test("coverage main @axe", async ({ page }) => {
  const fx = await seedThreeLessons();
  await as(page, "reviewer");
  await page.goto(coverageUrl(fx.unit.unit_key));
  await expect(page.locator("main table")).toBeVisible();
  await check(page, "main");
});

test("coverage empty @axe", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  await as(page, "reviewer");
  await page.goto(coverageUrl(unit.unit_key));
  await expect(page.getByText("No lessons yet")).toBeVisible();
  await check(page, "empty");
});

test("coverage no-standards @axe", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  await seedLesson({ unit, number: 1, state: "submitted", content: "wp1" });
  await as(page, "reviewer");
  await page.goto(coverageUrl(unit.unit_key));
  await expect(page.getByText("No standards linked yet.")).toBeVisible();
  await check(page, "no-standards");
});

test("coverage not-found @axe", async ({ page }) => {
  await as(page, "reviewer");
  await page.goto("/units/g9-u99/coverage");
  await expect(page.getByText("There is no unit in", { exact: false })).toBeVisible();
  await check(page, "not-found");
});

test("coverage cant-load @axe", async ({ page }) => {
  const fx = await seedThreeLessons();
  await as(page, "reviewer");
  await page.route("**/api/units/*/coverage", (route) => route.abort());
  await page.goto(coverageUrl(fx.unit.unit_key));
  await expect(page.getByText("Couldn't load coverage")).toBeVisible();
  await check(page, "cant-load");
});

test("coverage loading @axe", async ({ page }) => {
  const fx = await seedThreeLessons();
  await as(page, "reviewer");
  await page.route("**/api/units/*/coverage", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto(coverageUrl(fx.unit.unit_key));
  await expect(page.locator("[aria-busy=true]")).toBeAttached();
  await expect(page.getByText("Loading coverage")).toBeAttached();
  await check(page, "loading");
});
