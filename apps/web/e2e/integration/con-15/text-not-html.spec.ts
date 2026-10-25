// NL-113 AC-9: a fill containing markup is stored as text and shown literally; nothing runs.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { liveStack, stopLive } from "../con-13/stack";
import { enqueueCheck, seedWp1 } from "../con-13/seed";
import { openAs, openLesson, waitCheckedHash } from "../con-13/helpers";

test.afterAll(stopLive);

const MARKUP = "<img src=x onerror=window.__pwn=1>";

test("text_not_html: markup in a fill is stored as text and rendered literally", async ({ browser }) => {
  const live = await liveStack();
  const lesson = await seedWp1();
  await enqueueCheck(lesson.lessonId);
  const r = await openAs(browser, live, "reviewer");
  try {
    await waitCheckedHash(r.page, lesson.lessonId);
    await openLesson(r.page, lesson);
    const card = r.page.locator("[data-issue-id]").filter({ hasText: "Quote placeholder open" });
    await card.getByRole("button", { name: "Insert quote or excerpt…" }).click();
    const dialog = r.page.getByRole("dialog", { name: "Insert quote" });
    await dialog.getByLabel("Rights status").selectOption("public-domain");
    await dialog.getByLabel("Text").fill(MARKUP);
    await dialog.getByLabel("Book or title").fill("Synthetic Reader");
    await dialog.getByRole("button", { name: "Insert" }).click();
    await expect(r.page.getByRole("dialog")).toHaveCount(0);
    const stored = await db().query<{ derived_json: unknown }>("select derived_json from lesson_doc where lesson_id = $1 order by seq desc limit 1", [lesson.lessonId]);
    expect(JSON.stringify(stored[0]!.derived_json)).toContain("onerror=window.__pwn=1");
    await r.page.reload();
    await expect(r.page.getByTestId("lesson-editor")).toBeVisible({ timeout: 30_000 });
    await expect(r.page.locator(".ProseMirror").getByText(MARKUP, { exact: false }).first()).toBeVisible();
    expect(await r.page.locator(".ProseMirror img").count()).toBe(0);
    expect(await r.page.evaluate(() => (window as unknown as { __pwn?: unknown }).__pwn)).toBeUndefined();
    console.log("text_not_html: stored literally, 0 <img> in the editor, window.__pwn undefined");
  } finally {
    await r.context.close();
  }
});
