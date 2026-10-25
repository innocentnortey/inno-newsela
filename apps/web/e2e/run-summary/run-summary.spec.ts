import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SESSIONS } from "../../src/test-utils/fixtures";
import { mockOperation } from "../../src/test-utils/mock-operation";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { signInAs } from "../../src/test-utils/sign-in-as";
import { failing, serveSummary, summary, SUMMARY_URL } from "./fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
// Playwright loads specs as CommonJS, so __dirname is the folder of this file.
const shotDir = () =>
  path.join(__dirname, "..", "__screenshots__", "run-summary");

test("states: every part renders from the getRunSummary example", async ({
  page,
}) => {
  await signInAs(page, "author");
  await mockOperation(page, "getRunSummary", { example: "trial" });
  await page.goto(SUMMARY_URL);
  await expect(
    page.getByRole("heading", { level: 1, name: "Run summary" }),
  ).toBeVisible();
  const dl = page
    .getByRole("list", { name: "Run figures" })
    .or(page.locator("dl[aria-label='Run figures']"));
  await expect(dl).toContainText("Wall time");
  await expect(dl).toContainText("612");
  await expect(dl).toContainText("$0.54");
  await expect(dl).toContainText("3.4");
  await expect(dl).toContainText("against the 5-minute target");
  await expect(dl).toContainText("Retries");
  expect(await page.getByText("n = 3 lessons").count()).toBeGreaterThanOrEqual(
    3,
  );
  await expect(
    page.getByRole("table", { name: "Failures by reason" }),
  ).toBeVisible();
  await expect(page.getByText("No failures.")).toBeVisible();
  const other = page.getByRole("region", { name: "Other counts" });
  await expect(other).toContainText("Placeholders left");
  await expect(other).toContainText("Calls lost in flight");
  await expect(other).toContainText("Brakes fired");
  await expect(other).toContainText("None");
  await expect(other).toContainText("Truncation retries");
});

test("states: failures table, brakes and report link", async ({ page }) => {
  await signInAs(page, "author");
  await serveSummary(page, [failing()]);
  await page.goto(SUMMARY_URL);
  const table = page.getByRole("table", { name: "Failures by reason" });
  await expect(
    table.getByRole("row", { name: /Look Back is 3 minutes \(needs 5\)\s*1/ }),
  ).toBeVisible();
  await expect(table.getByRole("row", { name: /truncated\s*1/ })).toBeVisible();
  await expect(page.getByText("per-run cap $13.00 × 1")).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Full-run report \(file\)/ }),
  ).toHaveAttribute("href", "/reports/run-0001.txt");
});

test("running: info banner shows, poll updates the numbers, polling stops when finished", async ({
  page,
}) => {
  await signInAs(page, "author");
  const served = await serveSummary(page, [
    summary({ state: "running", wall_time_seconds: 120 }),
    summary({ state: "complete", wall_time_seconds: 240 }),
  ]);
  await page.goto(SUMMARY_URL);
  const banner = page.getByText("This run is still going. Numbers so far:");
  await expect(banner).toBeVisible();
  await expect(page.getByText("120", { exact: false }).first()).toBeVisible();
  await expect(page.locator("dl[aria-label='Run figures']")).toContainText(
    "240",
    { timeout: 6000 },
  );
  await expect(banner).toHaveCount(0);
  const at = served.hits();
  await page.waitForTimeout(6000);
  console.log(`running poll hits stop at ${at}`);
  expect(served.hits()).toBe(at);
});

test('clean: no failures reads "No failures."', async ({ page }) => {
  await signInAs(page, "author");
  await serveSummary(page, [summary({ failures_by_reason: [] })]);
  await page.goto(SUMMARY_URL);
  await expect(page.getByText("No failures.")).toBeVisible();
  await expect(page.getByText(/still going/)).toHaveCount(0);
});

test("errors: can't load shows Retry", async ({ page }) => {
  await signInAs(page, "author");
  await respondWithError(page, "getRunSummary", "SERVICE_BUSY");
  await page.goto(SUMMARY_URL);
  await expect(page.getByText(/Couldn't load run summary/)).toBeVisible();
  const retry = page.getByRole("button", { name: "Retry" });
  await expect(retry).toBeVisible();
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await signInAs(page, "author");
  await serveSummary(page, [summary()]);
  await retry.click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Run summary" }),
  ).toBeVisible();
});

test("errors: unknown run shows not found", async ({ page }) => {
  await signInAs(page, "author");
  await respondWithError(page, "getRunSummary", "NOT_FOUND");
  await page.goto(SUMMARY_URL);
  await expect(
    page.getByText(/There is no run in Grade 6 · Unit 4/),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to the board" }),
  ).toBeVisible();
});

test("gr15: every role sees the same read-only numbers and no person", async ({
  browser,
}) => {
  const texts: string[] = [];
  for (const role of ["author", "reviewer", "approver"] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET" && /\/runs\//.test(r.url()))
        writes.push(r.method() + " " + r.url());
    });
    await signInAs(page, role);
    await serveSummary(page, [failing()]);
    await page.goto(SUMMARY_URL);
    const main = page.locator("main");
    await expect(
      page.getByRole("heading", { level: 1, name: "Run summary" }),
    ).toBeVisible();
    texts.push(await main.locator("dl[aria-label='Run figures']").innerText());
    const mainText = await main.innerText();
    for (const s of Object.values(SESSIONS))
      expect(mainText).not.toContain(s.user.name);
    await expect(main.getByRole("button")).toHaveCount(0);
    expect(writes).toEqual([]);
    await context.close();
  }
  expect(texts[1]).toBe(texts[0]);
  expect(texts[2]).toBe(texts[0]);
});

type AxeState = "main" | "going" | "nofailures" | "cantload" | "notfound";

async function arrange(page: Page, state: AxeState) {
  await signInAs(page, "author");
  if (state === "cantload")
    await respondWithError(page, "getRunSummary", "SERVICE_BUSY");
  else if (state === "notfound")
    await respondWithError(page, "getRunSummary", "NOT_FOUND");
  else if (state === "going")
    await serveSummary(page, [
      summary({ state: "running", wall_time_seconds: 120 }),
    ]);
  else if (state === "nofailures") await serveSummary(page, [summary()]);
  else await serveSummary(page, [failing()]);
  await page.goto(SUMMARY_URL);
  if (state === "cantload")
    await expect(page.getByText(/Couldn't load run summary/)).toBeVisible();
  else if (state === "notfound")
    await expect(page.getByText(/There is no run in/)).toBeVisible();
  else
    await expect(
      page.getByRole("heading", { level: 1, name: "Run summary" }),
    ).toBeVisible();
}

const STATES: AxeState[] = [
  "main",
  "going",
  "nofailures",
  "cantload",
  "notfound",
];
for (const state of STATES) {
  for (const [w, h] of [
    [1280, 900],
    [390, 844],
  ] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`run-summary ${state} ${w} ${theme} @axe`, async ({ page }) => {
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
            path: path.join(
              shotDir(),
              `run-summary-${state}-${w}-${theme}.png`,
            ),
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
