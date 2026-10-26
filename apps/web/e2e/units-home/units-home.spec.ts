import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { COLLAB_COOKIE } from "../../src/test-utils/fixtures";
import { mockOperation } from "../../src/test-utils/mock-operation";
import { errorStatus } from "../../src/test-utils/operations";
import { signInAs } from "../../src/test-utils/sign-in-as";
import type { Role } from "../../src/lib/roles";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const SHOTS = "e2e/__screenshots__/units-home";

const version = (n: number, sha: string, same: number | null) => ({
  outline_version_id: `G6.U4.ov${n}`,
  unit_id: "G6.U4",
  unit_key: "g6-u4",
  version_number: n,
  sha256: sha,
  same_as_version: same,
  changed_lessons: 0,
  row_counts: { lessons: 41, flex_days: 6, arc_headers: 7, total_rows: 1 },
  created_at: "2026-10-25T15:02:00Z",
  created_by: "Author (demo)",
});
const unit = (versions: ReturnType<typeof version>[], latest_run: { run_id: string; state: string } | null) => ({
  units: [{ unit_id: "G6.U4", unit_key: "g6-u4", title: "Grade 6 · Unit 4", versions, latest_run }],
});
const NO_RUN = unit([version(2, "a1" + "0".repeat(61) + "1", 1)], null);
const THREE = unit(
  [version(3, "b2" + "0".repeat(61) + "2", null), version(2, "a1" + "0".repeat(61) + "1", 1), version(1, "a1" + "0".repeat(61) + "1", null)],
  { run_id: "run-0001", state: "running" },
);

/**
 * `apiGlob("/units")` (`**` + "/units") also matches the page's own document request for /units, so the shared
 * mockOperation/respondWithError helpers would swallow the navigation. These route only the API origin.
 */
const isUnitsApi = (url: URL) => url.port === "4010" && url.pathname === "/units";
async function units(page: Page, handler: Parameters<Page["route"]>[1]) {
  await page.route(isUnitsApi, (route, req) => (req.method() === "GET" ? handler(route, req) : route.fallback()));
}
async function listUnitsFromPrism(page: Page) {
  await units(page, async (route) => {
    const response = await route.fetch({
      headers: { ...route.request().headers(), cookie: `${COLLAB_COOKIE.name}=${COLLAB_COOKIE.value}`, prefer: "example=oneUnit" },
    });
    await route.fulfill({ response, headers: { ...response.headers(), "access-control-allow-origin": "*" } });
  });
}

async function ready(page: Page, role: Role = "author") {
  await signInAs(page, role);
  await listUnitsFromPrism(page);
  await mockOperation(page, "getRunProgress", { example: "lesson4Ready" });
}
async function fulfillUnits(page: Page, body: unknown) {
  await units(page, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(body) }),
  );
}
const busy = (route: Parameters<Parameters<Page["route"]>[1]>[0]) =>
  route.fulfill({
    status: errorStatus("SERVICE_BUSY"),
    contentType: "application/json",
    headers: { "x-request-id": "req-test", "access-control-allow-origin": "*", "access-control-expose-headers": "x-request-id" },
    body: JSON.stringify({ error: { code: "SERVICE_BUSY", message: "Test message for SERVICE_BUSY", details: {} } }),
  });
/** Fails every /units call until the returned `recover()` is called (React strict mode in dev runs the first effect twice). */
async function failUntilRecovered(page: Page) {
  let failing = true;
  await units(page, (route) => (failing ? busy(route) : route.fallback()));
  return () => {
    failing = false;
  };
}
async function delay(page: Page, ms: number) {
  await units(page, async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    return route.fallback();
  });
}
async function open(page: Page) {
  await page.goto("/units");
  await expect(page.getByRole("heading", { level: 1, name: "Units" })).toBeVisible();
}

test("states: loading shows a skeleton card and 3 rows", async ({ page }) => {
  await ready(page);
  await delay(page, 1500);
  await open(page);
  await expect(page.getByTestId("units-skeleton")).toBeVisible();
  await expect(page.getByTestId("units-skeleton-row")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Grade 6 · Unit 4" })).toBeVisible();
});

test("states: success lists the unit card and every version", async ({ page }) => {
  await ready(page);
  await open(page);
  await expect(page.getByRole("link", { name: "Grade 6 · Unit 4" })).toBeVisible();
  await expect(page.getByText("Running", { exact: true })).toBeVisible();
  await expect(page.getByText("1 of 3 ready")).toBeVisible();
  const table = page.getByRole("table", { name: "Outline versions" });
  await expect(table.locator("tbody tr")).toHaveCount(1);
  await expect(table.getByText("a1000000")).toBeVisible();
  await expect(table.getByText("same as v1")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open the board" })).toHaveAttribute("href", "/units/g6-u4/board");
  await expect(page.getByRole("link", { name: "Validation report", exact: true })).toHaveAttribute("href", "/units/g6-u4/outlines/2");
  await expect(page.getByRole("link", { name: "View run progress" })).toHaveAttribute("href", "/units/g6-u4/runs/run-0001");
  await expect(page.getByRole("link", { name: "Upload outline" })).toHaveAttribute("href", "/units/g6-u4/outlines/new");
  await expect(page.getByRole("main").getByRole("link", { name: "Prompt guidance" })).toBeVisible();
});

test("states: repeated hash shows same as v1 on a 3-version list", async ({ page }) => {
  await ready(page);
  await fulfillUnits(page, THREE);
  await open(page);
  const table = page.getByRole("table", { name: "Outline versions" });
  await expect(table.locator("tbody tr")).toHaveCount(3);
  await expect(table.getByText("same as v1")).toHaveCount(1);
  await expect(table.locator("tbody tr").nth(1)).toContainText("same as v1");
});

test("states: failed listUnits shows can't-load and Retry recovers", async ({ page }) => {
  await ready(page);
  const recover = await failUntilRecovered(page);
  await open(page);
  await expect(page.getByRole("alert").filter({ hasText: "Couldn't load units. Check your connection and try again." })).toBeVisible();
  recover();
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("link", { name: "Grade 6 · Unit 4" })).toBeVisible();
});

test("states: makes no repeated requests", async ({ page }) => {
  let units = 0;
  let progress = 0;
  page.on("request", (r) => {
    if (r.method() !== "GET") return;
    const p = new URL(r.url()).pathname;
    if (new URL(r.url()).port !== "4010") return;
    if (p === "/units") units++;
    if (/\/runs\/[^/]+\/progress$/.test(p)) progress++;
  });
  await ready(page);
  await open(page);
  await expect(page.getByRole("link", { name: "Grade 6 · Unit 4" })).toBeVisible();
  const settled = { units, progress };
  // Dev-mode React strict mode runs each load effect twice, and two callers load /units (the page and the frame's nav-unit hook, GEN-5),
  // so the count after load may be 4; polling would grow it.
  expect(settled.units).toBeLessThanOrEqual(4);
  expect(settled.progress).toBeLessThanOrEqual(2);
  await page.waitForTimeout(4500);
  expect({ units, progress }).toEqual(settled);
});

test("empty: first use shows the sentence and Upload outline", async ({ page }) => {
  await signInAs(page, "author");
  await fulfillUnits(page, { units: [] });
  await open(page);
  await expect(
    page.getByText("No outline uploaded yet. Upload the unit's outline sheet to see its validation report before any lesson is drafted."),
  ).toBeVisible();
  const upload = page.getByRole("link", { name: "Upload outline" });
  await expect(upload).toHaveCount(1);
  await expect(upload).toHaveAttribute("href", "/units/g6-u4/outlines/new");
});

test("empty: no run yet links to the report", async ({ page }) => {
  await signInAs(page, "author");
  await fulfillUnits(page, NO_RUN);
  await open(page);
  await expect(page.getByRole("link", { name: "No run yet. Confirm the report, then generate." })).toHaveAttribute(
    "href",
    "/units/g6-u4/outlines/2",
  );
});

for (const role of ["reviewer", "approver"] as const) {
  test(`role: ${role} sees no Upload outline or Prompt guidance`, async ({ page }) => {
    await ready(page, role);
    await open(page);
    await expect(page.getByRole("link", { name: "Grade 6 · Unit 4" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Upload outline" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Prompt guidance" })).toHaveCount(0);
  });
}

for (const state of ["loading", "main", "empty", "norun", "error"] as const) {
  for (const [w, h] of [
    [1280, 900],
    [390, 844],
  ] as [number, number][]) {
    for (const theme of ["light", "dark"]) {
      test(`units-home ${state} ${w} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        if (state === "main") await ready(page);
        else {
          await signInAs(page, "author");
          if (state === "empty") await fulfillUnits(page, { units: [] });
          if (state === "norun") await fulfillUnits(page, NO_RUN);
          if (state === "loading") {
            await listUnitsFromPrism(page);
            await delay(page, 8000);
          }
          if (state === "error") await units(page, busy);
        }
        await open(page);
        if (state === "loading") await expect(page.getByTestId("units-skeleton")).toBeVisible();
        if (state === "error") await expect(page.getByRole("alert").filter({ hasText: "Couldn't load units" })).toBeVisible();
        if (state === "main") await expect(page.getByRole("link", { name: "Grade 6 · Unit 4" })).toBeVisible();
        if (state === "empty") await expect(page.getByText(/No outline uploaded yet/)).toBeVisible();
        if (state === "norun") await expect(page.getByRole("link", { name: /No run yet/ })).toBeVisible();
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await page.evaluate(() => document.fonts.ready);
        const results = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).analyze();
        const bad = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        console.log(`axe ${state} ${w}x ${theme}: ${bad.length} serious/critical`);
        if (state === "main" || state === "error") {
          await page.screenshot({ path: `${SHOTS}/units-home-${state}-${w}-${theme}.png`, fullPage: true });
        }
        expect(bad.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
      });
    }
  }
}
