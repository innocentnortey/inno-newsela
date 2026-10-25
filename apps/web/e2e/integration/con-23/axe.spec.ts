// NL-102 AC-10: axe (WCAG 2.2 AA tags) on every SCR-20 state reached with real data, 2 viewports x 2 themes.
// The loading state has no role=status: the screen marks it aria-busy with an sr-only "Loading export" (asserted instead).
import { expect, test, type Page } from "@playwright/test";
import { axeScan, matrix, setTheme } from "../support/axe";
import { as, createExport, exportUrl } from "./helpers";
import { approverUser, ensureSeeded, freshUnit, linkLessons, seedApproved, seedDraft } from "./seed";

test.setTimeout(300_000);

async function check(page: Page, state: string): Promise<void> {
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    const r = await axeScan(page);
    console.log(`axe ${state} ${viewport.width}px ${theme}: ${r.serious} serious, ${r.critical} critical`);
    expect(r.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
  });
}

async function unitWith(n: number) {
  await ensureSeeded();
  const unit = await freshUnit();
  const approver = await approverUser();
  for (let i = 1; i <= n; i++) await seedApproved({ unit, number: i, approver_id: approver.user_id });
  return { unit, approver };
}

test("export loading @axe", async ({ page }) => {
  const { unit, approver } = await unitWith(2);
  await as(page, approver);
  await page.route("**/api/units/*/exports", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto(exportUrl(unit.unit_key));
  await expect(page.locator("[aria-busy=true]")).toBeAttached();
  await expect(page.getByText("Loading export")).toBeAttached();
  await check(page, "loading");
});

test("export empty @axe", async ({ page }) => {
  const { unit, approver } = await unitWith(0);
  await ensureSeeded();
  await seedDraft({ unit, number: 1 });
  await as(page, approver);
  await page.goto(exportUrl(unit.unit_key));
  await expect(page.getByText("No approved lessons to export yet.")).toBeVisible();
  await check(page, "empty");
});

test("export success @axe", async ({ page }) => {
  const { unit, approver } = await unitWith(2);
  await as(page, approver);
  await page.goto(exportUrl(unit.unit_key));
  await page.getByRole("button", { name: "Create export" }).click();
  await expect(page.getByText("Export v1 written")).toBeVisible();
  await check(page, "success");
});

test("export no-change @axe", async ({ page }) => {
  const { unit, approver } = await unitWith(2);
  await as(page, approver);
  expect((await createExport(page, unit.unit_key)).status()).toBe(201);
  await page.goto(exportUrl(unit.unit_key));
  await page.getByRole("button", { name: "Create export" }).click();
  await expect(page.getByText("Same lesson payloads as the last export (v1).")).toBeVisible();
  await check(page, "no-change");
});

test("export held-back @axe", async ({ page }) => {
  const { unit, approver } = await unitWith(2);
  await seedDraft({ unit, number: 5 });
  await linkLessons(unit, 2, 5);
  await as(page, approver);
  await page.goto(exportUrl(unit.unit_key));
  await expect(page.getByRole("list", { name: "Held back" })).toContainText("Lesson 2 waits on Lesson 5");
  await check(page, "held-back");
});

test("export role-forbidden @axe", async ({ page }) => {
  const { unit } = await unitWith(1);
  await as(page, "reviewer");
  await page.goto(exportUrl(unit.unit_key));
  await expect(page.getByText("Only approvers can export.").first()).toBeVisible();
  await check(page, "role-forbidden");
});

test("export cant-load @axe", async ({ page }) => {
  const { unit, approver } = await unitWith(1);
  await as(page, approver);
  await page.route("**/api/units/*/exports", (route) => route.abort());
  await page.goto(exportUrl(unit.unit_key));
  await expect(page.locator("main").getByRole("alert")).toContainText("Couldn't load export");
  await check(page, "cant-load");
});
