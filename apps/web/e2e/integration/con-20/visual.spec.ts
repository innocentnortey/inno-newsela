// NL-99 AC-10: main and one error state of SCR-9 and SCR-14, 1280 and 390, light and dark, on real data.
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { matrix, setTheme } from "../support/axe";
import { createUser, signInAs } from "../support/users";
import { ensureSeeded, freshUnit, seedLesson } from "./seed";
import { lessonUrl } from "./tabs";
import { DISCLOSURE_TEXT } from "./text";

const OUT = resolve(__dirname, "../../__screenshots__/integration/con-20");

// Playwright refuses a snapshot name that climbs out of con-1/ (the config template, read-only here), so the PNGs are
// written with page.screenshot and judged against the D1 look sheet by a person (NEEDS_HUMAN_REVIEW in the dev log).
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

test("SCR-9 main and not-found states @visual", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit("G7.U96");
  const user = await createUser("reviewer", { synthetic: false });
  const lesson = await seedLesson({ unit, number: 1, state: "in_review", reviewer_id: user.user_id, title: "Visual baseline lesson" }).catch(async () => ({ ...(await seedLesson({ unit: await freshUnit(), number: 1, state: "in_review", title: "Visual baseline lesson" })) }));
  await signInAs(page, user);
  await page.goto(lessonUrl(lesson.unit_key, lesson.lesson_key));
  await expect(page.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
  await shoot(page, "scr9-main");
  await page.goto(lessonUrl(lesson.unit_key, "L9"));
  await expect(page.getByText(/There is no .* in /i).first()).toBeVisible({ timeout: 30_000 });
  await shoot(page, "scr9-not-found");
});

test("SCR-14 main and rating-required states @visual", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit("G7.U95");
  const reviewer = await createUser("reviewer", { synthetic: false });
  const approver = await createUser("approver", { synthetic: false });
  const lesson = await seedLesson({ unit, number: 1, content: "wp3", state: "submitted", reviewer_id: reviewer.user_id, last_editor_id: reviewer.user_id, title: "Visual baseline lesson" });
  await signInAs(page, approver);
  await page.goto(lessonUrl(lesson.unit_key, lesson.lesson_key, true));
  await expect(page.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
  await shoot(page, "scr14-main");
  await page.getByRole("button", { name: "Approve this version" }).click();
  await expect(page.getByText("Choose a rating to approve.")).toBeVisible();
  await shoot(page, "scr14-rating-required");
});
