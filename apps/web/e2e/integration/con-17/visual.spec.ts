// NL-116 AC-12: screenshots of SCR-13 main and one error state, 1280 and 390, light and dark, from the real backend.
// Compared by eye against the D1 look sheet (devlog records PASS / NEEDS_HUMAN_REVIEW); not diffed.
import { expect, test, type Page } from "@playwright/test";
import { setTheme } from "../support/axe";
import { NEW_TEXT, closeSeedPool, openLesson, panel, seedLesson, askForSuggestion, setStub, startRealCollab, type Proc } from "./helpers";

const DIR = "e2e/__screenshots__/integration";
const SIZES = [
  { vp: { width: 1280, height: 900 }, label: "1280" },
  { vp: { width: 390, height: 844 }, label: "390" },
];

let collab: Proc;
test.beforeAll(async () => {
  collab = await startRealCollab();
});
test.afterAll(async () => {
  await collab?.stop();
  await closeSeedPool();
});

async function shoot(page: Page, state: string): Promise<void> {
  for (const s of SIZES) {
    for (const theme of ["light", "dark"] as const) {
      await page.setViewportSize(s.vp);
      await setTheme(page, theme);
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: `${DIR}/con-17-${state}-${s.label}-${theme}.png`, fullPage: true });
    }
  }
}

test("SCR-13 main @visual", async ({ browser }) => {
  setStub({ kind: "text", text: NEW_TEXT });
  const { page, context } = await openLesson(browser, await seedLesson("in_review"));
  expect((await askForSuggestion(page)).status()).toBe(201);
  await expect(panel(page)).toContainText(NEW_TEXT);
  await shoot(page, "main");
  await context.close();
});

test("SCR-13 error-model-unavailable @visual", async ({ browser }) => {
  setStub({ kind: "error", code: "timeout", error_kind: "timeout" } as never);
  const { page, context } = await openLesson(browser, await seedLesson("in_review"));
  expect((await askForSuggestion(page)).status()).toBe(503);
  await expect(page.getByTestId("assist-error")).toBeVisible();
  await shoot(page, "error-model-unavailable");
  await context.close();
});
