// NL-101 AC-5 (frozen, risk::security). Guards: negative / invariant. Do not edit.
// Author and approver connections read but never write; a lesson already submitted arrives read_only.
import { expect, test } from "@playwright/test";
import { bridgeCollab } from "./bridge";
import { auditCount, cookieHeader, docCount, sessionToken, signedInContext, startCollab } from "./helpers";
import { closeSeedPool, seedLesson } from "./seed";
import { connectRaw } from "./socket";

test.afterAll(closeSeedPool);

for (const role of ["author", "approver"] as const) {
  test(`reviewer-only-writes: ${role} reads the lesson but the write is refused LESSON_LOCKED with refused_from, nothing persisted [negative]`, async ({ browser }) => {
    const lesson = await seedLesson("in_review");
    const collab = await startCollab();
    const { context } = await signedInContext(browser, role);
    const c = connectRaw(collab.port, lesson.lessonId, cookieHeader(await sessionToken(context)));
    try {
      await c.until(() => c.synced(), 8000, "sync");
      expect(typeof c.title()).toBe("string"); // can read
      expect(c.ofType("mode")[0]).toMatchObject({ type: "mode", mode: "read_only" });
      const docs = await docCount(lesson.lessonId);
      const audits = await auditCount();
      c.edit("ROLE-SHOULD-NOT-LAND");
      await c.until(() => c.ofType("refused").length > 0, 8000, "refused message");
      const m = c.ofType("refused")[0]!;
      expect(m).toMatchObject({ type: "refused", code: "LESSON_LOCKED" });
      expect(typeof m.refused_from).toBe("string");
      expect((m.refused_from as string).length).toBeGreaterThan(0);
      await new Promise((r) => setTimeout(r, 1800)); // longer than the store debounce
      expect(await docCount(lesson.lessonId)).toBe(docs);
      expect(await auditCount()).toBe(audits);
    } finally {
      c.destroy();
      await context.close();
      await collab.close();
    }
  });
}

test("reviewer-only-writes: a lesson already submitted arrives mode read_only even for a reviewer, and its write is refused [negative]", async ({ browser }) => {
  const lesson = await seedLesson("submitted");
  const collab = await startCollab();
  const { context } = await signedInContext(browser, "reviewer");
  const c = connectRaw(collab.port, lesson.lessonId, cookieHeader(await sessionToken(context)));
  try {
    await c.until(() => c.synced(), 8000, "sync");
    expect(c.ofType("mode")[0]).toMatchObject({ mode: "read_only", state: "submitted" });
    const docs = await docCount(lesson.lessonId);
    c.edit("SUBMITTED-SHOULD-NOT-LAND");
    await c.until(() => c.ofType("refused").length > 0, 8000, "refused message");
    expect(c.ofType("refused")[0]).toMatchObject({ code: "LESSON_LOCKED" });
    await new Promise((r) => setTimeout(r, 1800));
    expect(await docCount(lesson.lessonId)).toBe(docs);
  } finally {
    c.destroy();
    await context.close();
    await collab.close();
  }
});

test("reviewer-only-writes: the author's SCR-9 page offers no editor, says only reviewers edit, and persists nothing [invariant]", async ({ browser }) => {
  const lesson = await seedLesson("in_review");
  const collab = await startCollab();
  const { context, page } = await signedInContext(browser, "author");
  try {
    await bridgeCollab(page, collab.port);
    await page.goto(lesson.url);
    await expect(page.getByText("Only reviewers edit lessons.")).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('[data-testid="lesson-editor"]')).toHaveCount(0);
    await expect(page.getByRole("textbox")).toHaveCount(0);
    const docs = await docCount(lesson.lessonId);
    await page.keyboard.type("AUTHOR-KEYSTROKES");
    await page.waitForTimeout(1800);
    expect(await docCount(lesson.lessonId)).toBe(docs);
  } finally {
    await context.close();
    await collab.close();
  }
});
