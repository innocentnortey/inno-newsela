// NL-102 AC-1 (frozen) + reachability: the approver exports a unit's approved snapshots through the real routes.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { as, createExport, download, exportRows, exportUrl, exportsApi, listExports, type Created } from "./helpers";
import { approverUser, ensureSeeded, freshUnit, seedApproved, seedDraft, seedInReview } from "./seed";

test.setTimeout(300_000);

test("reachable: listExports answers 200 for an approver (not 500 'exports are not wired')", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  const approver = await approverUser();
  await seedApproved({ unit, number: 1, approver_id: approver.user_id });
  await as(page, approver);
  const res = await page.request.get(exportsApi(unit.unit_key));
  console.log(`GET ${exportsApi(unit.unit_key)} -> ${res.status()}`);
  expect(res.status(), await res.text()).toBe(200);
  expect(await res.text()).not.toContain("NOT BUILT");
});

test("the Export link on the board opens the Export screen", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  const approver = await approverUser();
  await seedApproved({ unit, number: 1, approver_id: approver.user_id });
  await as(page, approver);
  await page.goto(`/units/${unit.unit_key}/board`);
  await page.getByRole("link", { name: "Export" }).click();
  await expect(page).toHaveURL(new RegExp(`/units/${unit.unit_key}/export$`));
  await expect(page.getByRole("heading", { level: 1, name: "Export (no live integration)" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Approved snapshots" })).toBeVisible();
  void exportUrl;
});

test("test_export_capture: three approved lessons are exported once; a repeat writes nothing", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  const approver = await approverUser();
  const a = [
    await seedApproved({ unit, number: 1, approver_id: approver.user_id }),
    await seedApproved({ unit, number: 2, approver_id: approver.user_id }),
    await seedApproved({ unit, number: 4, approver_id: approver.user_id }),
  ];
  const draft = await seedDraft({ unit, number: 6 });
  const review = await seedInReview({ unit, number: 7 });
  await as(page, approver);

  const first = await createExport(page, unit.unit_key);
  expect(first.status(), await first.text()).toBe(201);
  const c1 = (await first.json()) as Created;
  expect(c1.version_number).toBe(1);
  expect(c1.same_as_previous).toBe(false);

  const second = await createExport(page, unit.unit_key);
  expect(second.status()).toBe(200);
  const c2 = (await second.json()) as Created;
  expect(c2.same_as_previous).toBe(true);
  expect(c2.export_id).toBe(c1.export_id);

  const h1 = (await listExports(page, unit.unit_key)).exports[0]!.payload_hash;
  const h2 = (await listExports(page, unit.unit_key)).exports[0]!.payload_hash;
  expect(h1).toBe(h2);
  expect(await exportRows(unit.unit_id)).toHaveLength(1);

  const file = await download(page, c1.export_id);
  expect(file.status).toBe(200);
  const ids = file.body.lessons.map((l) => l.lesson_id).sort();
  expect(ids).toEqual(a.map((l) => l.lesson_id).sort());
  for (const l of file.body.lessons) {
    const [row] = await db().query<{ content_hash: string }>("select content_hash from lesson_version where id=$1 and kind='approve'", [l.version_id]);
    expect(row, `approve row for ${l.lesson_id}`).toBeTruthy();
    expect(l.content_hash).toBe(row!.content_hash);
  }
  expect(ids).not.toContain(draft.lesson_id);
  expect(ids).not.toContain(review.lesson_id);
  console.log(`capture: v${c1.version_number} ${ids.length} lessons, repeat -> 200 same_as_previous, 1 bundle row`);
});
