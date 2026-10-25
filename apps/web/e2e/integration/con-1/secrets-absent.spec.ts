// NL-90 AC-5 (frozen, risk::security). Guards: negative / invariant. Do not edit.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser } from "../support/users";

const CANARY = "Zx-7731-canary";
const UNKNOWN = "nobody-9f3a@example.test";

function walk(dir: string): string[] {
  let out: string[] = [];
  try {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      out = statSync(p).isDirectory() ? out.concat(walk(p)) : out.concat(p);
    }
  } catch {
    /* directory absent: nothing recorded */
  }
  return out;
}

test("secrets-absent: foreign Origin refused; canary password and raw unknown email appear nowhere [negative]", async ({ page }, testInfo) => {
  const stack = getStack();
  const user = await createUser("author", { password: CANARY });
  const bodies: string[] = [];
  page.on("response", async (r) => {
    if (r.url().includes("/api/session")) bodies.push(await r.text().catch(() => ""));
  });

  // failed attempt typing the canary (wrong password for a listed email)
  await page.goto("/sign-in");
  await page.getByLabel("Staff email").fill(user.email);
  await page.getByLabel("Password").fill(`${CANARY}-x`);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("That email and password don't match")).toBeVisible();

  // unknown-email attempt
  await page.getByLabel("Staff email").fill(UNKNOWN);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("This email is not on the staff list.", { exact: false })).toBeVisible();

  // foreign-origin POST: refused, no rows
  const sessionsBefore = await db().count("app_session");
  const auditBefore = await db().count("audit_event");
  const foreign = await page.request.post("/api/session", {
    headers: { Origin: "https://evil.example" },
    data: { email: user.email, password: CANARY },
  });
  bodies.push(await foreign.text());
  expect(foreign.status()).toBe(401);
  expect(await db().count("app_session")).toBe(sessionsBefore);
  expect(await db().count("audit_event")).toBe(auditBefore);

  // successful sign-in with the canary
  await page.getByLabel("Staff email").fill(user.email);
  await page.getByLabel("Password").fill(CANARY);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/sign-in/);

  const dump = await db().dumpAll();
  const logs = stack.logs().join("\n");
  const files = walk(testInfo.project.outputDir);
  expect(files.filter((f) => f.endsWith(".zip"))).toEqual([]);
  const fileText = files.map((f) => readFileSync(f).toString("latin1")).join("\n");

  const count = (hay: string, needle: string) => hay.split(needle).length - 1;
  for (const [where, hay] of [
    ["database", dump],
    ["logs", logs],
    ["responses", bodies.join("\n")],
    ["outputDir", fileText],
  ] as const) {
    expect(count(hay, CANARY), `canary in ${where}`).toBe(0);
  }
  expect(count(dump, UNKNOWN), "raw unknown email in database").toBe(0);
  expect(count(logs, UNKNOWN), "raw unknown email in logs").toBe(0);
});
