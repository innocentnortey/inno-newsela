// NL-98 AC-3: dependency flags, send-backs and the reviewer, read from stored rows; a read changes no lesson state.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { COPY, getJson, openBoard } from "./helpers";
import { linkLessons, seedMainUnit, seedUnit, user, type SeedLesson } from "./seed";

const states = () => db().query<{ id: string; state: string }>("select id, state from lesson where unit_id='G6.U4' order by id");

test("flags: slot_empty, waiting_for_source_approval, source_reopened and the send-back row on the main unit; no state changes by reading", async ({ page }) => {
  const seeded = await seedMainUnit();
  const before = await states();
  await openBoard(page, seeded.reviewers[0]!);
  const row = (n: number) => page.locator("tbody tr").filter({ has: page.getByRole("link", { name: `Synthetic lesson ${n}`, exact: true }) });
  await expect(row(4).getByText(COPY.waitsExcerpt(5), { exact: true })).toBeVisible();
  await expect(row(6).getByText(COPY.waitsApproval(7), { exact: true })).toBeVisible();
  await expect(row(8).getByText(COPY.reopened, { exact: true })).toBeVisible();

  const body = (await getJson(page, "/api/units/G6.U4/board")).body;
  const by = (n: number) => body.rows.find((r: { lesson_id: string }) => r.lesson_id === `G6.U4.L${n}`);
  expect(by(4).dependency_flags.map((f: { status: string | null; kind: string }) => [f.kind, f.status])).toEqual([["waits_on", "slot_empty"]]);
  expect(by(6).dependency_flags.map((f: { status: string | null; kind: string }) => [f.kind, f.status])).toEqual([["waits_on", "waiting_for_source_approval"]]);
  expect(by(8).dependency_flags.map((f: { status: string | null; kind: string }) => [f.kind, f.status])).toEqual([["waits_on", "waiting_for_source_approval"], ["source_reopened", null]]);

  const withSb = body.rows.filter((r: { send_back: unknown }) => r.send_back);
  expect(withSb).toHaveLength(2);
  for (const r of withSb) {
    const tr = page.locator("tbody tr").filter({ has: page.getByRole("link", { name: r.title, exact: true }) });
    await expect(tr.getByText(`Changes requested by ${seeded.sendBackBy.name}`, { exact: true })).toBeVisible();
    await expect(tr.getByText(r.send_back.tag === "standards" ? "Standards" : "ELD support", { exact: true })).toBeVisible();
  }
  // The reviewer cell shows the reviewer stored on the lesson (the one who started the review).
  const inReview = body.rows.find((r: { state: string }) => r.state === "in_review");
  const names = new Map(seeded.reviewers.map((u) => [u.name, true]));
  expect(names.has(inReview.reviewer)).toBe(true);
  const tr = page.locator("tbody tr").filter({ has: page.getByRole("link", { name: inReview.title, exact: true }) });
  await expect(tr.getByText(inReview.reviewer, { exact: true })).toBeVisible();

  expect(await states()).toEqual(before);
  console.log(`lesson.state rows unchanged by the read: ${before.length} lessons`);
});

test("flags: a source reopened in the stored rows shows the reopened text and the dependant's own state does not change", async ({ page }) => {
  const rev = await user("reviewer", "rev1");
  const plan: SeedLesson[] = [
    { number: 1, state: "in_review", blocking: 0, confirmation: 0, advisory: 0, reviewer: rev.user_id },
    { number: 2, state: "approved", blocking: 0, confirmation: 0, advisory: 0, reviewer: rev.user_id },
  ];
  await seedUnit("G6.U10", plan, { outline: true });
  await linkLessons("G6.U10", 1, 2, "L2.excerpt_1", { filled: true });
  await openBoard(page, rev, "g6-u10");
  const tr = page.locator("tbody tr").filter({ has: page.getByRole("link", { name: "Synthetic lesson 1", exact: true }) });
  await expect(tr.getByText(COPY.reopened)).toHaveCount(0);
  const dependant = () => db().query<{ state: string }>("select state from lesson where id='G6.U10.L1'");
  const before = await dependant();
  // Stored state only: the reopen command is NL-100's; this ticket proves the board reads it.
  await db().query("update lesson set state='reopened' where id='G6.U10.L2'");
  await page.reload();
  await expect(tr.getByText(COPY.reopened, { exact: true })).toBeVisible();
  await expect(tr.getByText(COPY.waitsApproval(2), { exact: true })).toBeVisible();
  expect(await dependant()).toEqual(before);
});
