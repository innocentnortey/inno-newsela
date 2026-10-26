// NL-93 AC-11: axe on every SCR-2 / SCR-3 state reached with real data, 1280x900 and 390x844, light and dark. 0 serious, 0 critical.
import { expect, test, type Page } from "@playwright/test";
import { getStack } from "../support/real-stack";
import { axeScan, matrix, setTheme } from "../support/axe";
import { createUser, signInAs } from "../support/users";
import { ISSUED_CSV, noHeaderCsv, oversizedXlsx, pdfRenamedXlsx, tooManyRowsCsv, type UploadFile } from "./fixtures/files";
import { PRIVATE_ID, STALL_ID, startSheetsServer, type SheetsServer } from "./fixtures/sheets-server";
import { ensureSeeded, resetIntake } from "./support/seed-and-reset";
import { chooseAndUpload, fromPath, importLink, openUpload, postOutline } from "./support/upload";

let server: SheetsServer;
test.beforeAll(async () => {
  await ensureSeeded();
  server = await startSheetsServer();
});
test.afterAll(async () => server?.close());
test.beforeEach(resetIntake);

async function scan(page: Page, state: string): Promise<void> {
  await matrix(page, async ({ theme, viewport }) => {
    await setTheme(page, theme);
    const r = await axeScan(page);
    console.log(`axe ${state} ${viewport.width} ${theme}: serious=${r.serious} critical=${r.critical}`);
    expect(r.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
    expect(r.serious).toBe(0);
    expect(r.critical).toBe(0);
  });
}
const author = async (page: Page) => signInAs(page, await createUser("author"));

test("axe scr2 empty first use @axe", async ({ page }) => {
  await author(page);
  await page.goto("/units");
  await expect(page.getByText("No outline uploaded yet.")).toBeVisible();
  await scan(page, "scr2-empty");
});

test("axe scr2 loading @axe", async ({ page }) => {
  await author(page);
  await page.route("**/api/units", async (r) => {
    await new Promise((ok) => setTimeout(ok, 4000));
    await r.continue();
  });
  await page.goto("/units");
  await expect(page.getByText("Loading units")).toBeAttached();
  await scan(page, "scr2-loading");
});

test("axe scr2 cant-load @axe", async ({ page }) => {
  await author(page);
  await page.route("**/api/units", (r) => r.abort());
  await page.goto("/units");
  await expect(page.getByText("Couldn't load units.")).toBeVisible();
  await scan(page, "scr2-cant-load");
});

test("axe scr2 success (version uploaded, no run yet) and reviewer role view @axe", async ({ page, browser, baseURL }) => {
  await author(page);
  expect((await postOutline(page, getStack().baseURL, fromPath(ISSUED_CSV))).status).toBe(201);
  await page.goto("/units");
  await expect(page.getByText("No run yet. Confirm the report, then generate.")).toBeVisible();
  await scan(page, "scr2-success");
  const ctx = await browser.newContext({ baseURL });
  const rp = await ctx.newPage();
  await signInAs(rp, await createUser("reviewer"));
  await rp.goto("/units");
  await expect(rp.getByText("No run yet. Confirm the report, then generate.")).toBeVisible();
  await expect(rp.getByRole("link", { name: "Upload outline" })).toHaveCount(0);
  await scan(rp, "scr2-reviewer");
  await ctx.close();
});

test("axe scr3 idle (file) and idle (link) @axe", async ({ page }) => {
  await author(page);
  await openUpload(page);
  await scan(page, "scr3-idle-file");
  await page.getByText("Sheet link", { exact: true }).click();
  await expect(page.getByLabel("Google Sheet link")).toBeVisible();
  await scan(page, "scr3-idle-link");
});

test("axe scr3 success banner (same-hash banner stays on screen) @axe", async ({ page }) => {
  await author(page);
  await openUpload(page);
  await chooseAndUpload(page, ISSUED_CSV);
  await expect(page).toHaveURL(/\/outlines\/1$/); // the first success banner navigates away after its dwell
  await openUpload(page);
  await chooseAndUpload(page, ISSUED_CSV);
  await expect(page.getByText("Version 2 is the same as version 1; 0 lessons changed.").first()).toBeVisible();
  await scan(page, "scr3-success");
});

const FILE_ERRORS: Array<[string, () => UploadFile, string]> = [
  ["type", pdfRenamedXlsx, "This file type isn't supported."],
  ["too-large", oversizedXlsx, "This file is over 5 MB."],
  ["no-header", noHeaderCsv, "Couldn't find the header row."],
  ["too-many-rows", tooManyRowsCsv, "Too many rows for one unit"],
];
for (const [name, make, text] of FILE_ERRORS) {
  test(`axe scr3 error ${name} @axe`, async ({ page }) => {
    await author(page);
    await openUpload(page);
    await chooseAndUpload(page, make());
    await expect(page.getByTestId("upload-error")).toContainText(text);
    await scan(page, `scr3-error-${name}`);
  });
}

test("axe scr3 error private link @axe", async ({ page }) => {
  await author(page);
  await openUpload(page);
  await importLink(page, server.sheetUrl(PRIVATE_ID));
  await expect(page.getByTestId("upload-error")).toContainText("This sheet is private.");
  await scan(page, "scr3-error-private-link");
});

test("axe scr3 error stalled link @axe", async ({ page }) => {
  test.setTimeout(90_000);
  await author(page);
  await openUpload(page);
  await importLink(page, server.sheetUrl(STALL_ID));
  await expect(page.getByTestId("upload-error")).toContainText("Couldn't reach Google Sheets.", { timeout: 20_000 });
  await scan(page, "scr3-error-stalled-link");
});

test("axe scr3 reviewer role view @axe", async ({ page }) => {
  await signInAs(page, await createUser("reviewer"));
  await page.goto("/units/g6-u4/outlines/new");
  await expect(page.getByText("Only authors can upload an outline")).toBeVisible();
  await scan(page, "scr3-reviewer");
});
