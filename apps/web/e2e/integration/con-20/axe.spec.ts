// NL-99 AC-9: axe (WCAG 2.2 AA tags) on SCR-9 and SCR-14 states reached with real data, 2 viewports x 2 themes.
import { expect, test, type Page } from "@playwright/test";
import { axeScan, matrix, setTheme } from "../support/axe";
import { createUser, signInAs } from "../support/users";
import { approveViaApi, submittedLesson } from "./flow";
import { ensureSeeded, freshUnit, seedLesson } from "./seed";
import { lessonUrl } from "./tabs";
import { DISCLOSURE_TEXT } from "./text";

async function check(page: Page, state: string): Promise<void> {
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    const r = await axeScan(page);
    console.log(`axe ${state} ${viewport.width}x ${theme}: ${r.serious} serious, ${r.critical} critical`);
    expect(r.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
  });
}

test("axe SCR-9 editable with the notice @axe", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  const user = await createUser("reviewer", { synthetic: false });
  const lesson = await seedLesson({ unit, number: 1, state: "in_review", reviewer_id: user.user_id });
  await signInAs(page, user);
  await page.goto(lessonUrl(lesson.unit_key, lesson.lesson_key));
  await expect(page.getByText(DISCLOSURE_TEXT)).toBeVisible({ timeout: 30_000 });
  await check(page, "SCR-9 editable");
});

test("axe SCR-14 loading @axe", async ({ page }) => {
  const s = await submittedLesson();
  await signInAs(page, s.approver);
  await page.route(`**/api/lessons/${s.lesson.lesson_id}`, async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await new Promise((r) => setTimeout(r, 4000));
    return route.fallback();
  });
  await page.goto(lessonUrl(s.lesson.unit_key, s.lesson.lesson_key, true));
  await expect(page.getByRole("status", { name: "Loading the approval review" })).toBeVisible({ timeout: 3500 });
  await check(page, "SCR-14 loading");
});

test("axe SCR-14 rating required @axe", async ({ page }) => {
  const s = await submittedLesson();
  await signInAs(page, s.approver);
  await page.goto(lessonUrl(s.lesson.unit_key, s.lesson.lesson_key, true));
  await page.getByRole("button", { name: "Approve this version" }).click();
  await expect(page.getByText("Choose a rating to approve.")).toBeVisible();
  await check(page, "SCR-14 rating-required");
});

test("axe SCR-14 role-forbidden (author) @axe", async ({ page }) => {
  const s = await submittedLesson();
  const author = await createUser("author", { synthetic: false });
  await signInAs(page, author);
  await page.goto(lessonUrl(s.lesson.unit_key, s.lesson.lesson_key, true));
  await expect(page.getByText("Only approvers can approve").first()).toBeVisible({ timeout: 30_000 });
  await check(page, "SCR-14 role-forbidden");
});

test("axe SCR-14 approved success @axe", async ({ page }) => {
  const s = await submittedLesson();
  await signInAs(page, s.approver);
  const res = await approveViaApi(page, s);
  expect(res.status(), await res.text()).toBe(200);
  await page.goto(lessonUrl(s.lesson.unit_key, s.lesson.lesson_key, true));
  await expect(page.getByText(/Approved by/).first()).toBeVisible({ timeout: 30_000 });
  await check(page, "SCR-14 approved");
});
