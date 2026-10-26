// NL-93 AC-3 (checkpoint 2): private link, stalled sheet and never-fetched links are refused, nothing stored, no stack trace.
import { expect, test, type Page } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs, type TestUser } from "../support/users";
import { PRIVATE_ID, PUBLIC_ID, STALL_ID, startSheetsServer, type SheetsServer } from "./fixtures/sheets-server";
import { ensureSeeded, resetIntake } from "./support/seed-and-reset";
import { importLink, openUpload, postImport } from "./support/upload";

let server: SheetsServer;
test.beforeAll(async () => {
  await ensureSeeded();
  server = await startSheetsServer();
});
test.afterAll(async () => server?.close());
test.beforeEach(async () => {
  await resetIntake();
  server.resetHits();
});

async function counts(user: TestUser) {
  return [
    await db().count("outline_version"),
    await db().count("outline_row"),
    await db().count("audit_event", "actor_id=$1", [user.user_id]),
  ];
}
async function noTrace(page: Page) {
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/\bat \S+:\d+/);
  expect(text).not.toMatch(/\/home\//);
}
async function refusedLogged(request_id: string) {
  await expect
    .poll(() => getStack().logs().filter((l) => l.includes("route.refused") && l.includes(request_id)).length, { timeout: 5000 })
    .toBe(1);
}

test("link-refusals: private link", async ({ page }) => {
  const user = await signInAs(page, await createUser("author"));
  const before = await counts(user);
  await openUpload(page);
  await importLink(page, server.sheetUrl(PRIVATE_ID));
  await expect(page.getByTestId("upload-error")).toContainText(/share it publicly or upload the file/i);
  await noTrace(page);
  const api = await postImport(page, getStack().baseURL, server.sheetUrl(PRIVATE_ID));
  expect(api.status).toBe(422);
  expect(api.body.error.code).toBe("SHEET_NOT_PUBLIC");
  expect(api.body.error.details.request_id).toBeTruthy();
  expect(await counts(user)).toEqual(before);
  await refusedLogged(api.body.error.details.request_id);
});

test("link-refusals: stalled sheet", async ({ page }) => {
  test.setTimeout(90_000);
  const user = await signInAs(page, await createUser("author"));
  const before = await counts(user);
  await openUpload(page);
  const t0 = Date.now();
  await importLink(page, server.sheetUrl(STALL_ID));
  await expect(page.getByTestId("upload-error")).toContainText("Couldn't reach Google Sheets. Try again, or upload the file.", { timeout: 20_000 });
  const took = Date.now() - t0;
  expect(took).toBeGreaterThanOrEqual(9000);
  expect(took).toBeLessThanOrEqual(20_000);
  await noTrace(page);
  const api = await postImport(page, getStack().baseURL, server.sheetUrl(STALL_ID));
  expect(api.status).toBe(502);
  expect(api.body.error.code).toBe("SHEET_UNREACHABLE");
  expect(api.body.error.details.request_id).toBeTruthy();
  expect(await counts(user)).toEqual(before);
  await refusedLogged(api.body.error.details.request_id);
  expect(server.hits(STALL_ID)).toBe(2);
});

test("link-refusals: links the server must never fetch", async ({ page }) => {
  const user = await signInAs(page, await createUser("author"));
  const before = await counts(user);
  for (const bad of [
    `https://docs.google.com.evil.example/spreadsheets/d/${PUBLIC_ID}`,
    "http://127.0.0.1:1/x",
    "file:///etc/passwd",
  ]) {
    const api = await postImport(page, getStack().baseURL, bad);
    expect(api.status, bad).toBe(400);
    expect(api.body.error.code, bad).toBe("INVALID_REQUEST");
  }
  expect(await counts(user)).toEqual(before);
  for (const id of [PUBLIC_ID, PRIVATE_ID, STALL_ID]) expect(server.hits(id)).toBe(0);
});
