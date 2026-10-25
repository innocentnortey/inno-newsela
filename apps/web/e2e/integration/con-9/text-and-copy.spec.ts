// NL-98 AC-7: markup in titles and notes renders as text; no banned phrasing; no unattributed "standards-aligned".
import { expect, test } from "@playwright/test";
import { bannedIn } from "../support/copy-rules";
import { db } from "../support/db";
import { COPY, openBoard } from "./helpers";
import { addSendBack, seedBareUnit, seedMainUnit, seedUnit, user, type SeedLesson } from "./seed";

const TITLE = "<img src=x onerror=window.__pwn=1>";
const NOTE = "<script>window.__pwn=1</script>";

test("text-and-copy: markup in a lesson title and a send-back note renders as text; zero injected elements", async ({ page }) => {
  const rev = await user("reviewer", "rev1");
  const plan: SeedLesson[] = [{ number: 1, state: "changes_requested", blocking: 1, confirmation: 0, advisory: 0, reviewer: rev.user_id }];
  await seedUnit("G6.U8", plan, { outline: true, titles: { 1: TITLE } });
  await addSendBack("G6.U8.L1", rev, "other", NOTE);
  await openBoard(page, rev, "g6-u8");
  await expect(page.getByText(TITLE, { exact: true })).toBeVisible();
  const injected = await page.locator("main img[src='x'], main script").count();
  console.log(`injected img/script elements in main: ${injected}`);
  expect(injected).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __pwn?: number }).__pwn)).toBeUndefined();
  expect(bannedIn(await page.locator("body").innerText())).toEqual([]);
  // the note is stored but the board row shows tag and author only; nothing from it may execute either way
  expect(await db().count("review_event", "note=$1", [NOTE])).toBe(1);
});

test("text-and-copy: no banned phrase on the main, empty-tile, empty-board and tile-error states; no bare 'standards-aligned'", async ({ page }) => {
  const seeded = await seedMainUnit();
  await seedBareUnit("G6.U9");
  const bodies: string[] = [];
  await openBoard(page, seeded.reviewers[0]!);
  await expect(page.getByText("approved 3 of 47")).toBeVisible();
  bodies.push(await page.locator("body").innerText());
  await page.goto("/units/g6-u9/board");
  await expect(page.getByText(COPY.noLessons)).toBeVisible();
  bodies.push(await page.locator("body").innerText());
  await page.route("**/api/units/*/metrics", (r) => r.abort());
  await page.goto("/units/g6-u4/board");
  await expect(page.getByText(COPY.tileError)).toBeVisible();
  bodies.push(await page.locator("body").innerText());
  for (const b of bodies) {
    expect(bannedIn(b)).toEqual([]);
    expect(/standards-aligned/i.test(b), "standards-aligned needs an asserter name").toBe(false);
  }
  console.log(`banned phrases across ${bodies.length} states: 0`);
});
