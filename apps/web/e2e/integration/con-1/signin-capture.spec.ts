// NL-90 AC-6: the WF-1 capture verification (docs/design/observability.md, WF-1 row), run against NL-82's seed.
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";

const UNKNOWN = "nobody-c41e@example.test"; // own address: the stack log is shared across specs, so each refusal-counting spec uses its own
const SALT = "e2e-salt-0000000000000000";

test("test_signin_capture: seeded roles leave a session and an audit event; an unknown email leaves only a hashed log line", async ({ browser }) => {
  const stack = getStack();
  const seeded = await stack.seed();

  await test.step("signs in as each seeded role", async () => {
    for (const role of ["author", "reviewer", "approver"] as const) {
      const context = await browser.newContext({ baseURL: stack.baseURL });
      const page = await context.newPage();
      await page.goto("/sign-in");
      await page.getByLabel("Staff email").fill(seeded.emails[role]);
      await page.getByLabel("Password").fill(seeded.password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).not.toHaveURL(/\/sign-in/);

      await test.step(`asserts the session row and the successful sign-in's audit event (${role})`, async () => {
        const [u] = await db().query<{ id: string }>("select id from app_user where lower(email) = $1", [seeded.emails[role]]);
        expect(u, `seeded ${role}`).toBeDefined();
        expect(await db().count("app_session", "user_id = $1", [u!.id])).toBe(1);
        expect(await db().count("audit_event", "action = 'session.sign_in' and actor_id = $1", [u!.id])).toBe(1);
      });
      await context.close();
    }
  });

  const sessions = await db().count("app_session");
  const audits = await db().count("audit_event");
  const context = await browser.newContext({ baseURL: stack.baseURL });
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Staff email").fill(UNKNOWN);
  await page.getByLabel("Password").fill("Not-A-Real-Pass-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("This email is not on the staff list.", { exact: false })).toBeVisible();

  await test.step("the unknown-email refusal wrote no app_session or audit_event row", async () => {
    expect(await db().count("app_session")).toBe(sessions);
    expect(await db().count("audit_event")).toBe(audits);
  });

  await test.step("and left one application-log line with the email hashed", async () => {
    const hash = createHash("sha256").update(SALT + UNKNOWN).digest("hex");
    await expect
      .poll(() => stack.logs().filter((l) => l.includes("session.sign_in_refused") && l.includes(hash)).length)
      .toBe(1);
  });

  await test.step("and no raw unknown email in any row or log line", async () => {
    expect(await db().dumpAll()).not.toContain(UNKNOWN);
    expect(stack.logs().join("\n")).not.toContain(UNKNOWN);
  });
  await context.close();
});
