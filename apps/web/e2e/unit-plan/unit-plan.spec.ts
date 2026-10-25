import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockOperation } from "../../src/test-utils/mock-operation";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { signInAs } from "../../src/test-utils/sign-in-as";
import {
  emptyPlan,
  failedPlan,
  letDocumentThrough,
  PLAN_URL,
  planningPlan,
  servePlan,
  storedPlan,
} from "./fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const SHOTS = "e2e/__screenshots__/unit-plan";
const PLANNING =
  "The plan is being written (one call). It appears here before any lesson is drafted.";
const days = (page: Page) =>
  page.getByRole("list", { name: "Teaching days" }).getByRole("listitem");

test("success: every entry in day order and the links rail", async ({
  page,
}) => {
  await signInAs(page, "author");
  await servePlan(page, [storedPlan()]);
  await page.goto(PLAN_URL);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Unit plan · Grade 6 · Unit 4",
  );
  const items = days(page);
  await expect(items).toHaveCount(47);
  const seen = (await items.allTextContents()).map((t) =>
    Number(/^Day (\d+)/.exec(t)?.[1]),
  );
  expect(seen).toEqual(Array.from({ length: 47 }, (_, i) => i + 1));
  await expect(items.nth(3)).toContainText(
    "Hands forward: Lesson 5 compares Percy",
  );
  const rail = page.getByRole("complementary", {
    name: "Links between lessons",
  });
  await expect(rail.getByRole("listitem")).toHaveText(
    "Lesson 4 Homework → Lesson 5 excerpt slot",
  );
  await expect(
    page.getByRole("link", { name: "Lesson 4 Homework" }),
  ).toHaveAttribute("href", "/units/g6-u4/lessons/L4");
  await expect(
    page.getByRole("link", { name: "Lesson 5 excerpt slot" }),
  ).toHaveAttribute("href", "/units/g6-u4/lessons/L5");
});

test("success: ?day=5 focuses that entry", async ({ page }) => {
  await signInAs(page, "author");
  await servePlan(page, [storedPlan()]);
  await page.goto(PLAN_URL + "?day=5");
  await expect(page.locator("#day-5")).toBeFocused();
});

test("planning: polls every 2 s then stops once stored", async ({ page }) => {
  await signInAs(page, "author");
  const served = await servePlan(page, [planningPlan(), storedPlan()]);
  await page.goto(PLAN_URL);
  await expect(page.getByText(PLANNING)).toBeVisible();
  await expect(page.getByRole("list", { name: "Teaching days" })).toHaveCount(
    0,
  );
  await expect(days(page)).toHaveCount(47, { timeout: 8000 });
  expect(served.hits()).toBeGreaterThanOrEqual(2);
  const afterStored = served.hits();
  await page.waitForTimeout(5000);
  expect(served.hits()).toBe(afterStored);
});

test("empty: no plan yet", async ({ page }) => {
  await signInAs(page, "author");
  await servePlan(page, [emptyPlan()]);
  await page.goto(PLAN_URL);
  await expect(
    page.getByText("No plan yet. A run writes the plan first."),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary", { name: "Links between lessons" }),
  ).toContainText("No links between lessons.");
});

test("failed plan: says the run is paused", async ({ page }) => {
  await signInAs(page, "author");
  await servePlan(page, [failedPlan()]);
  await page.goto(PLAN_URL);
  await expect(page.getByText(/The plan couldn't be written/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open the run" }),
  ).toHaveAttribute("href", "/units/g6-u4/runs/run-0001");
});

test("cantload: shared can't-load with Retry", async ({ page }) => {
  await signInAs(page, "author");
  await respondWithError(page, "getUnitPlan", "SERVICE_BUSY");
  await letDocumentThrough(page);
  await page.goto(PLAN_URL);
  await expect(
    page.getByText(
      "Couldn't load the unit plan. Check your connection and try again.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
});

test("notfound: shared not-found", async ({ page }) => {
  await signInAs(page, "author");
  await mockOperation(page, "getUnitPlan", { code: 404 });
  await letDocumentThrough(page);
  await page.goto(PLAN_URL);
  await expect(
    page.getByText("There is no plan in Grade 6 · Unit 4"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to the board" }),
  ).toBeVisible();
});

for (const role of ["author", "reviewer", "approver"] as const) {
  test(`read-only for ${role}`, async ({ page }) => {
    await signInAs(page, role);
    await servePlan(page, [storedPlan()]);
    await page.goto(PLAN_URL);
    await expect(days(page)).toHaveCount(47);
    await expect(page.getByRole("button", { name: /edit/i })).toHaveCount(0);
  });
}

type AxeState =
  "main" | "planning" | "failed" | "empty" | "cantload" | "notfound";
async function arrange(page: Page, state: AxeState) {
  await signInAs(page, "author");
  switch (state) {
    case "main":
      await servePlan(page, [storedPlan()]);
      break;
    case "planning":
      await servePlan(page, [planningPlan()]);
      break;
    case "failed":
      await servePlan(page, [failedPlan()]);
      break;
    case "empty":
      await servePlan(page, [emptyPlan()]);
      break;
    case "cantload":
      await respondWithError(page, "getUnitPlan", "SERVICE_BUSY");
      await letDocumentThrough(page);
      break;
    case "notfound":
      await mockOperation(page, "getUnitPlan", { code: 404 });
      await letDocumentThrough(page);
      break;
  }
  await page.goto(PLAN_URL);
  if (state === "main") await expect(days(page)).toHaveCount(47);
  else if (state === "planning")
    await expect(page.getByText(PLANNING)).toBeVisible();
  else if (state === "failed")
    await expect(page.getByText(/The plan couldn't be written/)).toBeVisible();
  else if (state === "empty")
    await expect(page.getByText("No plan yet.")).toBeVisible();
  else if (state === "cantload")
    await expect(page.getByText(/Couldn't load the unit plan/)).toBeVisible();
  else await expect(page.getByText(/There is no plan in/)).toBeVisible();
}

const STATES: AxeState[] = [
  "main",
  "planning",
  "failed",
  "empty",
  "cantload",
  "notfound",
];
for (const state of STATES) {
  for (const [w, h] of [
    [1280, 900],
    [390, 844],
  ] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`unit-plan ${state} ${w} ${theme} @axe`, async ({ page }) => {
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
            path: `${SHOTS}/unit-plan-${state}-${w}-${theme}.png`,
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
