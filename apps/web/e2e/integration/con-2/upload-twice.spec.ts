// NL-93 AC-1: the issued xlsx twice through SCR-3 gives v1 and v2, same hash, 0 changed lessons.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { createUser, signInAs } from "../support/users";
import { ISSUED_XLSX } from "./fixtures/files";
import { ensureSeeded, resetIntake } from "./support/seed-and-reset";
import { chooseAndUpload, openUpload } from "./support/upload";

test.beforeAll(ensureSeeded);
test.beforeEach(resetIntake);

test("upload-twice: the issued xlsx twice gives v1 and v2, same hash, same_as_version 1, 0 changed lessons", async ({
  page,
}) => {
  const user = await signInAs(page, await createUser("author"));
  const lessonsBefore = await db().count("lesson");
  const lvBefore = await db().count("lesson_version");

  await openUpload(page);
  await chooseAndUpload(page, ISSUED_XLSX);
  await expect(
    page
      .getByText(
        "Grade 6 · Unit 4 · version 1 · 41 lessons · 6 flex days · 7 arc headers · 1 total row",
      )
      .first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/outlines\/1$/);

  await openUpload(page);
  await chooseAndUpload(page, ISSUED_XLSX);
  await expect(
    page
      .getByText("Version 2 is the same as version 1; 0 lessons changed.")
      .first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Open the report" }).click();
  await expect(page).toHaveURL(/\/outlines\/2$/);

  const vs = await db().query<{
    id: string;
    sha256: string;
    same_as_version: number | null;
  }>(
    "select id, sha256, same_as_version from outline_version where unit_id='G6.U4' order by number",
  );
  expect(vs).toHaveLength(2);
  const [v1, v2] = vs as [(typeof vs)[number], (typeof vs)[number]];
  expect(v1.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(v2.sha256).toBe(v1.sha256);
  expect(v1.same_as_version).toBeNull();
  expect(v2.same_as_version).toBe(1);
  const n1 = await db().count("outline_row", "outline_version_id=$1", [
    "G6.U4.ov1",
  ]);
  const n2 = await db().count("outline_row", "outline_version_id=$1", [
    "G6.U4.ov2",
  ]);
  expect(n1).toBeGreaterThan(0);
  expect(n2).toBe(n1);
  expect(
    await db().count("audit_event", "actor_id=$1 and action='outline.upload'", [
      user.user_id,
    ]),
  ).toBe(2);
  const ev = await db().query<{ c: string }>(
    "select details_json->>'changed_lessons' as c from audit_event where actor_id=$1 and action='outline.upload' order by at, id",
    [user.user_id],
  );
  expect(ev[1]?.c).toBe("0");
  expect(await db().count("lesson")).toBe(lessonsBefore);
  expect(await db().count("lesson_version")).toBe(lvBefore);

  await page.goto("/units");
  await expect(page.getByText("same as v1")).toHaveCount(1);
  const report = await page.request.get(
    "/api/outline-versions/G6.U4.ov1/report",
  );
  expect(report.status()).toBe(200);
  expect(typeof (await report.json()).generate_allowed).toBe("boolean");
});
