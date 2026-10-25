// NL-97 AC-9: axe (WCAG 2.2 AA tags) on every SCR-17 state reached with real data, 2 viewports x 2 themes.
// The loading state has no role=status: the screen marks it aria-busy with an sr-only "Loading run summary" (asserted instead).
import { expect, test, type Page } from "@playwright/test";
import { axeScan, matrix, setTheme } from "../support/axe";
import { asRole, sharedRun, summaryApi, summaryUrl } from "./helpers";

test.setTimeout(300_000);

async function check(page: Page, state: string): Promise<void> {
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    const r = await axeScan(page);
    console.log(`axe ${state} ${viewport.width}px ${theme}: ${r.serious} serious, ${r.critical} critical`);
    expect(r.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
  });
}

test("axe loading @axe", async ({ page }) => {
  const { up, runId } = await sharedRun(page, "mixed");
  await page.route("**/api/runs/*/summary", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto(summaryUrl(runId, up.unit_key));
  await expect(page.locator("[aria-busy=true]")).toBeAttached();
  await expect(page.getByText("Loading run summary")).toBeAttached();
  await check(page, "loading");
});

test("axe in-progress @axe", async ({ page }) => {
  const { up, runId } = await sharedRun(page, "queued");
  await page.goto(summaryUrl(runId, up.unit_key));
  await expect(page.getByText("This run is still going. Numbers so far:")).toBeVisible();
  await check(page, "in-progress");
});

test("axe no-failures @axe", async ({ page }) => {
  const { up, runId } = await sharedRun(page, "repaired");
  await page.goto(summaryUrl(runId, up.unit_key));
  await expect(page.getByText("No failures.")).toBeVisible();
  await check(page, "no-failures");
});

test("axe success @axe", async ({ page }) => {
  const { up, runId } = await sharedRun(page, "mixed");
  await page.goto(summaryUrl(runId, up.unit_key));
  await expect(page.getByLabel("Run figures")).toBeVisible();
  await check(page, "success");
});

test("axe cant-load @axe", async ({ page }) => {
  const { up, runId } = await sharedRun(page, "mixed");
  await page.route("**/api/runs/*/summary", (route) => route.abort());
  await page.goto(summaryUrl(runId, up.unit_key));
  await expect(page.locator("main").getByRole("alert")).toContainText("Couldn't load run summary");
  await check(page, "cant-load");
});

test("axe role view reviewer @axe", async ({ page }) => {
  const { up, runId } = await sharedRun(page, "mixed");
  await asRole(page, "reviewer");
  expect((await page.request.get(summaryApi(runId))).status()).toBe(200);
  await page.goto(summaryUrl(runId, up.unit_key));
  await expect(page.getByLabel("Run figures")).toBeVisible();
  await check(page, "role-view");
});
