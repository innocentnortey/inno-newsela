// NL-93 AC-4: bad files are refused through the form and the API, with no rows written and no stack trace.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs, type TestUser } from "../support/users";
import {
  noHeaderCsv,
  oversizedXlsx,
  pdfRenamedXlsx,
  tooManyRowsCsv,
  type UploadFile,
} from "./fixtures/files";
import { ensureSeeded, resetIntake } from "./support/seed-and-reset";
import { chooseAndUpload, openUpload, postOutline } from "./support/upload";

test.beforeAll(ensureSeeded);
test.beforeEach(resetIntake);

async function counts(user: TestUser) {
  return [
    await db().count("outline_version"),
    await db().count("outline_row"),
    await db().count("audit_event", "actor_id=$1", [user.user_id]),
  ];
}

async function refuse(
  page: import("@playwright/test").Page,
  file: UploadFile,
  uiText: string | RegExp,
) {
  const user = await signInAs(page, await createUser("author"));
  const before = await counts(user);
  await openUpload(page);
  await chooseAndUpload(page, file);
  const box = page.getByTestId("upload-error");
  await expect(box).toContainText(uiText);
  expect(await page.locator("body").innerText()).not.toMatch(/\bat \S+:\d+/);
  const api = await postOutline(page, getStack().baseURL, file);
  expect(await counts(user)).toEqual(before);
  expect(getStack().logs().join("\n")).not.toMatch(/\s+at\s+\S+\s+\(/);
  return api;
}

test("bad-files: a pdf renamed .xlsx is refused as the wrong type", async ({
  page,
}) => {
  const api = await refuse(
    page,
    pdfRenamedXlsx(),
    "This file type isn't supported. Upload a CSV or XLSX file.",
  );
  expect(api.body.error.code).toBe("UNSUPPORTED_FILE");
  expect(api.body.error.details.reason).toBe("type");
});

test("bad-files: a file over 5 MB is refused as too large", async ({
  page,
}) => {
  const api = await refuse(
    page,
    oversizedXlsx(),
    "This file is over 5 MB. Upload a smaller CSV or XLSX file.",
  );
  expect(api.body.error.code).toBe("UNSUPPORTED_FILE");
  expect(api.body.error.details.reason).toBe("too_large");
});

test("bad-files: a sheet with no header row is refused with the columns we looked for", async ({
  page,
}) => {
  const api = await refuse(
    page,
    noHeaderCsv(),
    "Couldn't find the header row. We looked for these columns:",
  );
  expect(api.body.error.code).toBe("HEADER_NOT_FOUND");
  expect(api.body.error.details.columns_looked_for.length).toBeGreaterThan(0);
});

test("bad-files: 201 rows is refused as too many", async ({ page }) => {
  const api = await refuse(
    page,
    tooManyRowsCsv(),
    /Too many rows for one unit: this sheet has \d+ rows; the limit is 200\./,
  );
  expect(api.body.error.code).toBe("TOO_MANY_ROWS");
  expect(api.body.error.details.max_rows).toBe(200);
  const shown = await page.getByTestId("upload-error").innerText();
  expect(shown).toContain(`this sheet has ${api.body.error.details.rows} rows`);
});
