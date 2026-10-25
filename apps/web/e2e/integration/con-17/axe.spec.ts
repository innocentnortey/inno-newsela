// NL-116 AC-11: axe (WCAG 2.2 AA tags) on the SCR-13 states reachable on the real backend, 2 viewports x 2 themes.
import { expect, test, type Page } from "@playwright/test";
import { axeScan, matrix, setTheme } from "../support/axe";
import { NEW_TEXT, askForSuggestion, closeSeedPool, openLesson, panel, seedLesson, selectPassage, openAssist, setStub, startRealCollab, type Proc } from "./helpers";

let collab: Proc;
test.beforeAll(async () => {
  collab = await startRealCollab();
});
test.afterAll(async () => {
  await collab?.stop();
  await closeSeedPool();
});

async function check(page: Page, state: string): Promise<void> {
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    const r = await axeScan(page);
    console.log(`axe ${state} ${viewport.width}x ${theme}: ${r.serious} serious, ${r.critical} critical`);
    expect(r.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
  });
}

test("SCR-13 main (panel idle with a selection) @axe", async ({ browser }) => {
  const lesson = await seedLesson("in_review");
  const { page, context } = await openLesson(browser, lesson);
  await selectPassage(page);
  await openAssist(page);
  await expect(panel(page)).toBeVisible();
  await check(page, "scr13-main");
  await context.close();
});

test("SCR-13 suggestion (pending card) @axe", async ({ browser }) => {
  setStub({ kind: "text", text: NEW_TEXT });
  const lesson = await seedLesson("in_review");
  const { page, context } = await openLesson(browser, lesson);
  expect((await askForSuggestion(page)).status()).toBe(201);
  await expect(panel(page)).toContainText(NEW_TEXT);
  await check(page, "scr13-suggestion");
  await context.close();
});

test("SCR-13 error-model-unavailable @axe", async ({ browser }) => {
  setStub({ kind: "error", code: "timeout", error_kind: "timeout" } as never);
  const lesson = await seedLesson("in_review");
  const { page, context } = await openLesson(browser, lesson);
  expect((await askForSuggestion(page)).status()).toBe(503);
  await expect(page.getByTestId("assist-error")).toBeVisible();
  await check(page, "scr13-error-model-unavailable");
  await context.close();
});
