// NL-94 AC-3: an unknown standard code is refused with INVALID_CHOICE; nothing is written; Undo restores the default.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { authorWithUpload, getReport, screenUrl } from "./helpers";

test("invalid-choice-and-undo: ZZ.9.9 is refused, the editor stays open, Undo restores default", async ({ page }) => {
  const { up } = await authorWithUpload(page);
  const vid = up.outline_version_id;
  await page.goto(screenUrl(up));
  const choices0 = await db().count("intake_choice");
  const audit0 = await db().count("audit_event");
  const before = JSON.stringify((await getReport(page, vid)).rows.find((r) => r.row_number === 39)!.findings);

  await page.getByRole("button", { name: "Edit fix for row 39" }).click();
  await page.getByLabel("Corrected code for row 39").fill("ZZ.9.9");
  const wait = page.waitForResponse((r) => r.url().endsWith("/choices") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const res = await wait;
  expect(res.status()).toBe(422);
  const body = await res.json();
  expect(body.error.code).toBe("INVALID_CHOICE");
  expect(body.error.details.reason).toBe("unknown_standard_code");
  await expect(page.getByLabel("Corrected code for row 39")).toBeVisible();
  await expect(page.getByText(body.error.message).first()).toBeVisible();
  expect(await db().count("intake_choice")).toBe(choices0);
  expect(await db().count("audit_event")).toBe(audit0);
  expect(JSON.stringify((await getReport(page, vid)).rows.find((r) => r.row_number === 39)!.findings)).toBe(before);

  await page.getByRole("button", { name: "Cancel" }).click();
  const target = (await getReport(page, vid)).rows.find((r) => r.row_number === 39)!.findings.find((f) => f.level === "error")!.finding_id;
  const w2 = page.waitForResponse((r) => r.url().endsWith("/choices") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Confirm fix for row 39" }).click();
  expect((await w2).status()).toBe(200);
  expect((await db().query<{ status: string }>("select status from intake_choice where outline_version_id=$1 and finding_id=$2", [vid, target]))[0]!.status).toBe("confirmed");

  const w3 = page.waitForResponse((r) => r.url().endsWith("/choices") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Undo confirmation for row 39" }).click();
  expect((await w3).status()).toBe(200);
  const f = (await getReport(page, vid)).rows.find((r) => r.row_number === 39)!.findings.find((x) => x.finding_id === target)!;
  expect(f.choice.source).toBe("default");
  expect((await db().query<{ status: string }>("select status from intake_choice where outline_version_id=$1 and finding_id=$2", [vid, target]))[0]!.status).toBe("default");
});
