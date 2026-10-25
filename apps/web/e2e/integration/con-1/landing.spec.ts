// NL-90 AC-1: sign in as each role through the real form; cookie flags, landing URL, one session row and one audit event.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { createUser, signInAs, type Role } from "../support/users";

const LANDING: Record<Role, RegExp> = {
  author: /\/units$/,
  reviewer: /\/units\/g6-u4\/board$/,
  approver: /\/units\/g6-u4\/board$/,
};

for (const role of ["author", "reviewer", "approver"] as const) {
  test(`landing: ${role} signs in, gets an HttpOnly Strict cookie, one session and one audit event`, async ({ page, context }) => {
    const user = await createUser(role);
    await signInAs(page, user);
    await expect(page).toHaveURL(LANDING[role]);

    const cookie = (await context.cookies()).find((c) => c.name === "ls_session");
    expect(cookie, "ls_session cookie").toBeDefined();
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe("Strict");

    expect(await db().count("app_session", "user_id = $1", [user.user_id])).toBe(1);
    expect(await db().count("audit_event", "action = 'session.sign_in' and actor_id = $1", [user.user_id])).toBe(1);
  });
}
