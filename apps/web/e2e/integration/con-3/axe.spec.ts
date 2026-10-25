// NL-94 AC-11: axe (WCAG 2.2 AA tags) on SCR-4 states reached with real data, 2 viewports x 2 themes each.
// `empty` and `can't-load` have no honest real-data route (a version always has rows; killing the API would break the shared
// stack), so NL-57's mock specs cover them.
import { expect, test, type Page } from "@playwright/test";
import { axeScan, matrix, setTheme } from "../support/axe";
import { createUser, signInAs } from "../support/users";
import { authorWithUpload, confirmAll, COPY, confirmRowErrorsViaUi, markupCsv, screenUrl, uploadFixture } from "./helpers";

test.setTimeout(180_000);

async function check(page: Page, state: string): Promise<void> {
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    const r = await axeScan(page);
    console.log(`axe ${state} ${viewport.width}x ${theme}: ${r.serious} serious, ${r.critical} critical`);
    expect(r.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
  });
}

test("axe loading state @axe", async ({ page }) => {
  const { up } = await authorWithUpload(page);
  await page.route("**/api/outline-versions/*/report", async (route) => {
    await new Promise((r) => setTimeout(r, 1500));
    await route.continue();
  });
  await page.goto(screenUrl(up));
  await expect(page.getByRole("status", { name: "Loading the validation report" })).toBeVisible();
  await check(page, "loading");
});

test("axe main state @axe", async ({ page }) => {
  const { up } = await authorWithUpload(page);
  await page.goto(screenUrl(up));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await check(page, "main");
});

test("axe partial state @axe", async ({ page }) => {
  const { up } = await authorWithUpload(page);
  await page.goto(screenUrl(up));
  await confirmRowErrorsViaUi(page, up.outline_version_id, 2);
  await check(page, "partial");
});

test("axe success state @axe", async ({ page }) => {
  const { up } = await authorWithUpload(page);
  await confirmAll(page, up);
  await expect(page.getByText(COPY.allConfirmed)).toBeVisible();
  await check(page, "success");
});

test("axe editing-invalid state @axe", async ({ page }) => {
  const { up } = await authorWithUpload(page);
  await page.goto(screenUrl(up));
  await page.getByRole("button", { name: "Edit fix for row 39" }).click();
  await page.getByLabel("Corrected code for row 39").fill("ZZ.9.9");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("That is not a known standard code.").first()).toBeVisible();
  await check(page, "editing-invalid");
});

test("axe markup state @axe", async ({ page }) => {
  const { up } = await authorWithUpload(page, "syn1-injection-row09.csv", markupCsv());
  await page.goto(screenUrl(up));
  await expect(page.getByText("Instruction-shaped text, kept as content").first()).toBeVisible();
  await check(page, "markup");
});

test("axe viewer state @axe", async ({ page, browser }) => {
  const { up } = await authorWithUpload(page);
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await signInAs(p2, await createUser("reviewer"));
  await p2.goto(screenUrl(up));
  await expect(p2.getByText(/You're viewing as a reviewer/)).toBeVisible();
  await check(p2, "viewer");
  await ctx.close();
});

test("axe older state @axe", async ({ page }) => {
  const { up } = await authorWithUpload(page);
  const newer = await uploadFixture(page, "issued.xlsx");
  expect(newer.version_number).toBeGreaterThan(up.version_number);
  await page.goto(screenUrl(up));
  await expect(page.getByRole("link", { name: `Open version ${newer.version_number}` })).toBeVisible();
  await check(page, "older");
});
