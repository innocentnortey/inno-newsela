// NL-90 support: synthetic staff users (example.test only) and the SCR-1 sign-in flow.
import { randomBytes } from "node:crypto";
import { expect, type Page } from "@playwright/test";
import { hash_password } from "@ls/core/auth/passwords";
import { db } from "./db";

export type Role = "author" | "reviewer" | "approver";
export interface TestUser {
  user_id: string;
  email: string;
  name: string;
  role: Role;
  synthetic: boolean;
  password: string;
}

export async function createUser(
  role: Role,
  opts: { synthetic?: boolean; password?: string; email?: string } = {},
): Promise<TestUser> {
  const hex = randomBytes(6).toString("hex");
  const user: TestUser = {
    user_id: `usr_e2e_${hex}`,
    email: opts.email ?? `${role}.${hex}@example.test`,
    name: `E2E ${role} ${hex}`,
    role,
    synthetic: opts.synthetic ?? true,
    password: opts.password ?? randomBytes(12).toString("base64url"),
  };
  await db().query(
    "insert into app_user (id, email, name, role, synthetic, password_hash) values ($1,$2,$3,$4,$5,$6)",
    [user.user_id, user.email, user.name, user.role, user.synthetic, hash_password(user.password)],
  );
  return user;
}

export async function signInAs(page: Page, user: TestUser | Role): Promise<TestUser> {
  const u = typeof user === "string" ? await createUser(user) : user;
  await page.goto("/sign-in");
  await page.getByLabel("Staff email").fill(u.email);
  await page.getByLabel("Password").fill(u.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);
  return u;
}
