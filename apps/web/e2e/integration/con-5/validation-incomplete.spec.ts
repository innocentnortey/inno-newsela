// NL-95 AC-3: an unconfirmed error blocks Generate, a forced startRun is VALIDATION_INCOMPLETE, and nothing is written.
import { expect, test } from "@playwright/test";
import { authorWithConfirmedUpload, COPY, openDialog, revertOne, rowCounts, runBody, screenUrl, startRunApi, uniqueKey } from "./helpers";

test("validation-incomplete: one unconfirmed error blocks Generate and a forced start is refused", async ({ page }) => {
  const { user, up } = await authorWithConfirmedUpload(page, 1);
  const before = await rowCounts(user.user_id);
  await page.goto(screenUrl(up));
  await expect(page.getByRole("button", { name: COPY.generate })).toHaveAttribute("aria-disabled", "true");
  const res = await startRunApi(page, await runBody(page, up.outline_version_id, { kind: "rows", rows: [8, 9, 25] }), uniqueKey());
  expect(res.status()).toBe(422);
  const body = (await res.json()) as { error: { code: string; details: { errors_unconfirmed: number } } };
  expect(body.error.code).toBe("VALIDATION_INCOMPLETE");
  expect(body.error.details.errors_unconfirmed).toBe(1);
  expect(await rowCounts(user.user_id)).toEqual(before);
});

test("validation-incomplete: the dialog shows the count when an error is reverted while it is open", async ({ page }) => {
  const { user, up } = await authorWithConfirmedUpload(page);
  const dialog = await openDialog(page, up);
  await revertOne(page, up.outline_version_id);
  const before = await rowCounts(user.user_id); // the revert itself is an audited choice; the refusal adds nothing
  await dialog.getByRole("button", { name: COPY.startRun }).click();
  await expect(dialog.getByText(COPY.incomplete(1))).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Show me the error" })).toBeVisible();
  expect(await rowCounts(user.user_id)).toEqual(before);
});
