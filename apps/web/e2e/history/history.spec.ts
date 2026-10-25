import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockOperation } from "../../src/test-utils/mock-operation";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { signInAs } from "../../src/test-utils/sign-in-as";
import type { Role } from "../../src/lib/roles";
import {
  HASH,
  history4,
  historyMissingField,
  type LessonHistory,
} from "./fixtures";
import { stubHistory } from "./stubs";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const URL4 = "/units/g6-u4/lessons/L4/history";
// The shared API globs (`**/lessons/*/history`) also match this page path; a query string keeps page navigations out of them.
const URLQ = URL4 + "?version=1";
const SHOTS = "e2e/__screenshots__/history";

test.use({ timezoneId: "UTC", locale: "en-US" });

async function open(
  page: Page,
  h: LessonHistory = history4(),
  role: Role = "approver",
  url = URL4,
) {
  await signInAs(page, role);
  await stubHistory(page, h);
  await page.goto(url);
  await expect(
    page.getByRole("heading", { level: 1, name: "History · Lesson 4" }),
  ).toBeVisible();
}
const items = (page: Page) =>
  page.getByRole("list", { name: "Versions" }).getByRole("listitem");

test("states: list, rail and selection", async ({ page }) => {
  await signInAs(page, "approver");
  await stubHistory(page, history4(), 600);
  await page.goto(URL4);
  await expect(
    page.getByRole("status", { name: "Loading history" }),
  ).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Loading history" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 1, name: "History · Lesson 4" }),
  ).toBeVisible();
  await expect(items(page)).toHaveCount(5);
  await expect(items(page).first()).toContainText("Generated");
  await expect(items(page).first()).toContainText("By worker");
  await expect(items(page).first()).toContainText("0001…0000");
  await expect(page.getByRole("heading", { name: "Provenance" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^v5 · Reopen/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^v3 · / }).click();
  await expect(page).toHaveURL(/version=3/);
  const rail = page.getByRole("complementary");
  await expect(rail).toContainText("Not applicable (made by a person)");
  await expect(rail).toContainText("$0.00");
  await expect(
    rail.getByText(/^Submitted by Reviewer A \(demo\)/),
  ).toBeVisible();
  await page.getByRole("button", { name: /^v1 · / }).click();
  await expect(
    rail.getByText(
      "Safety flag cleared by J. Rivera: Image alt text checked · 10:42",
    ),
  ).toBeVisible();
});

test("states: missing field", async ({ page }) => {
  await open(page, historyMissingField(), "approver", URL4 + "?version=3");
  await expect(
    page.getByRole("complementary").getByText("Missing"),
  ).toHaveClass(/text-danger/);
});

test("states: Prism example", async ({ page }) => {
  await signInAs(page, "approver");
  await mockOperation(page, "getLessonHistory", { example: "lesson4" });
  await page.goto(URLQ);
  await expect(
    page.getByRole("heading", { level: 1, name: "History · Lesson 4" }),
  ).toBeVisible();
  await expect(items(page)).toHaveCount(1);
  await expect(items(page).first()).toContainText("Generated");
});

test("copy: Copy hash copies the full hash and announces", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await open(page);
  await page.getByRole("button", { name: "Copy hash" }).first().click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    HASH(1),
  );
  await expect(page.getByTestId("announcer")).toHaveText("Copied");
  await expect(page.locator("ol[aria-label='Versions']")).toHaveCount(1);
  await page.goto(URL4 + "?version=2");
  await expect(page.getByRole("button", { name: /^v2 · / })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("complementary")).toContainText(
    "Candidate (not adopted)",
  );
});

test("errors: can't load and not found", async ({ page }) => {
  await signInAs(page, "approver");
  await respondWithError(page, "getLessonHistory", "SCHEMA_UNKNOWN");
  await page.goto(URLQ);
  await expect(page.getByRole("alert").filter({ hasText: /\w/ })).toContainText(
    "Couldn't load the history. Check your connection and try again.",
  );
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await signInAs(page, "approver");
  await stubHistory(page, history4());
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(items(page)).toHaveCount(5);

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await signInAs(page, "approver");
  await respondWithError(page, "getLessonHistory", "NOT_FOUND");
  await page.goto(URLQ);
  await expect(page.getByText(/There is no Lesson 4/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to the board" }),
  ).toBeVisible();

  await page.goto("/units/g6-u4/lessons/L99x/history?version=1");
  await expect(page.getByText("There is no lesson in this unit")).toBeVisible();
});

test("readonly: no edit controls, no minutes", async ({ page }) => {
  for (const role of ["author", "reviewer", "approver"] as const) {
    const methods: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/") || r.url().includes("/lessons/"))
        methods.push(r.method());
    });
    await page.unrouteAll({ behavior: "ignoreErrors" });
    await open(page, history4(), role);
    await expect(
      page.getByRole("button", {
        name: /^(edit|restore|revert|approve|submit|delete)/i,
      }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^reopen$/i })).toHaveCount(
      0,
    );
    await expect(page.getByRole("textbox")).toHaveCount(0);
    await expect(page.locator("[contenteditable]")).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toMatch(
      /\b\d+\s*(min|mins|minutes)\b/i,
    );
    expect(methods.filter((m) => m !== "GET" && m !== "OPTIONS")).toEqual([]);
    page.removeAllListeners("request");
  }
});

const STATES = ["main", "missing-field", "cant-load"] as const;

async function reach(page: Page, state: (typeof STATES)[number]) {
  await signInAs(page, "approver");
  if (state === "cant-load") {
    await respondWithError(page, "getLessonHistory", "SCHEMA_UNKNOWN");
    await page.goto(URLQ);
    await expect(
      page.getByRole("alert").filter({ hasText: /\w/ }),
    ).toBeVisible();
    return;
  }
  await stubHistory(
    page,
    state === "main" ? history4() : historyMissingField(),
  );
  await page.goto(URL4 + "?version=3");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(items(page)).toHaveCount(5);
}

for (const state of STATES) {
  for (const [w, h] of [
    [1280, 900],
    [390, 844],
  ] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`history ${state} ${w} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await reach(page, state);
        await page.evaluate(
          (t) => document.documentElement.setAttribute("data-theme", t),
          theme,
        );
        await page.evaluate(() => document.fonts.ready);
        const results = await new AxeBuilder({
          page: page as unknown as AxePage,
        })
          .withTags(TAGS)
          .analyze();
        const bad = results.violations.filter(
          (x) => x.impact === "serious" || x.impact === "critical",
        );
        console.log(
          `axe ${state} ${w}x ${theme}: ${bad.length} serious/critical`,
        );
        expect(
          bad.map(
            (x) =>
              `${x.id}: ${x.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
          ),
        ).toEqual([]);
        if (state !== "missing-field") {
          await page.screenshot({
            path: `${SHOTS}/history-${state}-${w}-${theme}.png`,
            fullPage: true,
          });
        }
      });
    }
  }
}
