import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mockOperation } from "../../src/test-utils/mock-operation";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { signInAs } from "../../src/test-utils/sign-in-as";
import { routeBoard } from "../board/board-fixtures";
import {
  created,
  EXPORT_URL,
  lessonsList,
  serveExports,
  version,
} from "./fixtures";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
// Playwright loads specs as CommonJS, so __dirname is the folder of this file.
const shotDir = () => path.join(__dirname, "..", "__screenshots__", "export");
const h1 = (page: Page) =>
  page.getByRole("heading", { level: 1, name: "Export (no live integration)" });
const versions = (page: Page) =>
  page.getByRole("table", { name: "Export versions" });

test("states: lists approved snapshots, held back, create and earlier versions", async ({
  page,
}) => {
  await signInAs(page, "approver");
  await mockOperation(page, "listExports", { example: "lesson4HeldBack" });
  await page.goto(EXPORT_URL);
  await expect(h1(page)).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Approved snapshots" }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("listitem")
      .filter({ hasText: "Lesson 4 waits on Lesson 5" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create export" }),
  ).toBeVisible();

  // The same screen with an earlier version in the list.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await signInAs(page, "approver");
  await serveExports(page, { list: lessonsList({ exports: [version(1)] }) });
  await page.goto(EXPORT_URL);
  await expect(versions(page)).toBeVisible();
  await expect(
    versions(page).getByRole("row", { name: /Export v1/ }),
  ).toContainText("20/10/2026");
  await expect(
    versions(page).getByRole("button", { name: /Download/ }),
  ).toBeVisible();
  const body = await page.locator("main").innerText();
  expect(body).not.toMatch(/sync|publish/i);
  expect(body).not.toContain("user-approver");
});

test("states: ?export= marks that version", async ({ page }) => {
  await signInAs(page, "approver");
  await serveExports(page, {
    list: lessonsList({ exports: [version(1), version(2)] }),
  });
  await page.goto("/units/g6-u4/export?export=exp-0001");
  await expect(
    versions(page).getByRole("row", { name: /Export v1/ }),
  ).toHaveAttribute("aria-current", "true");
  await expect(
    versions(page).getByRole("row", { name: /Export v2/ }),
  ).not.toHaveAttribute("aria-current", "true");
  // newest first
  await expect(versions(page).getByRole("row").nth(1)).toContainText(
    "Export v2",
  );
  await page.goto("/units/g6-u4/export?export=nope");
  await expect(versions(page)).toBeVisible();
  await expect(versions(page).locator("[aria-current='true']")).toHaveCount(0);
});

test("states: download saves the file", async ({ page }) => {
  await signInAs(page, "approver");
  await serveExports(page, { list: lessonsList({ exports: [version(1)] }) });
  await page.goto(EXPORT_URL);
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    versions(page)
      .getByRole("button", { name: /Download/ })
      .click(),
  ]);
  expect(download.suggestedFilename()).toBe("lesson-export-v1.json");
});

test("create: writes v2 and shows the count", async ({ page }) => {
  await signInAs(page, "approver");
  const served = await serveExports(page, {
    list: lessonsList({ exports: [version(1)] }),
    create: created(2),
  });
  await page.goto(EXPORT_URL);
  await page.getByRole("button", { name: "Create export" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Export v2 written · 3 lessons" }),
  ).toBeVisible();
  expect(served.posts).toBe(1);
  await expect(
    versions(page).getByRole("row", { name: /Export v2/ }),
  ).toBeVisible();
});

test("unchanged: same payloads, no new row", async ({ page }) => {
  await signInAs(page, "approver");
  const served = await serveExports(page, {
    list: lessonsList({ exports: [version(1)] }),
    create: created(1, { same_as_previous: true }),
  });
  await page.goto(EXPORT_URL);
  const rows = versions(page).getByRole("row");
  await expect(rows).toHaveCount(2);
  await page.getByRole("button", { name: "Create export" }).click();
  await expect(
    page.getByText("Same lesson payloads as the last export (v1)."),
  ).toBeVisible();
  expect(served.posts).toBe(1);
  await expect(rows).toHaveCount(2);
});

test("empty: no approved lessons", async ({ page }) => {
  await signInAs(page, "approver");
  await serveExports(page, {
    list: { included: [], held_back: [], exports: [] },
  });
  await page.goto(EXPORT_URL);
  await expect(
    page.getByText("No approved lessons to export yet."),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Approved snapshots" }),
  ).toHaveCount(0);
});

test("errors: can't load shows Retry", async ({ page }) => {
  await signInAs(page, "approver");
  await respondWithError(page, "listExports", "SERVICE_BUSY");
  await page.goto(EXPORT_URL);
  await expect(page.getByText(/Couldn't load export/)).toBeVisible();
  const retry = page.getByRole("button", { name: "Retry" });
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await signInAs(page, "approver");
  await serveExports(page, { list: lessonsList() });
  await retry.click();
  await expect(h1(page)).toBeVisible();
});

test("errors: create failed says nothing was written", async ({ page }) => {
  await signInAs(page, "approver");
  await serveExports(page, { list: lessonsList(), abortCreate: true });
  await page.goto(EXPORT_URL);
  await page.getByRole("button", { name: "Create export" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Nothing was written. Try again." }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Approved snapshots" }),
  ).toBeVisible();

  await page.unrouteAll({ behavior: "ignoreErrors" });
  await signInAs(page, "approver");
  await serveExports(page, { list: lessonsList() });
  await respondWithError(page, "createExport", "SERVICE_BUSY");
  await page.reload();
  await page.getByRole("button", { name: "Create export" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Nothing was written. Try again." }),
  ).toBeVisible();
  await expect(
    page.getByRole("table", { name: "Approved snapshots" }),
  ).toBeVisible();
});

test("errors: unknown unit shows not found", async ({ page }) => {
  await signInAs(page, "approver");
  await respondWithError(page, "listExports", "NOT_FOUND");
  await page.goto(EXPORT_URL);
  await expect(page.getByText(/There is no unit in/)).toBeVisible();
});

test("roles: reviewer and author see the note and no Create export", async ({
  browser,
}) => {
  for (const role of ["reviewer", "author"] as const) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signInAs(page, role);
    await serveExports(page, { list: lessonsList({ exports: [version(1)] }) });
    await page.goto(EXPORT_URL);
    await expect(page.getByText("Only approvers can export.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create export" }),
    ).toHaveCount(0);
    await context.close();
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await signInAs(page, "reviewer");
  await respondWithError(page, "listExports", "ROLE_FORBIDDEN");
  await page.goto(EXPORT_URL);
  await expect(page.getByText("Only approvers can export.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Create export" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("table")).toHaveCount(0);
  await context.close();
});

test("held-back: a held back lesson never appears in the snapshots table", async ({
  page,
}) => {
  await signInAs(page, "approver");
  await serveExports(page, { list: lessonsList() });
  await page.goto(EXPORT_URL);
  const table = page.getByRole("table", { name: "Approved snapshots" });
  await expect(table.getByText("Lesson 31", { exact: true })).toBeVisible();
  await expect(table.getByText("Lesson 4", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("list", { name: "Held back" })).toContainText(
    "Lesson 4 waits on Lesson 5",
  );
});

test("cut-flag: reachable while cut 5 stands", async ({ page }) => {
  await signInAs(page, "approver");
  await routeBoard(page);
  await serveExports(page, { list: lessonsList() });
  await page.goto("/units/g6-u4/board");
  await page
    .getByRole("navigation", { name: "Related pages" })
    .getByRole("link", { name: "Export" })
    .click();
  await expect(h1(page)).toBeVisible();
});

type State = "main" | "empty" | "cantload" | "reviewer";

async function arrange(page: Page, state: State) {
  await signInAs(page, state === "reviewer" ? "reviewer" : "approver");
  if (state === "cantload")
    await respondWithError(page, "listExports", "SERVICE_BUSY");
  else if (state === "empty")
    await serveExports(page, {
      list: { included: [], held_back: [], exports: [] },
    });
  else
    await serveExports(page, { list: lessonsList({ exports: [version(1)] }) });
  await page.goto(EXPORT_URL);
  if (state === "cantload")
    await expect(page.getByText(/Couldn't load export/)).toBeVisible();
  else await expect(h1(page)).toBeVisible();
  if (state === "empty")
    await expect(
      page.getByText("No approved lessons to export yet."),
    ).toBeVisible();
}

for (const state of ["main", "empty", "cantload", "reviewer"] as const) {
  for (const [w, h] of [
    [1280, 900],
    [390, 844],
  ] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`export ${state} ${w} ${theme} @axe`, async ({ page }) => {
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
            path: path.join(shotDir(), `export-${state}-${w}-${theme}.png`),
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
