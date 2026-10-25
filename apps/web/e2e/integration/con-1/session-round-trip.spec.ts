// NL-90 AC-4: GET /api/session shape (typed against the contract), header text, sign out revokes, expiry bounces to /sign-in?next=.
import { expect, test } from "@playwright/test";
import type { components } from "../../../../../docs/contracts/generated/api-types";
import { db } from "../support/db";
import { createUser, signInAs } from "../support/users";

type Session = components["schemas"]["Session"];

test("session-round-trip: read, sign out, expire, sign in again lands on next", async ({ page }) => {
  const user = await createUser("reviewer");
  await signInAs(page, user);

  const res = await page.request.get("/api/session");
  expect(res.status()).toBe(200);
  const body: Session = await res.json();
  expect(Object.keys(body).sort()).toEqual(["expires_at", "user"]);
  expect(Object.keys(body.user).sort()).toEqual(["email", "name", "role", "synthetic", "user_id"]);
  expect(body.user).toEqual({ user_id: user.user_id, name: user.name, email: user.email, role: "reviewer", synthetic: true });

  await expect(page.getByText(user.name, { exact: true })).toBeVisible();
  await expect(page.getByText("Reviewer", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  const revoked = await db().query<{ revoked_at: string | null }>("select revoked_at from app_session where user_id = $1", [user.user_id]);
  expect(revoked).toHaveLength(1);
  expect(revoked[0]!.revoked_at).not.toBeNull();
  const after = await page.request.get("/api/session");
  expect(after.status()).toBe(401);
  expect((await after.json()).error.code).toBe("UNAUTHENTICATED");

  await signInAs(page, user);
  await db().query("update app_session set expires_at = now() - interval '1 minute' where user_id = $1", [user.user_id]);
  await page.goto("/units/g6-u4/board");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Funits%2Fg6-u4%2Fboard$/);

  await page.getByLabel("Staff email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/units\/g6-u4\/board$/);
});
