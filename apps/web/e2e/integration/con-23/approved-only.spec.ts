// NL-102 AC-3 (frozen): nothing from a draft, in-review or submitted lesson ever reaches an export; edits to the live
// document after approval do not change the snapshot.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { as, createExport, download, listExports, exportsApi, type Created } from "./helpers";
import { approverUser, DRAFT_SENTINEL, editLive, ensureSeeded, freshUnit, seedApproved, seedDraft, seedInReview, seedSubmitted } from "./seed";

test.setTimeout(300_000);
const count = (hay: string, needle: string): number => hay.split(needle).length - 1;

test("approved-only: the draft sentinel is nowhere in create, list, download or export rows", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  const approver = await approverUser();
  const ok = await seedApproved({ unit, number: 1, approver_id: approver.user_id });
  await seedDraft({ unit, number: 5 });
  await seedInReview({ unit, number: 6 });
  await seedSubmitted({ unit, number: 7 });
  await as(page, approver);

  const created = await createExport(page, unit.unit_key);
  const createdText = await created.text();
  expect(created.status(), createdText).toBe(201);
  const c = JSON.parse(createdText) as Created;
  const listText = await (await page.request.get(exportsApi(unit.unit_key))).text();
  const file = await download(page, c.export_id);
  const rows = JSON.stringify(await db().query("select * from export_bundle where unit_id=$1", [unit.unit_id]));
  const counts = { create: count(createdText, DRAFT_SENTINEL), list: count(listText, DRAFT_SENTINEL), download: count(file.text, DRAFT_SENTINEL), rows: count(rows, DRAFT_SENTINEL) };
  console.log(`sentinel counts ${JSON.stringify(counts)}`);
  expect(counts).toEqual({ create: 0, list: 0, download: 0, rows: 0 });
  expect(file.body.lessons.map((l) => l.lesson_id)).toEqual([ok.lesson_id]);
  expect(file.text).toContain(ok.approved.text);

  await editLive(ok, "LIVE-EDIT-9001");
  const again = await download(page, c.export_id);
  expect(again.text).toContain(ok.approved.text);
  expect(again.text).not.toContain("LIVE-EDIT-9001");
  const next = await createExport(page, unit.unit_key);
  expect(next.status()).toBe(200); // the live edit changes nothing in the snapshot, so nothing new is written
  const list = await listExports(page, unit.unit_key);
  expect(list.exports).toHaveLength(1);
  expect(JSON.stringify(list)).not.toContain("LIVE-EDIT-9001");
});
