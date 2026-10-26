// NL-104 AC-2: rating counts and seeded-error table, populated and empty.
import { expect, test } from "@playwright/test";
import { signInAs } from "../support/users";
import { COPY, getJson, METRICS_PATH, openQuality } from "./helpers";
import { expectedQuality } from "./oracle";
import { cleanupGlobal, seedAll, UNITS } from "./seed";

test.describe.configure({ mode: "serial" });
let ids: Awaited<ReturnType<typeof seedAll>>;
test.beforeAll(async () => { ids = await seedAll(); });
test.afterAll(async () => { await cleanupGlobal(ids); });

test("ratings-seeded-errors-empty: populated unit shows counts, planted and caught, and the label", async ({ page }) => {
  const rev = ids.reviewers[0]!;
  await openQuality(page, rev, UNITS.main.unit_key);
  const ratings = page.getByRole("table", { name: COPY.ratings });
  await expect(ratings.getByRole("row", { name: /Usable as drafted/ })).toContainText("2");
  await expect(ratings.getByRole("row", { name: /Usable with edits/ })).toContainText("2");
  await expect(ratings.getByRole("row", { name: /Rewritten/ })).toContainText("1");
  await expect(page.locator("section", { has: ratings }).getByText("n = 5", { exact: true })).toBeVisible();
  const seeded = page.getByRole("table", { name: COPY.seeded });
  await expect(seeded.getByRole("row", { name: new RegExp(COPY.label) })).toContainText("5");
  await expect(seeded.getByRole("row", { name: new RegExp(COPY.label) })).toContainText("4"); // the newer S10 run wins over 2 of 5
  const q = (await getJson(page, METRICS_PATH(UNITS.main.unit_id))).body.quality;
  const o = await expectedQuality(UNITS.main.unit_id);
  expect(q.rating_counts).toEqual({ usable_as_drafted: 2, usable_with_edits: 2, rewritten: 1, n: 5 });
  expect(q.rating_counts).toEqual(o.rating_counts);
  expect(q.seeded_errors).toEqual({ planted: 5, caught: 4, label: COPY.label });
  expect(q.seeded_errors).toEqual(o.seeded_errors);
});

test("ratings-seeded-errors-empty: a unit with no approved lesson reads the empty line and shows no figure", async ({ page }) => {
  await signInAs(page, ids.reviewers[0]!);
  const res = await getJson(page, METRICS_PATH(UNITS.empty.unit_id));
  expect(res.body.north_star.n).toBe(0);
  expect(res.body.quality.rating_counts).toEqual({ usable_as_drafted: 0, usable_with_edits: 0, rewritten: 0, n: 0 });
  await openQuality(page, ids.reviewers[0]!, UNITS.empty.unit_key);
  await expect(page.getByText(COPY.empty)).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(page.locator("main li")).toHaveCount(0);
});
