// NL-98 AC-2: a state filter narrows the rows, never the roll-up; counts follow the lesson's checked hash, not its stored hash.
import { expect, test } from "@playwright/test";
import { getJson, openBoard, boardRows, rollupCells } from "./helpers";
import { addIssues, hashOf, seedMainUnit, seedUnit, setLessonHash, user, type SeedLesson } from "./seed";

test("filter-and-stored-counts: ?state=in_review returns only that state; the roll-up still counts the whole unit", async ({ page }) => {
  const seeded = await seedMainUnit();
  await openBoard(page, seeded.reviewers[0]!);
  const all = await getJson(page, "/api/units/G6.U4/board");
  const f = await getJson(page, "/api/units/G6.U4/board?state=in_review");
  expect(f.status).toBe(200);
  expect(f.body.rows.length).toBe(seeded.expectedRollup.in_review);
  expect((f.body.rows as { state: string }[]).every((r) => r.state === "in_review")).toBe(true);
  expect(f.body.rollup).toEqual(all.body.rollup);

  const before = await rollupCells(page);
  await page.getByRole("radiogroup", { name: "Filter lessons by state" }).getByText("In review", { exact: true }).click();
  await expect.poll(async () => (await boardRows(page)).length).toBe(seeded.expectedRollup.in_review);
  expect(await rollupCells(page)).toEqual(before);
  console.log(`filter in_review: ${seeded.expectedRollup.in_review} rows, roll-up cells unchanged`);
});

test("filter-and-stored-counts: a new stored hash without a new check run leaves the counts at the old hash", async ({ page }) => {
  const rev = await user("reviewer", "rev1");
  const plan: SeedLesson[] = [
    { number: 1, state: "in_review", blocking: 2, confirmation: 1, advisory: 3, reviewer: rev.user_id },
    { number: 2, state: "draft", blocking: 0, confirmation: 0, advisory: 0 },
  ];
  await seedUnit("G6.U11", plan, { outline: true });
  await openBoard(page, rev, "g6-u11");
  const row = async () => (await getJson(page, "/api/units/G6.U11/board")).body.rows.find((r: { lesson_id: string }) => r.lesson_id === "G6.U11.L1");
  const old = await row();
  expect([old.blocking_count, old.confirmation_count, old.advisory_count]).toEqual([2, 1, 3]);

  const newHash = hashOf("G6.U11.L1 edited");
  await setLessonHash("G6.U11.L1", newHash); // a new lesson_version only: no issue row, no check_job
  const same = await row();
  expect([same.blocking_count, same.confirmation_count, same.advisory_count]).toEqual([2, 1, 3]);

  await addIssues("G6.U11.L1", newHash, { blocking: 1, confirmation: 0, advisory: 4 }); // the check ran on the new hash
  const now = await row();
  expect([now.blocking_count, now.confirmation_count, now.advisory_count]).toEqual([1, 0, 4]);
  console.log("counts: old hash 2/1/3 -> unchanged after hash change -> 1/0/4 after check rows for the new hash");
});
