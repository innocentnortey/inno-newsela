// NL-102 AC-2: each changed payload is a new export version; lessons move approved -> exported; every create is audited.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { as, auditRows, createExport, download, exportRows, lessonState, type Created } from "./helpers";
import { approverUser, ensureSeeded, freshUnit, reapprove, seedApproved, seedDraft } from "./seed";

test.setTimeout(300_000);

test("versions: v1 audits and marks exported; a re-approved lesson makes v2 and the rest stay", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  const approver = await approverUser();
  const l1 = await seedApproved({ unit, number: 1, approver_id: approver.user_id });
  const l2 = await seedApproved({ unit, number: 2, approver_id: approver.user_id });
  const draft = await seedDraft({ unit, number: 6 });
  await as(page, approver);

  const r1 = await createExport(page, unit.unit_key);
  expect(r1.status(), await r1.text()).toBe(201);
  const c1 = (await r1.json()) as Created;
  expect(c1.version_number).toBe(1);
  expect(await exportRows(unit.unit_id)).toHaveLength(1);
  const audit1 = await auditRows(c1.export_id);
  expect(audit1).toHaveLength(1);
  expect(audit1[0]!.details_json["newly_exported"]).toBe(2);
  expect(audit1[0]!.request_id).toBeTruthy();
  for (const l of [l1, l2]) {
    expect(await lessonState(l.lesson_id)).toBe("exported");
    const ev = await db().count("review_event", "lesson_id=$1 and from_state='approved' and to_state='exported'", [l.lesson_id]);
    expect(ev, `review_event for ${l.lesson_id}`).toBe(1);
  }
  expect(await lessonState(draft.lesson_id)).toBe("draft");

  const newText = "SECOND-VERSION-TEXT-7731";
  await reapprove(l1, newText, approver.user_id);
  const r2 = await createExport(page, unit.unit_key);
  expect(r2.status(), await r2.text()).toBe(201);
  const c2 = (await r2.json()) as Created;
  expect(c2.version_number).toBe(2);
  const file = await download(page, c2.export_id);
  const byId = new Map(file.body.lessons.map((l) => [l.lesson_id, l]));
  expect(JSON.stringify(byId.get(l1.lesson_id)!.lesson)).toContain(newText);
  expect(byId.get(l1.lesson_id)!.content_hash).not.toBe(l1.approved.content_hash);
  expect(byId.get(l2.lesson_id)!.content_hash).toBe(l2.approved.content_hash);
  expect(file.body.lessons).toHaveLength(2);
  expect(await exportRows(unit.unit_id)).toHaveLength(2);
  expect(await auditRows(c2.export_id)).toHaveLength(1);
  const [{ n }] = (await db().query<{ n: number }>("select count(*)::int as n from audit_event where action='export.create' and target_id in ($1,$2)", [c1.export_id, c2.export_id])) as [{ n: number }];
  expect(n).toBe(2);
  console.log(`versions: v1 ${c1.export_id}, v2 ${c2.export_id}; 2 bundles, 2 audit rows`);
});
