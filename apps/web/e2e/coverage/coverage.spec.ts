import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockOperation } from "../../src/test-utils/mock-operation";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { signInAs } from "../../src/test-utils/sign-in-as";
import { routeBoard } from "../board/board-fixtures";
import {
  COVERAGE_URL,
  emptyMatrix,
  matrix,
  serveCoverage,
} from "./fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
// Playwright loads specs as CommonJS, so __dirname is the folder of this file.
const shotDir = () => path.join(__dirname, "..", "__screenshots__", "coverage");
const h1 = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Coverage" });
const grid = (page: Page) =>
  page.getByRole("table", { name: "Coverage matrix" });

test("states: grid has standards as row headers and lessons as column headers", async ({
  page,
}) => {
  await signInAs(page, "author");
  await serveCoverage(page, matrix());
  await page.goto(COVERAGE_URL);
  await expect(h1(page)).toBeVisible();
  await expect(grid(page)).toBeVisible();
  await expect(page.getByRole("rowheader")).toHaveCount(4);
  await expect(
    page.getByRole("rowheader").filter({ hasText: "L.6.4.b" }),
  ).toHaveCount(1);
  for (const name of ["Standard", "Lesson 3", "Lesson 4", "Lesson 5"])
    await expect(
      page.getByRole("columnheader", { name, exact: true }),
    ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: /Assessed.*Confirmed by a person/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: /Judge only, not confirmed by a person/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("cell", { name: /Generator only/ }),
  ).toBeVisible();
  const rl61 = page.locator('tr[data-code="RL.6.1"] td').nth(1);
  await expect(rl61).toContainText("P");
  // Lesson column headers link on to the workspace; nothing in the grid edits.
  await expect(
    page.getByRole("columnheader", { name: "Lesson 4" }).getByRole("link"),
  ).toHaveAttribute("href", "/units/g6-u4/lessons/L4");

  // The contract example, served by Prism.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await signInAs(page, "author");
  await mockOperation(page, "getCoverageMatrix", { example: "lesson4" });
  await page.goto(COVERAGE_URL);
  await expect(
    page.getByRole("columnheader", { name: "Lesson 4" }),
  ).toBeVisible();
  await expect(
    page.getByRole("rowheader").filter({ hasText: "RL.6.1" }),
  ).toBeVisible();
});

test("states: first column stays put while the box scrolls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signInAs(page, "author");
  await serveCoverage(page, matrix());
  await page.goto(COVERAGE_URL);
  const box = page.getByRole("region", { name: "Coverage matrix" });
  await expect(grid(page)).toBeVisible();
  const first = page.getByRole("rowheader").first();
  expect(
    await box.evaluate((el) => el.scrollWidth > el.clientWidth),
  ).toBe(true);
  expect(await first.evaluate((el) => getComputedStyle(el).position)).toBe(
    "sticky",
  );
  const boxX = (await box.boundingBox())!.x;
  expect(Math.abs((await first.boundingBox())!.x - boxX)).toBeLessThan(1);
  await box.evaluate((el) => {
    el.scrollLeft = 120;
  });
  expect(await box.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  expect(Math.abs((await first.boundingBox())!.x - boxX)).toBeLessThan(1);
});

test("states: ?standard= highlights that row", async ({ page }) => {
  await signInAs(page, "author");
  await serveCoverage(page, matrix());
  await page.goto("/units/g6-u4/coverage?standard=L.6.4.b&view=1");
  await expect(grid(page)).toBeVisible();
  await expect(page.locator('tr[aria-current="true"]')).toHaveCount(1);
  await expect(
    page.locator('tr[aria-current="true"]').getByRole("rowheader"),
  ).toContainText("L.6.4.b");

  await page.goto("/units/g6-u4/coverage?standard=NOPE.1&view=1");
  await expect(grid(page)).toBeVisible();
  await expect(page.locator('tr[aria-current="true"]')).toHaveCount(0);
});

test("states: never assessed standard shows the warning", async ({ page }) => {
  await signInAs(page, "author");
  await serveCoverage(page, matrix());
  await page.goto(COVERAGE_URL);
  await expect(grid(page)).toBeVisible();
  const never = page.locator('tr[data-code="SL.6.1"]');
  await expect(never).toContainText("Never assessed");
  await expect(never.locator('[data-glyph="triangle-bang"]')).toHaveCount(1);
  for (const code of ["RL.6.1", "RL.6.2", "L.6.4.b"]) {
    const row = page.locator(`tr[data-code="${code}"]`);
    await expect(row).not.toContainText("Never assessed");
    await expect(row.locator("[data-glyph]")).toHaveCount(0);
  }
});

test("empty: no lessons yet", async ({ page }) => {
  await signInAs(page, "author");
  await serveCoverage(page, emptyMatrix());
  await page.goto(COVERAGE_URL);
  await expect(page.getByText("No lessons yet")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("errors: can't load shows Retry", async ({ page }) => {
  await signInAs(page, "author");
  await respondWithError(page, "getCoverageMatrix", "SERVICE_BUSY");
  await page.goto(COVERAGE_URL);
  await expect(page.getByText(/Couldn't load coverage/)).toBeVisible();
  const retry = page.getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await signInAs(page, "author");
  await serveCoverage(page, matrix());
  await retry.click();
  await expect(grid(page)).toBeVisible();

  // A dropped connection reads the same.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await signInAs(page, "author");
  await page.route("**/units/*/coverage", (r) =>
    r.request().resourceType() === "fetch" ? r.abort() : r.fallback(),
  );
  await page.goto(COVERAGE_URL);
  await expect(page.getByText(/Couldn't load coverage/)).toBeVisible();
});

test("errors: unknown unit shows not found", async ({ page }) => {
  await signInAs(page, "author");
  await respondWithError(page, "getCoverageMatrix", "NOT_FOUND");
  await page.goto(COVERAGE_URL);
  await expect(
    page.getByText(/There is no unit in Grade 6 · Unit 4/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to the board" }),
  ).toBeVisible();
});

for (const role of ["author", "reviewer", "approver"] as const) {
  test(`roles: every role is read only (${role})`, async ({ page }) => {
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET" && /\/coverage/.test(r.url()))
        writes.push(r.method() + " " + r.url());
    });
    await signInAs(page, role);
    await serveCoverage(page, matrix());
    await page.goto(COVERAGE_URL);
    await expect(grid(page)).toBeVisible();
    const region = page.getByRole("region", { name: "Coverage matrix" });
    for (const r of ["button", "textbox", "checkbox", "combobox"] as const)
      await expect(region.getByRole(r)).toHaveCount(0);
    expect(writes).toEqual([]);
  });
}

test("cut-flag: reachable from the board while cut 4 stands", async ({
  page,
}) => {
  await signInAs(page, "author");
  await routeBoard(page);
  await serveCoverage(page, matrix());
  await page.goto("/units/g6-u4/board");
  await page
    .getByRole("navigation", { name: "Related pages" })
    .getByRole("link", { name: "Coverage" })
    .click();
  await expect(page).toHaveURL(/\/units\/g6-u4\/coverage$/);
  await expect(h1(page)).toBeVisible();
  // No primary-nav entry exists for Coverage by design.
  await expect(
    page
      .getByRole("navigation")
      .filter({ hasNot: page.getByRole("link", { name: "Run summary" }) })
      .getByRole("link", { name: "Coverage", exact: true }),
  ).toHaveCount(0);
});

type State = "main" | "empty" | "cantload";

async function arrange(page: Page, state: State) {
  await signInAs(page, "author");
  if (state === "cantload")
    await respondWithError(page, "getCoverageMatrix", "SERVICE_BUSY");
  else await serveCoverage(page, state === "empty" ? emptyMatrix() : matrix());
  await page.goto(COVERAGE_URL);
  if (state === "cantload")
    await expect(page.getByText(/Couldn't load coverage/)).toBeVisible();
  else if (state === "empty")
    await expect(page.getByText("No lessons yet")).toBeVisible();
  else await expect(grid(page)).toBeVisible();
}

for (const state of ["main", "empty", "cantload"] as State[]) {
  for (const [w, h] of [
    [1280, 900],
    [390, 844],
  ] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`coverage ${state} ${w} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await arrange(page, state);
        await page.evaluate(
          (t) => document.documentElement.setAttribute("data-theme", t),
          theme,
        );
        await page.evaluate(() => document.fonts.ready);
        const results = await new AxeBuilder({ page: page as AxePage })
          .withTags(TAGS)
          .analyze();
        const bad = results.violations.filter(
          (v) => v.impact === "serious" || v.impact === "critical",
        );
        console.log(
          `axe ${state} ${w}x ${theme}: ${bad.length} serious/critical`,
        );
        if (state === "main" || state === "cantload") {
          await page.screenshot({
            path: path.join(shotDir(), `coverage-${state}-${w}-${theme}.png`),
            fullPage: true,
          });
        }
        expect(
          bad,
          JSON.stringify(
            bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
          ),
        ).toEqual([]);
      });
    }
  }
}
