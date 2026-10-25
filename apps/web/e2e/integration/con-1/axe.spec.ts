// NL-90 AC-9: axe (WCAG 2.2 AA tags) on four SCR-1 states x two viewports x two themes against the real backend.
import { expect, test, type Page } from "@playwright/test";
import { axeScan, matrix, setTheme } from "../support/axe";
import { createUser, signInAs } from "../support/users";

async function check(page: Page, state: string): Promise<void> {
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    const r = await axeScan(page);
    console.log(`axe ${state} ${viewport.width}x ${theme}: ${r.serious} serious, ${r.critical} critical`);
    expect(r.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
  });
}

test("axe loading state @axe", async ({ page }) => {
  // Allowed delay for this state only: hold the first session read so the loading frame is on screen.
  await page.route("**/api/session", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await new Promise((r) => setTimeout(r, 600));
    return route.fallback();
  });
  await page.goto("/sign-in");
  await check(page, "loading");
});

test("axe wrong-password state @axe", async ({ page }) => {
  const user = await createUser("author");
  await page.goto("/sign-in");
  await page.getByLabel("Staff email").fill(user.email);
  await page.getByLabel("Password").fill(`${user.password}-wrong`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password don't match.").first()).toBeVisible();
  await check(page, "wrong-password");
});

test("axe unknown-email state @axe", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Staff email").fill("nobody-77aa@example.test");
  await page.getByLabel("Password").fill("Not-A-Real-Pass-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("This email is not on the staff list.", { exact: false }).first()).toBeVisible();
  await check(page, "unknown-email");
});

test("axe signed-in landing @axe", async ({ page }) => {
  await signInAs(page, "author");
  await expect(page).toHaveURL(/\/units$/);
  await check(page, "landing");
});
