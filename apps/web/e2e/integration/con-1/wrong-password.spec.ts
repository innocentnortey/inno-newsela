// NL-90 AC-3 (frozen, risk::security). Guards: failure/refusal. Do not edit.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { createUser } from "../support/users";

test("wrong-password: listed email, bad password waits >= 900 ms, INVALID_CREDENTIALS, nothing written [refusal]", async ({ page }) => {
  const user = await createUser("author");
  const sessionsBefore = await db().count("app_session");
  const auditBefore = await db().count("audit_event");

  await page.goto("/sign-in");
  await page.getByLabel("Staff email").fill(user.email);
  await page.getByLabel("Password").fill(`${user.password}-wrong`);

  const started = Date.now();
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/session") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);
  await expect(page.getByText("That email and password don't match")).toBeVisible();
  const waited = Date.now() - started;

  expect(waited).toBeGreaterThanOrEqual(900);
  expect(response.status()).toBe(401);
  expect((await response.json()).error.code).toBe("INVALID_CREDENTIALS");

  await expect(page).toHaveURL(/\/sign-in/);
  await expect(page.getByLabel("Staff email")).toHaveValue(user.email);
  expect(await db().count("app_session")).toBe(sessionsBefore);
  expect(await db().count("audit_event")).toBe(auditBefore);
});
