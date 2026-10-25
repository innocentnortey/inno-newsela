// NL-95 AC-4: the day cap refuses before any spend; the API carries scope and remaining_usd and the dialog shows the amount.
import { expect, test } from "@playwright/test";
import { authorWithConfirmedUpload, COPY, insertSpend, releaseSpend, openDialog, rowCounts, runBody, startRunApi, uniqueKey } from "./helpers";

test.afterEach(releaseSpend);

test("day-cap: 20.00 already reserved leaves 6.00 and a 13.00 run is refused before any spend", async ({ page }) => {
  const { user, up } = await authorWithConfirmedUpload(page);
  await insertSpend(user.user_id, 20);
  const before = await rowCounts(user.user_id);
  expect(before.spend_reservation).toBe(1);
  const res = await startRunApi(page, await runBody(page, up.outline_version_id, { kind: "rows", rows: [8, 9, 25] }, 13), uniqueKey());
  expect(res.status()).toBe(422);
  const e = ((await res.json()) as { error: { code: string; details: { scope: string; remaining_usd: number } } }).error;
  expect(e.code).toBe("DAY_CAP_REACHED");
  expect(e.details.scope).toBe("user");
  expect(Number(e.details.remaining_usd)).toBeCloseTo(6, 2);
  expect(await rowCounts(user.user_id)).toEqual(before);

  const dialog = await openDialog(page, up);
  await dialog.getByRole("button", { name: COPY.startRun }).click();
  await expect(dialog.getByText(COPY.dayCap("6.00"))).toBeVisible();
  expect(await rowCounts(user.user_id)).toEqual(before);
});
