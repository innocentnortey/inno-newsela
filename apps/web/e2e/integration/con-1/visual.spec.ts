// NL-90 AC-10: baselines for the main and unknown-email states, 1280x900 and 390x844, light and dark (8 screenshots).
import { expect, test } from "@playwright/test";
import { matrix, setTheme } from "../support/axe";

test("sign-in main state @visual", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByLabel("Staff email")).toBeVisible();
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`sign-in-main-${viewport.width}-${theme}.png`, { fullPage: true });
  });
});

test("sign-in unknown-email state @visual", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Staff email").fill("nobody-77aa@example.test");
  await page.getByLabel("Password").fill("Not-A-Real-Pass-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("This email is not on the staff list.", { exact: false }).first()).toBeVisible();
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot(`sign-in-unknown-email-${viewport.width}-${theme}.png`, { fullPage: true });
  });
});
