// NL-115 AC-15: main and one error state of SCR-9 (submit path), SCR-14 and SCR-15 on the real stack, 1280 and 390, light and dark.
// Playwright refuses a snapshot name that climbs out of con-1/ (the config's snapshotPathTemplate, read-only here), so the PNGs
// are written with page.screenshot and judged against the D1 look sheet by a person (NEEDS_HUMAN_REVIEW in the dev log).
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { bridgeCollab } from "../con-12/bridge";
import { matrix, setTheme } from "../support/axe";
import { lessonPath, signedInPage } from "./flow";
import { SOURCE, cast, freshUnit, seedFlex } from "./seed";
import { startCon18Stack, type Con18Stack } from "./stack";

const OUT = resolve(__dirname, "../../__screenshots__/integration/con-18");
let stack: Con18Stack;
test.beforeAll(async () => {
  test.setTimeout(240_000);
  stack = await startCon18Stack();
});
test.afterAll(async () => {
  await stack?.stop();
});

async function shoot(page: Page, name: string): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    await page.evaluate(() => document.fonts.ready);
    const path = resolve(OUT, `${name}-${viewport.width}-${theme}.png`);
    await page.screenshot({ path, fullPage: true });
    expect(existsSync(path)).toBe(true);
  });
}

test("SCR-9 submit path: main and blocked states @visual", async ({ browser }) => {
  const c = await cast();
  const ready = await seedFlex({ unit: c.unit, number: SOURCE, state: "in_review", reviewer_id: c.reviewer.user_id });
  const blocked = await seedFlex({ unit: await freshUnit(), number: SOURCE, state: "in_review", reviewer_id: c.reviewer.user_id, resolved: false });
  const context = await browser.newContext();
  const page = await signedInPage(context, c.reviewer, stack);
  try {
    await bridgeCollab(page, stack.collabPort);
    await page.goto(`${stack.baseURL}${lessonPath(ready)}`);
    await expect(page.getByRole("button", { name: "Submit for approval" })).not.toHaveAttribute("aria-disabled", "true", { timeout: 30_000 });
    await shoot(page, "scr9-submit-main");
    await page.goto(`${stack.baseURL}${lessonPath(blocked)}`);
    await expect(page.getByTestId("submit-reasons")).toContainText(/blocking/i, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "Submit for approval" })).toHaveAttribute("aria-disabled", "true");
    await shoot(page, "scr9-submit-blocked");
  } finally {
    await context.close();
  }
});

test("SCR-14 and SCR-15: main and error states @visual", async ({ browser }) => {
  const c = await cast();
  const lesson = await seedFlex({ unit: c.unit, number: SOURCE, state: "submitted", reviewer_id: c.reviewer.user_id, last_editor_id: c.reviewer.user_id });
  const context = await browser.newContext();
  const page = await signedInPage(context, c.approver, stack);
  try {
    await page.goto(`${stack.baseURL}${lessonPath(lesson, true)}`);
    await expect(page.getByRole("button", { name: "Approve this version" })).toBeVisible({ timeout: 30_000 });
    await shoot(page, "scr14-main");
    await page.getByRole("button", { name: "Approve this version" }).click();
    await expect(page.getByText("Choose a rating to approve.")).toBeVisible();
    await shoot(page, "scr14-rating-required");

    await page.getByRole("button", { name: "Request changes" }).click();
    const dialog = page.getByRole("dialog", { name: /Request changes to/ });
    await expect(dialog).toBeVisible();
    await shoot(page, "scr15-main");
    await dialog.getByLabel("Standards").check();
    await dialog.getByRole("button", { name: "Send back" }).click();
    await expect(dialog.getByText("Add a note: say what needs to change.")).toBeVisible();
    await shoot(page, "scr15-note-required");
  } finally {
    await context.close();
  }
});
