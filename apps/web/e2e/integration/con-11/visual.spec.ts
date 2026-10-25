// NL-100 AC-11: eight screenshots of real data (SCR-9 / SCR-16, main and error, 1280 light and 390 dark). The real config's snapshot
// template is con-1's, so these are written with page.screenshot({ path }) and compared by eye (devlog), not diffed.
import { expect, test, type Page } from "@playwright/test";
import { setTheme } from "../support/axe";
import { signInAs } from "../support/users";
import { scr16, scr9, waitForLesson } from "./helpers";
import { seed } from "./seed";

const DIR = "e2e/__screenshots__/integration/con-11";
const SHOTS = [
  { vp: { width: 1280, height: 900 }, label: "1280", theme: "light" as const },
  { vp: { width: 390, height: 844 }, label: "390", theme: "dark" as const },
];

async function shoot(page: Page, name: string): Promise<void> {
  for (const s of SHOTS) {
    await page.setViewportSize(s.vp);
    await setTheme(page, s.theme);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path: `${DIR}/${name}-${s.label}-${s.theme}.png`,
      fullPage: true,
    });
  }
}

test("SCR-9 main WP-1 @visual", async ({ page }) => {
  const s = await seed();
  await signInAs(page, "author");
  await page.goto(scr9(s.lessons.wp1));
  await waitForLesson(page);
  await expect(page.getByTestId("text-card")).toBeVisible();
  await shoot(page, "scr9-main");
});

test("SCR-9 error unknown schema @visual", async ({ page }) => {
  const s = await seed();
  await signInAs(page, "author");
  await page.goto(scr9(s.lessons.schema99));
  await expect(
    page.getByRole("alert").filter({ hasText: "won't open" }),
  ).toBeVisible();
  await shoot(page, "scr9-error");
});

test("SCR-16 main versions @visual", async ({ page }) => {
  const s = await seed();
  await signInAs(page, "reviewer");
  await page.goto(scr16(s.lessons.reopened));
  await expect(page.getByRole("list", { name: "Versions" })).toBeVisible();
  await shoot(page, "scr16-main");
});

test("SCR-16 error not found @visual", async ({ page }) => {
  await seed();
  await signInAs(page, "reviewer");
  await page.goto(scr16("G6.U4.L40"));
  await expect(
    page.getByText("There is no Lesson 40 in Grade 6 · Unit 4"),
  ).toBeVisible();
  await shoot(page, "scr16-error");
});
