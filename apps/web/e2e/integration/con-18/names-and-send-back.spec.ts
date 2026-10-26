// NL-126 G3 (F-6, F-7): SCR-14/15 show display names, not user ids; a send-back keeps its tag and note on SCR-14 and SCR-9.
import { expect, test } from "@playwright/test";
import { lessonPath, signedInPage } from "./flow";
import { SOURCE, cast, seedFlex } from "./seed";
import { startCon18Stack, type Con18Stack } from "./stack";

let stack: Con18Stack;
test.beforeAll(async () => {
  test.setTimeout(240_000);
  stack = await startCon18Stack();
});
test.afterAll(async () => {
  await stack?.stop();
});

const NOTE = "Check the safety note before resubmitting.";

test("names: SCR-14 header, SCR-15 dialog and toast show the reviewer name; send-back keeps tag and note (F-6, F-7)", async ({ browser }) => {
  const c = await cast();
  const lesson = await seedFlex({ unit: c.unit, number: SOURCE, state: "submitted", reviewer_id: c.reviewer.user_id, last_editor_id: c.reviewer.user_id });
  const actx = await browser.newContext();
  const rctx = await browser.newContext();
  const a = await signedInPage(actx, c.approver, stack);
  const r = await signedInPage(rctx, c.reviewer, stack);
  try {
    await a.goto(`${stack.baseURL}${lessonPath(lesson, true)}`);
    await expect(a.getByRole("heading", { name: "Checklist" })).toBeVisible({ timeout: 30_000 });
    await expect(a.locator("body")).toContainText(`by ${c.reviewer.name}`);
    await expect(a.locator("body")).not.toContainText(/usr_/);

    await a.getByRole("button", { name: "Request changes" }).click();
    const dialog = a.getByRole("dialog", { name: /Request changes to Lesson 99/ });
    await expect(dialog).toContainText(c.reviewer.name);
    await expect(dialog).not.toContainText(/usr_/);
    await dialog.getByLabel("Content safety").check();
    await dialog.getByLabel("Note").fill(NOTE);
    const reply = a.waitForResponse((x) => x.url().includes("/transitions") && x.request().method() === "POST");
    await dialog.getByRole("button", { name: "Send back" }).click();
    expect((await reply).status()).toBe(200);
    await expect(a.getByText(`Sent back to ${c.reviewer.name}.`)).toBeVisible();

    await a.reload();
    await expect(a.locator("body")).toContainText(`Changes requested by ${c.approver.name} · Content safety: ${NOTE}`);

    await r.goto(`${stack.baseURL}${lessonPath(lesson)}`);
    await expect(r.getByTestId("state-banner")).toContainText(`Changes requested by ${c.approver.name}`, { timeout: 30_000 });
    await expect(r.getByTestId("state-banner")).toContainText(`Content safety: ${NOTE}`);
  } finally {
    await actx.close();
    await rctx.close();
  }
});
