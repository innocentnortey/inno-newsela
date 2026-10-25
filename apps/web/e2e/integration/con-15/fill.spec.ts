// NL-113 AC-7: fill the excerpt slot from the rail with Lesson 5 present; the stored text, the audit row and the UXP-2 wait.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { liveStack, stopLive } from "../con-13/stack";
import { enqueueCheck, seedWp1WithL5 } from "../con-13/seed";
import { api, auditFor, issuesOf, lastEditor, openAs, openLesson, stored, waitCheckedHash } from "../con-13/helpers";

test.afterAll(stopLive);

test("test_fill_slot_capture [fill]: a reviewer fills the excerpt slot; one new hash, an audit row, the slot issue gone", async ({ browser }) => {
  const live = await liveStack();
  const { l4, l5 } = await seedWp1WithL5();
  await enqueueCheck(l4.lessonId);
  await enqueueCheck(l5.lessonId);
  const r = await openAs(browser, live, "reviewer");
  try {
    const l4Before = await waitCheckedHash(r.page, l4.lessonId);
    const wait = l4Before.issues.find((i: { kind: string }) => i.kind === "cross_lesson_link");
    console.log(`fill: before, L4 cross_lesson_link ${JSON.stringify(wait ? { blocks: wait.blocks, message: wait.message } : null)}`);
    expect(wait, "L4 homework waits on the empty slot in L5").toBeTruthy();
    expect(wait.blocks).toContain("submit");

    await waitCheckedHash(r.page, l5.lessonId);
    await openLesson(r.page, l5);
    const before = await stored(l5.lessonId);
    const audits = (await auditFor(l5.lessonId)).length;
    const card = r.page.locator("[data-issue-id]").filter({ hasText: "Excerpt slot open" });
    await card.getByRole("button", { name: "Insert quote or excerpt…" }).click();
    const dialog = r.page.getByRole("dialog", { name: "Fill excerpt slot" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Text").fill("A synthetic excerpt about a hare and a lion.");
    await dialog.getByLabel("Book or title").fill("Synthetic Reader");
    await dialog.getByLabel("Rights status").selectOption("public-domain");
    const t0 = Date.now();
    await dialog.getByRole("button", { name: "Insert" }).click();
    await expect(r.page.getByRole("dialog")).toHaveCount(0);
    await expect(card).toHaveCount(0, { timeout: 5000 });
    const elapsed = Date.now() - t0;
    const after = await stored(l5.lessonId);
    expect(after.content_hash).not.toBe(before.content_hash);
    expect(await lastEditor(l5.lessonId)).toBe(r.user.user_id);
    const rowsNow = await auditFor(l5.lessonId);
    expect(rowsNow.length).toBeGreaterThan(audits);
    expect(rowsNow.some((a) => a.actor_id === r.user.user_id)).toBe(true);
    console.log(`fill: slot issue left the rail ${elapsed} ms after submit; hash ${before.content_hash.slice(0, 12)} -> ${after.content_hash.slice(0, 12)}; audit rows ${audits} -> ${rowsNow.length}`);

    // Lesson 4's own list is not refreshed by this: a re-check at an unchanged hash only re-affirms rows (S-33), so the finding
    // stays with its old blocks. Printed for the devlog; the expectation lives in the S-34 test below.
    await new Promise((res) => setTimeout(res, 3000));
    const l4Link = (await issuesOf(r.page, l4.lessonId)).body.issues.find((i: { kind: string }) => i.kind === "cross_lesson_link");
    console.log(`fill: after the fill, L4 cross_lesson_link ${JSON.stringify(l4Link ? { blocks: l4Link.blocks } : null)}`);
    void api; void db;
  } finally {
    await r.context.close();
  }
});

// Seam defect S-34 (docs/plans/seam-followups.md): UXP-2 says a filled slot whose source lesson is not approved blocks approve only
// ("waiting for Lesson 5's approval"). Two things stop that on a real link: the check rule drops the finding once the slot is filled,
// and PgLessonRepo.dependencies() reports slot_filled by an exact slot id match, while real links name `<lesson>.excerpt-N` and the
// document names its slots `hare-lion` (checks/rules/links/slots.ts has an ordinal fallback for this; lessons.ts does not).
// Expected to fail until the two agree; the fix is in packages/db and the check rules, outside this ticket.
test("fill: Lesson 4 waits for Lesson 5's approval, blocking approve only (S-34, expected to fail until slot ids agree)", async ({ browser }) => {
  test.fail();
  const live = await liveStack();
  const { l4, l5 } = await seedWp1WithL5();
  await enqueueCheck(l4.lessonId);
  await enqueueCheck(l5.lessonId);
  const r = await openAs(browser, live, "reviewer");
  try {
    await waitCheckedHash(r.page, l4.lessonId);
    const res = await api(r.page, "POST", `/lessons/${l5.lessonId}/slots/hare-lion/fill`, {
      text: "A synthetic excerpt.", source_ref: { title: "Synthetic Reader", chapter: null, pages: null }, rights_status: "public-domain",
    });
    expect(res.status).toBe(200);
    await expect
      .poll(async () => (await issuesOf(r.page, l4.lessonId)).body.issues.find((i: { kind: string }) => i.kind === "cross_lesson_link")?.blocks, { timeout: 15_000 })
      .toEqual(["approve"]);
  } finally {
    await r.context.close();
  }
});
