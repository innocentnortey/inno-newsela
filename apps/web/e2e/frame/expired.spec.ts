import { expect, test } from "@playwright/test";
import { DEMO_PASSWORD, SESSIONS } from "../../src/test-utils/fixtures";
import { respondWithError } from "../../src/test-utils/respond-with-error";
import { apiGlob, signInFlow } from "../../src/test-utils/sign-in-as";

test("expired session redirects to sign-in and returns to the page", async ({ page }) => {
  await respondWithError(page, "getSession", "UNAUTHENTICATED");
  await page.goto("/units");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Funits$/);
  await page.unroute(apiGlob("/session"));
  await signInFlow(page, "author");
  await page.getByLabel("Staff email").fill(SESSIONS.author.user.email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/units$/);
});
