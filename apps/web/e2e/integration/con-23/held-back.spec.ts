// NL-102 AC-4: an approved lesson whose source lesson is not approved is held back, and is exported once the source is approved.
import { expect, test } from "@playwright/test";
import { as, createExport, download, exportUrl, listExports, type Created } from "./helpers";
import { approverUser, ensureSeeded, freshUnit, linkLessons, seedApproved, seedDraft } from "./seed";

test.setTimeout(300_000);

test("held-back: Lesson 4 waits on Lesson 5 until Lesson 5 is approved", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  const approver = await approverUser();
  const l4 = await seedApproved({ unit, number: 4, approver_id: approver.user_id });
  const l1 = await seedApproved({ unit, number: 1, approver_id: approver.user_id });
  await seedDraft({ unit, number: 5 });
  await linkLessons(unit, 4, 5);
  await as(page, approver);

  const list = await listExports(page, unit.unit_key);
  expect(list.held_back).toEqual([expect.objectContaining({ lesson_id: l4.lesson_id, waits_on: `${unit.unit_id}.L5`, reason: expect.any(String) })]);
  expect(list.included.map((i) => i.lesson_id)).toEqual([l1.lesson_id]);

  await page.goto(exportUrl(unit.unit_key));
  const held = page.getByRole("list", { name: "Held back" });
  await expect(held).toContainText("Lesson 4 waits on Lesson 5");
  const table = page.getByRole("table", { name: "Approved snapshots" });
  await expect(table).toBeVisible();
  await expect(table.getByRole("cell", { name: "Lesson 4" })).toHaveCount(0);
  await expect(table.getByRole("cell", { name: "Lesson 1" })).toHaveCount(1);

  const c1 = (await (await createExport(page, unit.unit_key)).json()) as Created;
  const f1 = await download(page, c1.export_id);
  expect(f1.body.lessons.map((l) => l.lesson_id)).toEqual([l1.lesson_id]);
  expect(f1.text).not.toContain(l4.approved.text);

  // Lesson 5 becomes approved in place (state plus an approve version, as a reviewer approval would leave it).
  const { db } = await import("../support/db");
  await db().query("update lesson set state='approved' where id=$1", [`${unit.unit_id}.L5`]);
  await db().query(
    "insert into lesson_version (id, lesson_id, number, kind, adopted, content_hash, state_vector, lesson_json, draft_json, teacher_word_count, provenance_json, model_call_ids, dependency_record_json, created_by) " +
      "select 'lv_' || (select string_agg(substr('0123456789ABCDEFGHJKMNPQRSTVWXYZ', 1 + (random()*31)::int, 1), '') from generate_series(1,26)), lesson_id, number + 1, 'approve', false, content_hash, state_vector, lesson_json, null, teacher_word_count, provenance_json, '[]', '[]', $2 " +
      "from lesson_version where lesson_id=$1 order by number desc limit 1",
    [`${unit.unit_id}.L5`, approver.user_id],
  );
  const c2res = await createExport(page, unit.unit_key);
  expect(c2res.status(), await c2res.text()).toBe(201);
  const c2 = (await c2res.json()) as Created;
  expect(c2.version_number).toBe(2);
  expect(c2.held_back).toEqual([]);
  const f2 = await download(page, c2.export_id);
  expect(f2.body.lessons.map((l) => l.lesson_id).sort()).toEqual([l1.lesson_id, l4.lesson_id, `${unit.unit_id}.L5`].sort());
});
