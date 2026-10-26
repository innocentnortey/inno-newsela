import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SESSIONS } from "../../src/test-utils/fixtures";
import { mockOperation } from "../../src/test-utils/mock-operation";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { signInAs } from "../../src/test-utils/sign-in-as";
import { routeBoard } from "../board/board-fixtures";
import {
  emptyMetrics,
  metrics,
  QUALITY_URL,
  serveMetrics,
  zeroMedian,
} from "./fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const shotDir = () => path.join(__dirname, "..", "__screenshots__", "quality");
const h1 = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Unit quality" });

test("states: V, O and H groups, ratings and seeded errors with n", async ({
  page,
}) => {
  await signInAs(page, "reviewer");
  await serveMetrics(page, metrics());
  await page.goto(QUALITY_URL);
  await expect(h1(page)).toBeVisible();
  for (const g of [
    "Draft quality (V)",
    "Operations and cost (O)",
    "Health (H)",
  ])
    await expect(
      page.getByRole("heading", { level: 2, name: g }),
    ).toBeVisible();
  const tiles = page.locator("main li").filter({ hasText: "n = " });
  expect(await tiles.count()).toBe(8);
  for (const t of await tiles.all()) await expect(t).toContainText("n = ");
  const ratings = page.getByRole("table", { name: "Draft-quality ratings" });
  await expect(
    ratings.getByRole("row", { name: /Usable as drafted\s*1/ }),
  ).toBeVisible();
  await expect(
    ratings.getByRole("row", { name: /Usable with edits\s*2/ }),
  ).toBeVisible();
  await expect(
    ratings.getByRole("row", { name: /Rewritten\s*0/ }),
  ).toBeVisible();
  const seeded = page.getByRole("table", { name: "Seeded-error report" });
  await expect(seeded).toContainText("our reviewers");
  await expect(seeded).toContainText("Planted");
  await expect(seeded).toContainText("5");
  await expect(seeded).toContainText("Caught");
  await expect(seeded).toContainText("4");
  const v4 = page
    .locator("main li")
    .filter({ hasText: "Agreement between judges" });
  await expect(v4).toContainText("No approved lessons yet");
  expect((await v4.innerText()).replace("n = 0", "")).not.toMatch(/\d/);
  expect(await page.locator("main").innerText()).not.toMatch(
    /baseline|ranked|target/i,
  );
  await expect(page.getByText("66.7")).toBeVisible();
});

test("states: every role can open the page", async ({ browser }) => {
  for (const role of ["author", "reviewer", "approver"] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signInAs(page, role);
    await serveMetrics(page, metrics());
    await page.goto(QUALITY_URL);
    await expect(h1(page)).toBeVisible();
    await context.close();
  }
});

test("states: contract example has quality null and reads as cut", async ({
  page,
}) => {
  await signInAs(page, "reviewer");
  await mockOperation(page, "getUnitMetrics", { example: "layoutExample" });
  await page.goto(QUALITY_URL);
  await expect(
    page.getByText(/There is no page in Grade 6 · Unit 4/),
  ).toBeVisible();
});

test("states: one reviewer label and zero are shown", async ({ page }) => {
  await signInAs(page, "reviewer");
  await serveMetrics(page, metrics());
  await page.goto(QUALITY_URL);
  await expect(page.getByText("one reviewer, n = 3")).toBeVisible();
  const v5 = page.locator("main li").filter({ hasText: "Rewritten" }).first();
  await expect(v5).toContainText("0");
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await signInAs(page, "reviewer");
  await serveMetrics(page, zeroMedian());
  await page.goto(QUALITY_URL);
  await expect(page.getByText(/Median 0 min/)).toBeVisible();
});

test("empty: no approved lessons yet", async ({ page }) => {
  await signInAs(page, "reviewer");
  await serveMetrics(page, emptyMetrics());
  await page.goto(QUALITY_URL);
  await expect(h1(page)).toBeVisible();
  await expect(page.getByText("No approved lessons yet")).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(0);
});

test("errors: can't load shows Retry", async ({ page }) => {
  await signInAs(page, "reviewer");
  await respondWithError(page, "getUnitMetrics", "SERVICE_BUSY");
  await page.goto(QUALITY_URL);
  await expect(page.getByText(/Couldn't load unit quality/)).toBeVisible();
  const retry = page.getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await signInAs(page, "reviewer");
  await serveMetrics(page, metrics());
  await retry.click();
  await expect(
    page.getByRole("table", { name: "Draft-quality ratings" }),
  ).toBeVisible();
});

test("errors: a dropped connection shows the same message", async ({
  page,
}) => {
  await signInAs(page, "reviewer");
  await page.route(/\/units\/[^/]+\/metrics/, (route) =>
    route.request().resourceType() === "fetch" ||
    route.request().resourceType() === "xhr"
      ? route.abort()
      : route.fallback(),
  );
  await page.goto(QUALITY_URL);
  await expect(page.getByText(/Couldn't load unit quality/)).toBeVisible();
});

test("errors: unknown unit shows not found", async ({ page }) => {
  await signInAs(page, "reviewer");
  await respondWithError(page, "getUnitMetrics", "NOT_FOUND");
  await page.goto(QUALITY_URL);
  await expect(
    page.getByText(/There is no unit in Grade 6 · Unit 4/),
  ).toBeVisible();
});

test("gr15: no tile or row is keyed by a reviewer name", async ({ page }) => {
  await signInAs(page, "reviewer");
  await serveMetrics(page, metrics());
  await page.goto(QUALITY_URL);
  await expect(h1(page)).toBeVisible();
  const text = await page.locator("main").innerText();
  for (const s of Object.values(SESSIONS))
    expect(text).not.toContain(s.user.name);
  const html = await page.locator("main").innerHTML();
  for (const s of Object.values(SESSIONS)) {
    expect(html).not.toContain(s.user.name);
    expect(html).not.toContain(s.user.user_id);
  }
  const ratingRows = page
    .getByRole("table", { name: "Draft-quality ratings" })
    .locator("tbody tr");
  await expect(ratingRows).toHaveCount(3);
  const seededRows = page
    .getByRole("table", { name: "Seeded-error report" })
    .locator("tbody tr");
  await expect(seededRows).toHaveCount(1);
});

test("cut-flag: reachable while cut 6 stands", async ({ page }) => {
  await signInAs(page, "reviewer");
  await routeBoard(page, {});
  await serveMetrics(page, metrics());
  await page.goto("/units/g6-u4/board");
  const link = page
    .getByRole("navigation", { name: "Related pages" })
    .getByRole("link", { name: "Unit quality" });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/units\/g6-u4\/quality/);
  await expect(h1(page)).toBeVisible();
});

type AxeState = "main" | "empty" | "cantload";
async function arrange(page: Page, state: AxeState) {
  await signInAs(page, "reviewer");
  if (state === "cantload")
    await respondWithError(page, "getUnitMetrics", "SERVICE_BUSY");
  else await serveMetrics(page, state === "empty" ? emptyMetrics() : metrics());
  await page.goto(QUALITY_URL);
  if (state === "cantload")
    await expect(page.getByText(/Couldn't load unit quality/)).toBeVisible();
  else await expect(h1(page)).toBeVisible();
}

for (const state of ["main", "empty", "cantload"] as const) {
  for (const [w, h] of [
    [1280, 900],
    [390, 844],
  ] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`quality ${state} ${w} ${theme} @axe`, async ({ page }) => {
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
        if (state === "main" || state === "cantload")
          await page.screenshot({
            path: path.join(shotDir(), `quality-${state}-${w}-${theme}.png`),
            fullPage: true,
          });
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
