// NL-93 AC-7 (no-run half): before any run SCR-2 says No run yet; reads change nothing. The Running/Complete half is checkpoint 3 (needs the worker).
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs } from "../support/users";
import { ISSUED_XLSX } from "./fixtures/files";
import { ensureSeeded, resetIntake } from "./support/seed-and-reset";
import { fromPath, postOutline } from "./support/upload";

test.beforeAll(ensureSeeded);
test.beforeEach(resetIntake);

test("latest-run: before any run the version row reads No run yet; five reads change nothing", async ({
  page,
}) => {
  const user = await signInAs(page, await createUser("author"));
  const up = await postOutline(page, getStack().baseURL, fromPath(ISSUED_XLSX));
  expect(up.status).toBe(201);

  const urls: string[] = [];
  page.on("request", (r) => urls.push(new URL(r.url()).pathname));
  await page.goto("/units");
  await expect(
    page.getByText("No run yet. Confirm the report, then generate."),
  ).toBeVisible();
  await expect(page.getByText(/\b(Running|Complete)\b/)).toHaveCount(0);
  // The page reads the list once; since GEN-5 the nav frame reads it once more to point "Unit board" at the latest unit. No polling beyond that.
  expect(urls.filter((u) => u === "/api/units").length).toBeLessThanOrEqual(2);
  expect(urls.filter((u) => u.includes("/progress"))).toHaveLength(0);

  const audits = await db().count("audit_event", "actor_id=$1", [user.user_id]);
  const lv = await db().count("lesson_version");
  for (let i = 0; i < 5; i++)
    expect((await page.request.get("/api/units")).status()).toBe(200);
  await page.reload();
  await expect(
    page.getByText("No run yet. Confirm the report, then generate."),
  ).toBeVisible();
  expect(await db().count("audit_event", "actor_id=$1", [user.user_id])).toBe(
    audits,
  );
  expect(
    await db().count("audit_event", "actor_id=$1 and action='outline.upload'", [
      user.user_id,
    ]),
  ).toBe(1);
  expect(await db().count("lesson_version")).toBe(lv);
});
