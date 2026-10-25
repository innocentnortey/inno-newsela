// NL-98 AC-4: the north-star tile (CON-10) from the frozen lesson_metrics rows: populated, empty, one reviewer.
import { expect, test } from "@playwright/test";
import { COPY, getJson, openBoard } from "./helpers";
import { seedEmptyTileUnit, seedMainUnit, seedOneReviewerUnit } from "./seed";

test("north-star: populated tile shows the median of 20/24/28, n = 3, fast approvals from each row's own threshold", async ({ page }) => {
  const seeded = await seedMainUnit();
  await openBoard(page, seeded.reviewers[0]!);
  const m = (await getJson(page, "/api/units/G6.U4/metrics")).body.north_star;
  expect(m).toMatchObject({ median_minutes: 24, n: 3, fast_approvals: { count: 1, of: 3 }, approved: { k: 3, total: 47 }, caption: COPY.caption, segment_label: null });
  const tile = page.locator("section, div").filter({ hasText: "Reviewer minutes per approved lesson" }).last();
  await expect(tile.getByText("24", { exact: true })).toBeVisible();
  await expect(tile.getByText("median · n = 3")).toBeVisible();
  await expect(tile.getByText("fast approvals 1 of 3")).toBeVisible(); // a single threshold of 25 would say 2 of 3
  await expect(tile.getByText("approved 3 of 47")).toBeVisible();
  await expect(tile.getByText(COPY.caption)).toBeVisible();
  console.log("populated tile: 24 min, n = 3, fast approvals 1 of 3, approved 3 of 47");
});

test("north-star: empty tile reads 'No approved lessons yet', shows no number and approved 0 of 47", async ({ page }) => {
  await seedEmptyTileUnit();
  const seeded = await seedMainUnit();
  await openBoard(page, seeded.reviewers[0]!, "g6-u6");
  const m = (await getJson(page, "/api/units/G6.U6/metrics")).body.north_star;
  expect(m).toMatchObject({ median_minutes: null, n: 0, approved: { k: 0, total: 47 }, segment_label: null });
  await expect(page.getByText(COPY.empty, { exact: true })).toBeVisible();
  await expect(page.getByText("approved 0 of 47")).toBeVisible();
  await expect(page.getByText(/median · n =/)).toHaveCount(0);
  await expect(page.getByText(/fast approvals/)).toHaveCount(0);
});

test("north-star: one reviewer reads 'one reviewer, n = 3'", async ({ page }) => {
  const solo = await seedOneReviewerUnit();
  await openBoard(page, solo, "g6-u7");
  const m = (await getJson(page, "/api/units/G6.U7/metrics")).body.north_star;
  expect(m).toMatchObject({ median_minutes: 24, n: 3, segment_label: "one reviewer, n = 3" });
  await expect(page.getByText("one reviewer, n = 3", { exact: true })).toBeVisible();
});
