import { expect, test } from "@playwright/test";
import { SESSIONS } from "../../src/test-utils/fixtures";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { apiGlob, signInAs } from "../../src/test-utils/sign-in-as";

for (const role of ["author", "reviewer", "approver"] as const) {
  test(`nav ${role}`, async ({ page }) => {
    await signInAs(page, role);
    await page.goto("/units");
    const nav = page.getByRole("navigation").first();
    await expect(page.getByRole("link", { name: "Units" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Unit board" })).toBeVisible();
    const guidance = page.getByRole("link", { name: "Prompt guidance" });
    if (role === "author") await expect(guidance).toBeVisible();
    else await expect(guidance).toHaveCount(0);
    await expect(nav).toBeVisible();
    await expect(page.getByText(SESSIONS[role].user.name)).toBeVisible();
    await expect(page.getByText(role[0]!.toUpperCase() + role.slice(1), { exact: true })).toBeVisible();
  });
}

test("nav skip link focuses the main region, and sign out returns to sign-in", async ({ page }) => {
  await signInAs(page, "reviewer");
  await page.goto("/units");
  await expect(page.getByRole("heading", { name: "Units" })).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: /skip/i })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  await page.route(apiGlob("/session"), async (route) => {
    const m = route.request().method();
    if (m === "DELETE") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*" } });
    return route.fallback();
  });
  await page.getByRole("button", { name: "Sign out" }).click();
  // after sign out the session is gone
  await page.unroute(apiGlob("/session"));
  await respondWithError(page, "getSession", "UNAUTHENTICATED");
  await expect(page).toHaveURL(/\/sign-in$/);
});
