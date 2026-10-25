// NL-90 AC-2 (frozen, risk::security). Guards: failure/refusal. Do not edit; the implementer builds support/** to satisfy it.
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";

const EMAIL = "nobody-9f3a@example.test";
const MESSAGE =
  "This email is not on the staff list. Check the spelling or ask your content lead to add you.";
const SALT = "e2e-salt-0000000000000000";

test("not-on-list: unknown email is refused with NOT_ON_ALLOW_LIST and writes nothing [refusal]", async ({ page }) => {
  const stack = getStack();
  const sessionsBefore = await db().count("app_session");
  const auditBefore = await db().count("audit_event");

  await page.goto("/sign-in");
  await page.getByLabel("Staff email").fill(EMAIL);
  await page.getByLabel("Password").fill("Not-A-Real-Pass-1");
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/session") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Sign in" }).click(),
  ]);

  expect(response.status()).toBe(403);
  expect((await response.json()).error.code).toBe("NOT_ON_ALLOW_LIST");

  await expect(page.getByText(MESSAGE)).toBeVisible();
  const field = page.getByLabel("Staff email");
  await expect(field).toHaveValue(EMAIL);
  await expect(field).toBeFocused();
  await expect(page).toHaveURL(/\/sign-in/);

  expect(await db().count("app_session")).toBe(sessionsBefore);
  expect(await db().count("audit_event")).toBe(auditBefore);

  const hash = createHash("sha256").update(SALT + EMAIL.toLowerCase()).digest("hex");
  await expect
    .poll(
      () =>
        stack.logs().filter((l) => {
          try {
            const j = JSON.parse(l);
            return j.event === "session.sign_in_refused" && j.extra?.email_hash === hash;
          } catch {
            return false;
          }
        }).length,
    )
    .toBe(1);
  const line = JSON.parse(
    stack.logs().find((l) => l.includes("session.sign_in_refused") && l.includes(hash))!,
  );
  expect(typeof line.request_id).toBe("string");
  expect(line.request_id.length).toBeGreaterThan(0);
  expect(stack.logs().some((l) => l.includes(EMAIL))).toBe(false);
});
