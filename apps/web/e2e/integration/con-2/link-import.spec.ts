// NL-93 AC-2 (checkpoint 2): a public sheet link is fetched once per import, stored with the link's bytes hashed.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { createUser, signInAs } from "../support/users";
import { ISSUED_XLSX } from "./fixtures/files";
import { PUBLIC_ID, startSheetsServer, type SheetsServer } from "./fixtures/sheets-server";
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

test("link-import: a public sheet link is fetched once, stored as a new version with the link's bytes hashed; importing it again fetches again once and reports the same hash", async ({
  page,
}) => {
  const user = await signInAs(page, await createUser("author"));
  const sheet_url = server.sheetUrl(PUBLIC_ID);
  await openUpload(page);
  await importLink(page, sheet_url);
  await expect(
    page.getByText("Grade 6 · Unit 4 · version 1 · 41 lessons · 6 flex days · 7 arc headers · 1 total row").first(),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/outlines\/1$/);

  expect(server.hits(PUBLIC_ID)).toBe(1);
  const vs = await db().query<{ source_kind: string; source_name: string; sha256: string; same_as_version: number | null }>(
    "select source_kind, source_name, sha256, same_as_version from outline_version where unit_id='G6.U4' order by number",
  );
  expect(vs).toHaveLength(1);
  expect(vs[0]?.source_kind).toBe("sheet_link");
  expect(vs[0]?.source_name).toBe(`${server.url}/spreadsheets/d/${PUBLIC_ID}`);
  expect(vs[0]?.sha256).toBe(createHash("sha256").update(readFileSync(ISSUED_XLSX)).digest("hex"));
  expect(await db().count("audit_event", "actor_id=$1 and action='outline.import'", [user.user_id])).toBe(1);
  const lessons = await db().count("lesson");
  const lv = await db().count("lesson_version");

  // Read as: exactly one fetch per import (the bytes must be fetched to be hashed), never two.
  await openUpload(page);
  await importLink(page, sheet_url);
  await expect(page.getByText("Version 2 is the same as version 1; 0 lessons changed.").first()).toBeVisible();
  expect(server.hits(PUBLIC_ID)).toBe(2);
  const vs2 = await db().query<{ sha256: string; same_as_version: number | null }>(
    "select sha256, same_as_version from outline_version where unit_id='G6.U4' order by number",
  );
  expect(vs2).toHaveLength(2);
  expect(vs2[1]?.sha256).toBe(vs2[0]?.sha256);
  expect(vs2[1]?.same_as_version).toBe(1);
  expect(await db().count("lesson")).toBe(lessons);
  expect(await db().count("lesson_version")).toBe(lv);

  const api = await postImport(page, getStack().baseURL, sheet_url);
  expect(api.status).toBe(201);
  expect(server.hits(PUBLIC_ID)).toBe(3);
});
