// NL-93 helpers: drive SCR-3 and the upload API; read stored rows.
import { readFileSync } from "node:fs";
import { basename, extname } from "node:path";
import { expect, type Page } from "@playwright/test";
import { db } from "../../support/db";
import { XLSX_MIME, type UploadFile } from "../fixtures/files";

export const SCR3 = "/units/g6-u4/outlines/new";

export function fromPath(path: string): UploadFile {
  const mimeType = extname(path) === ".xlsx" ? XLSX_MIME : "text/csv";
  return { name: basename(path), mimeType, buffer: readFileSync(path) };
}

export async function openUpload(page: Page): Promise<void> {
  await page.goto(SCR3);
  await expect(
    page.getByRole("heading", { name: "Upload outline" }),
  ).toBeVisible();
}

export async function chooseAndUpload(
  page: Page,
  file: string | UploadFile,
): Promise<void> {
  await page
    .locator("input[type=file]")
    .setInputFiles(typeof file === "string" ? file : file);
  await page.getByRole("button", { name: "Upload" }).click();
}

export async function postOutline(
  page: Page,
  baseURL: string,
  file: UploadFile,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- response bodies are asserted field by field in specs
): Promise<{ status: number; body: any }> {
  const res = await page.request.post("/api/outline-versions", {
    multipart: { file },
    headers: { Origin: baseURL },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status(), body };
}

export async function rowsFor(
  versionId: string,
): Promise<
  Array<{
    row_number: number;
    kind: string;
    lesson_id: string | null;
    row_hash: string;
  }>
> {
  return db().query(
    "select row_number, kind, lesson_id, row_hash from outline_row where outline_version_id=$1 order by row_number",
    [versionId],
  );
}

/** Switch SCR-3 to the link source, fill the sheet link, press Import. */
export async function importLink(page: Page, sheetUrl: string): Promise<void> {
  await page.getByText("Sheet link", { exact: true }).click();
  await page.getByLabel("Google Sheet link").fill(sheetUrl);
  await page.getByRole("button", { name: "Import" }).click();
}

export async function postImport(
  page: Page,
  baseURL: string,
  sheet_url: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- response bodies are asserted field by field in specs
): Promise<{ status: number; body: any }> {
  const res = await page.request.post("/api/outline-versions/import", {
    data: { sheet_url },
    headers: { Origin: baseURL },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- see above
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status(), body };
}
