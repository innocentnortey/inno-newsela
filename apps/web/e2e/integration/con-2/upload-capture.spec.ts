// NL-93 AC-8 (upload half): two uploads, one hash, zero changed lessons, golden counts read back.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { createUser, signInAs } from "../support/users";
import { getStack } from "../support/real-stack";
import { ISSUED_XLSX } from "./fixtures/files";
import { PRIVATE_ID, startSheetsServer, type SheetsServer } from "./fixtures/sheets-server";
import { ensureSeeded, resetIntake } from "./support/seed-and-reset";
import { chooseAndUpload, importLink, openUpload, postImport } from "./support/upload";

let server: SheetsServer;
test.beforeAll(async () => {
  await ensureSeeded();
  server = await startSheetsServer();
});
test.afterAll(async () => server?.close());
test.beforeEach(resetIntake);

test("test_upload_capture: two uploads of the issued xlsx and a private link, one hash, zero changed lessons, golden counts read back", async ({
  page,
}) => {
  const user = await signInAs(page, await createUser("author"));
  await openUpload(page);
  await chooseAndUpload(page, ISSUED_XLSX);
  await expect(page).toHaveURL(/\/outlines\/1$/);
  await openUpload(page);
  await chooseAndUpload(page, ISSUED_XLSX);
  await expect(
    page
      .getByText("Version 2 is the same as version 1; 0 lessons changed.")
      .first(),
  ).toBeVisible();

  // Private-link step: refused, nothing stored, exactly one route.refused log line for the request.
  const before = [
    await db().count("outline_version"),
    await db().count("outline_row"),
    await db().count("audit_event", "actor_id=$1", [user.user_id]),
  ];
  await openUpload(page);
  await importLink(page, server.sheetUrl(PRIVATE_ID));
  await expect(page.getByTestId("upload-error")).toContainText("This sheet is private. Share it publicly or upload the file.");
  const refused = await postImport(page, getStack().baseURL, server.sheetUrl(PRIVATE_ID));
  expect(refused.body.error.code).toBe("SHEET_NOT_PUBLIC");
  expect([
    await db().count("outline_version"),
    await db().count("outline_row"),
    await db().count("audit_event", "actor_id=$1", [user.user_id]),
  ]).toEqual(before);
  const rid = refused.body.error.details.request_id as string;
  await expect
    .poll(() => getStack().logs().filter((l) => l.includes("route.refused") && l.includes(rid)).length, { timeout: 5000 })
    .toBe(1);

  const vs = await db().query<{ sha256: string }>(
    "select sha256 from outline_version where unit_id='G6.U4' order by number",
  );
  expect(vs).toHaveLength(2);
  expect(vs[1]?.sha256).toBe(vs[0]?.sha256);

  const report = await (
    await page.request.get("/api/outline-versions/G6.U4.ov1/report")
  ).json();
  const ev = await db().query<{ d: Record<string, number> }>(
    "select details_json as d from audit_event where actor_id=$1 and action='outline.upload' order by at, id",
    [user.user_id],
  );
  expect(ev).toHaveLength(2);
  expect(Number(ev[1]?.d.changed_lessons)).toBe(0);
  const golden = { lessons: 41, flex_days: 6, arc_headers: 7, total_rows: 1 };
  for (const [k, v] of Object.entries(golden)) {
    expect(report.counts[k], `report ${k}`).toBe(v);
    expect(Number(ev[0]?.d[k]), `audit ${k}`).toBe(v);
  }
});
