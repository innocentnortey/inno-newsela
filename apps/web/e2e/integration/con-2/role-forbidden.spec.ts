// NL-93 AC-6: reviewer and approver see no upload controls and a direct upload is refused.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs, type Role } from "../support/users";
import { ISSUED_CSV } from "./fixtures/files";
import { ensureSeeded, resetIntake } from "./support/seed-and-reset";
import { fromPath, postOutline, SCR3 } from "./support/upload";

test.beforeAll(ensureSeeded);
test.beforeEach(resetIntake);

test("role-forbidden: reviewer and approver see no upload controls and a direct upload is refused", async ({
  page,
}) => {
  await signInAs(page, await createUser("author"));
  await page.goto("/units");
  await expect(
    page.getByRole("link", { name: "Upload outline" }).first(),
  ).toBeVisible();
  await page.context().clearCookies();

  for (const role of ["reviewer", "approver"] as Role[]) {
    const user = await signInAs(page, await createUser(role));
    await page.goto("/units");
    await expect(page.getByRole("heading", { name: "Units" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Upload outline" }),
    ).toHaveCount(0);
    await page.goto(SCR3);
    await expect(
      page.getByText("Only authors can upload an outline"),
    ).toBeVisible();
    await expect(page.locator("input[type=file]")).toHaveCount(0);
    await expect(page.getByLabel("Google Sheet link")).toHaveCount(0);
    await expect(page.getByText("Sheet link")).toHaveCount(0);

    const v = await db().count("outline_version");
    const r = await db().count("outline_row");
    const a = await db().count(
      "audit_event",
      "actor_id=$1 and action='outline.upload'",
      [user.user_id],
    );
    const res = await postOutline(
      page,
      getStack().baseURL,
      fromPath(ISSUED_CSV),
    );
    expect(res.body.error.code).toBe("ROLE_FORBIDDEN");
    expect(await db().count("outline_version")).toBe(v);
    expect(await db().count("outline_row")).toBe(r);
    expect(
      await db().count(
        "audit_event",
        "actor_id=$1 and action='outline.upload'",
        [user.user_id],
      ),
    ).toBe(a);
    await page.context().clearCookies();
  }
});
