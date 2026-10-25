// NL-95 AC-10: axe (WCAG 2.2 AA tags) on SCR-5 states reached with real data, 2 viewports x 2 themes each.
// Not reachable with real data (covered by NL-58's mock spec apps/web/e2e/start-run/start-run.spec.ts): role-forbidden banner
// (an author session cannot be made a non-author without breaking the sign-in), network error.
import { expect, test, type Page } from "@playwright/test";
import { axeScan, matrix, setTheme } from "../support/axe";
import { createUser, signInAs } from "../support/users";
import { authorWithConfirmedUpload, authorWithUpload, COPY, insertSpend, releaseSpend, openDialog, revertOne, screenUrl } from "./helpers";

test.setTimeout(180_000);

async function check(page: Page, state: string): Promise<void> {
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    const r = await axeScan(page);
    console.log(`axe ${state} ${viewport.width}x ${theme}: ${r.serious} serious, ${r.critical} critical`);
    expect(r.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
  });
}

test.afterEach(releaseSpend);

test("axe loading state @axe", async ({ page }) => {
  const { up } = await authorWithConfirmedUpload(page);
  await page.route("**/api/prompt-versions", async (route) => {
    await new Promise((r) => setTimeout(r, 2500));
    await route.continue();
  });
  await page.goto(screenUrl(up));
  await page.getByRole("button", { name: COPY.generate }).click();
  const dialog = page.getByRole("dialog", { name: COPY.dialogTitle });
  await expect(dialog.getByRole("button", { name: COPY.startRun })).toBeDisabled();
  await expect(dialog.getByText(COPY.promptLoading)).toBeAttached();
  await expect(dialog.getByTestId("prompt-skeleton")).toBeAttached();
  await check(page, "loading");
});

test("axe main state @axe", async ({ page }) => {
  const { up } = await authorWithConfirmedUpload(page);
  await openDialog(page, up);
  await check(page, "main");
});

test("axe rows-invalid state @axe", async ({ page }) => {
  const { up } = await authorWithConfirmedUpload(page);
  const dialog = await openDialog(page, up);
  await dialog.getByRole("textbox", { name: "Rows" }).fill("99");
  await dialog.getByRole("button", { name: COPY.startRun }).click();
  await expect(dialog.getByRole("textbox", { name: "Rows" })).toHaveAttribute("aria-invalid", "true");
  await check(page, "rows-invalid");
});

test("axe cap-invalid state @axe", async ({ page }) => {
  const { up } = await authorWithConfirmedUpload(page);
  const dialog = await openDialog(page, up);
  await dialog.getByLabel(/Spend cap/).fill("0");
  await dialog.getByRole("button", { name: COPY.startRun }).click();
  await expect(dialog.getByText("Set a cap above $0")).toBeVisible();
  await check(page, "cap-invalid");
});

test("axe validation-incomplete state @axe", async ({ page }) => {
  const { up } = await authorWithConfirmedUpload(page);
  const dialog = await openDialog(page, up);
  await revertOne(page, up.outline_version_id);
  await dialog.getByRole("button", { name: COPY.startRun }).click();
  await expect(dialog.getByText(COPY.incomplete(1))).toBeVisible();
  await check(page, "validation-incomplete");
});

test("axe day-cap state @axe", async ({ page }) => {
  const { user, up } = await authorWithConfirmedUpload(page);
  await insertSpend(user.user_id, 20);
  const dialog = await openDialog(page, up);
  await dialog.getByRole("button", { name: COPY.startRun }).click();
  await expect(dialog.getByText(COPY.dayCap("6.00"))).toBeVisible();
  await check(page, "day-cap");
});

test("axe prompt-failed state @axe", async ({ page }) => {
  const { up } = await authorWithConfirmedUpload(page);
  await page.route("**/api/prompt-versions", (route) => route.abort());
  await page.goto(screenUrl(up));
  await page.getByRole("button", { name: COPY.generate }).click();
  const dialog = page.getByRole("dialog", { name: COPY.dialogTitle });
  await expect(dialog.getByText("Couldn't load the prompt version.")).toBeVisible();
  await check(page, "prompt-failed");
});

test("axe reviewer-view state @axe", async ({ page }) => {
  const { up } = await authorWithUpload(page);
  await page.context().clearCookies();
  await signInAs(page, await createUser("reviewer"));
  await page.goto(screenUrl(up));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /Generate/ })).toHaveCount(0);
  await check(page, "reviewer-view");
});
