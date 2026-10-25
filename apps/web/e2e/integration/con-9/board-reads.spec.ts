// NL-98 AC-1: the board is read from stored rows; the screen shows what the route returns, in the CON-9 order.
import { expect, test } from "@playwright/test";
import { boardRows, getJson, openBoard, rollupCells } from "./helpers";
import { expectedOrder, rollupOf, seedMainUnit, seedUnit, MAIN_PLAN, user, type SeedLesson } from "./seed";

test("test_board_reads_stored_rows: WP-1 three-lesson hand count (draft, in review, approved)", async ({ page }) => {
  const reviewer = await user("reviewer", "rev1");
  const plan: SeedLesson[] = [
    { number: 1, state: "draft", blocking: 1, confirmation: 0, advisory: 0 },
    { number: 2, state: "in_review", blocking: 0, confirmation: 0, advisory: 1, reviewer: reviewer.user_id },
    { number: 3, state: "approved", blocking: 0, confirmation: 0, advisory: 0, reviewer: reviewer.user_id },
  ];
  await seedUnit("G6.U5", plan, { outline: true });
  await openBoard(page, reviewer, "g6-u5");
  const r = await getJson(page, "/api/units/G6.U5/board");
  expect(r.status).toBe(200);
  expect(r.body.rollup.draft).toBe(1);
  expect(r.body.rollup.in_review).toBe(1);
  expect(r.body.rollup.approved).toBe(1);
  expect(Object.values(r.body.rollup as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(3);
  const cells = await rollupCells(page);
  expect([cells["draft"], cells["in_review"], cells["approved"]]).toEqual([1, 1, 1]);
  console.log("WP-1 hand count: draft 1, in review 1, approved 1, sum 3");
});

test("test_board_reads_stored_rows: 47 lessons, roll-up sums to 47, order equals an independent sort, screen equals route", async ({ page }) => {
  const seeded = await seedMainUnit();
  expect(MAIN_PLAN).toHaveLength(47);
  // The seed exercises every tie-break level (checked here so the order assertion means something).
  const order = expectedOrder(MAIN_PLAN);
  const byId = new Map(MAIN_PLAN.map((l) => [`G6.U4.L${l.number}`, l]));
  const active = order.map((id) => byId.get(id)!).filter((l) => ["draft", "in_review", "submitted", "changes_requested", "reopened"].includes(l.state));
  const pairs = active.slice(1).map((b, i) => [active[i]!, b] as const);
  expect(pairs.some(([a, b]) => a.blocking === b.blocking && a.advisory !== b.advisory), "tie at blocking, split by advisory").toBe(true);
  expect(pairs.some(([a, b]) => a.blocking === b.blocking && a.advisory === b.advisory && a.confirmation !== b.confirmation), "tie at blocking+advisory, split by confirmation").toBe(true);
  expect(pairs.some(([a, b]) => a.blocking === b.blocking && a.advisory === b.advisory && a.confirmation === b.confirmation), "fully equal, split by lesson number").toBe(true);

  await openBoard(page, seeded.reviewers[0]!);
  const r = await getJson(page, "/api/units/G6.U4/board");
  expect(r.status).toBe(200);
  const rollup = r.body.rollup as Record<string, number>;
  const sum = Object.values(rollup).reduce((a, b) => a + b, 0);
  console.log(`roll-up sum = ${sum}`, JSON.stringify(rollup));
  expect(sum).toBe(47);
  expect(rollup).toEqual(seeded.expectedRollup);
  expect(rollup).toEqual(rollupOf(MAIN_PLAN));
  const ids = (r.body.rows as { lesson_id: string }[]).map((x) => x.lesson_id);
  expect(ids).toEqual(seeded.expectedOrder);

  const titles = await boardRows(page);
  await expect.poll(async () => (await boardRows(page)).length).toBe(47);
  const rowByTitle = new Map((r.body.rows as { title: string }[]).map((x, i) => [x.title, i]));
  expect(titles.map((t) => rowByTitle.get(t))).toEqual(titles.map((_, i) => i)); // screen order === route order, no re-sort
  const cells = await rollupCells(page);
  for (const s of ["draft", "in_review", "submitted", "approved", "generation_failed"]) expect(cells[s], `roll-up cell ${s}`).toBe(rollup[s]);
});
