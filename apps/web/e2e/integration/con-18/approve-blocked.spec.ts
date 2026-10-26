// NL-126 G3 (F-5): the real BLOCKED reply carries issues without `blocks`; SCR-14 must keep the screen, the rating and the checklist.
import { expect, test } from "@playwright/test";
import { lessonPath, signedInPage } from "./flow";
import { cast, seedFlex } from "./seed";
import { startCon18Stack, type Con18Stack } from "./stack";

let stack: Con18Stack;
test.beforeAll(async () => {
  test.setTimeout(240_000);
  stack = await startCon18Stack();
});
test.afterAll(async () => {
  await stack?.stop();
});

test("approve-blocked: a 422 BLOCKED shows the danger banner, keeps the rating and the checklist (F-5)", async ({ browser }) => {
  const c = await cast();
  const lesson = await seedFlex({
    unit: c.unit, number: 99, state: "submitted", reviewer_id: c.reviewer.user_id, last_editor_id: c.reviewer.user_id,
    confirmation: true, resolved: false,
  });
  const context = await browser.newContext();
  const page = await signedInPage(context, c.approver, stack);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  try {
    await page.goto(`${stack.baseURL}${lessonPath(lesson, true)}`);
    await expect(page.getByRole("heading", { name: "Checklist" })).toBeVisible({ timeout: 30_000 });
    await page.getByLabel("Usable with edits").check();
    const reply = page.waitForResponse((x) => x.url().includes("/transitions") && x.request().method() === "POST");
    await page.getByRole("button", { name: "Approve this version" }).click();
    expect((await reply).status()).toBe(422);
    await expect(page.getByText(/Approve refused:/)).toBeVisible();
    await expect(page.getByText("This page couldn't load")).toHaveCount(0);
    await expect(page.getByLabel("Usable with edits")).toBeChecked();
    await expect(page.getByRole("heading", { name: "Checklist" })).toBeVisible();
    expect(errors.filter((m) => /TypeError/.test(m))).toEqual([]);
  } finally {
    await context.close();
  }
});
