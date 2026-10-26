// NL-103 AC-9 (WF-20): every SCR-21 state reached with real data has 0 serious and 0 critical axe violations at 1280x900 and 390x844, light and dark.
// Loading and "can't load" are route-faulted (page.route over the otherwise real stack); the over-limit state is not reachable in the UI (maxlength), so it is not scanned.
import { expect, test, type Page } from "@playwright/test";
import { axeScan, matrix, setTheme } from "../support/axe";
import { authorSession, openGuidance, PG_PATH, releaseSpend, roleSession } from "./helpers";
import { drainTrial, reachDayCap, reachMade, reachMaking, reachReasonError, reachStale } from "./states";
import { seedL4 } from "./seed";

test.describe.configure({ mode: "serial" });
test.setTimeout(240_000);
test.beforeAll(async ({ browser }) => {
  test.setTimeout(240_000);
  await seedL4(browser);
});
test.afterEach(releaseSpend);

async function scanAll(page: Page, state: string): Promise<void> {
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    const r = await axeScan(page);
    console.log(`axe scr21 ${state} ${viewport.width}x${viewport.height} ${theme}: serious=${r.serious} critical=${r.critical}`);
    expect(r.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
  });
}

test("axe: success list and editor @axe", async ({ page }) => {
  await authorSession(page);
  await openGuidance(page);
  await scanAll(page, "success");
});
test("axe: reason required @axe", async ({ page }) => {
  await authorSession(page);
  await reachReasonError(page);
  await scanAll(page, "reason-required");
});
test("axe: stale base banner @axe", async ({ page, browser }) => {
  await authorSession(page);
  await reachStale(browser, page);
  await scanAll(page, "stale-base");
});
test("axe: trial making @axe", async ({ page }) => {
  const { user } = await authorSession(page);
  await reachMaking(page);
  await scanAll(page, "trial-making");
  await drainTrial(user);
});
test("axe: trial success @axe", async ({ page }) => {
  const { user } = await authorSession(page);
  await reachMade(page, user);
  await scanAll(page, "trial-success");
});
test("axe: trial day cap banner @axe", async ({ page }) => {
  const { user } = await authorSession(page);
  await reachDayCap(page, user);
  await scanAll(page, "trial-day-cap");
});
test("axe: read-only reviewer view @axe", async ({ page }) => {
  await roleSession(page, "reviewer");
  await page.goto(PG_PATH);
  await expect(page.getByText("Only authors edit guidance.")).toBeVisible();
  await scanAll(page, "read-only");
});
test("axe: loading (route-faulted) @axe", async ({ page }) => {
  await authorSession(page);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route("**/api/prompt-versions", async (route) => {
    if (route.request().method() === "GET") await gate;
    await route.continue();
  });
  await page.goto(PG_PATH);
  await expect(page.getByText("Loading prompt guidance")).toBeAttached();
  await scanAll(page, "loading");
  release();
  await expect(page.getByLabel("Guidance text")).toBeVisible();
});
test("axe: cannot load (route-faulted) @axe", async ({ page }) => {
  await authorSession(page);
  await page.route("**/api/prompt-versions", (route) => (route.request().method() === "GET" ? route.abort() : route.continue()));
  await page.goto(PG_PATH);
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
  await scanAll(page, "cannot-load");
});
test("axe: lessons cannot load (route-faulted) @axe", async ({ page }) => {
  await authorSession(page);
  await page.route("**/api/units", (route) => route.abort());
  await openGuidance(page);
  await expect(page.getByText("Couldn't load lessons.")).toBeVisible();
  await scanAll(page, "lessons-cannot-load");
});
