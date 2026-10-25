// NL-95 AC-5: one run per Idempotency-Key; scope and trial refusals are 400 INVALID_REQUEST with details.fields and write nothing.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { authorWithConfirmedUpload, confirmAllErrors, openDialog, rowCounts, runBody, startRunApi, uniqueKey, uploadSheet } from "./helpers";

type Err = { error: { code: string; details: { fields: string[] } } };

test("idempotency-and-scope: the same key twice returns the first run and starts nothing new", async ({ page }) => {
  const { user, up } = await authorWithConfirmedUpload(page);
  const body = await runBody(page, up.outline_version_id, { kind: "rows", rows: [8, 9, 25] });
  const key = uniqueKey();
  const a = await startRunApi(page, body, key);
  const b = await startRunApi(page, body, key);
  expect([a.status(), b.status()]).toEqual([201, 201]);
  const ra = (await a.json()) as { run_id: string };
  expect(((await b.json()) as { run_id: string }).run_id).toBe(ra.run_id);
  const c = await rowCounts(user.user_id);
  expect(c.run).toBe(1);
  expect(c.lesson_job).toBe(4);
});

test("idempotency-and-scope: the key the dialog sent, repeated by API, returns the dialog's run", async ({ page }) => {
  const { user, up } = await authorWithConfirmedUpload(page);
  const dialog = await openDialog(page, up);
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/runs") && r.method() === "POST");
  await dialog.getByRole("button", { name: "Start run" }).click();
  const req = await sent;
  await page.waitForURL(`**/units/${up.unit_key}/runs/*`);
  const again = await startRunApi(page, req.postDataJSON(), req.headers()["idempotency-key"]);
  expect(again.status()).toBe(201);
  const [row] = await db().query<{ id: string }>("select id from run where started_by=$1", [user.user_id]);
  expect(((await again.json()) as { run_id: string }).run_id).toBe(row!.id);
  expect((await rowCounts(user.user_id)).run).toBe(1);
});

test("idempotency-and-scope: another version's run and a trial without lesson_id are INVALID_REQUEST", async ({ page }) => {
  const { user, up } = await authorWithConfirmedUpload(page);
  const first = (await (await startRunApi(page, await runBody(page, up.outline_version_id, { kind: "rows", rows: [8] }), uniqueKey())).json()) as { run_id: string };
  const v2 = await uploadSheet(page);
  expect(v2.outline_version_id).not.toBe(up.outline_version_id);
  await confirmAllErrors(page, v2.outline_version_id);
  const before = await rowCounts(user.user_id);

  const cross = await startRunApi(page, await runBody(page, v2.outline_version_id, { kind: "unfinished_of_run", run_id: first.run_id }), uniqueKey());
  expect(cross.status()).toBe(400);
  const ce = (await cross.json()) as Err;
  expect(ce.error.code).toBe("INVALID_REQUEST");
  expect(ce.error.details.fields).toContain("scope.run_id");
  expect(await rowCounts(user.user_id)).toEqual(before);

  const trial = await startRunApi(page, { ...(await runBody(page, up.outline_version_id, { kind: "all" })), mode: "trial" }, uniqueKey());
  expect(trial.status()).toBe(400);
  const te = (await trial.json()) as Err;
  expect(te.error.code).toBe("INVALID_REQUEST");
  expect(te.error.details.fields).toContain("lesson_id");
  expect(await rowCounts(user.user_id)).toEqual(before);
});

test("idempotency-and-scope: the suggested cap for the full unit is 13.00", async ({ page }) => {
  const { up } = await authorWithConfirmedUpload(page);
  const dialog = await openDialog(page, up);
  await dialog.getByRole("radio", { name: "All 47 teaching days" }).check();
  await expect(dialog.getByLabel(/Spend cap/)).toHaveValue("13.00");
});
