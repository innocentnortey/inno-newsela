// NL-113 AC-16: Insert quote or excerpt… opens from a slot issue card in the live workspace; the fill succeeds; the slot issue leaves the rail.
import { expect, test } from "@playwright/test";
import { liveStack, stopLive } from "../con-13/stack";
import { enqueueCheck, seedWp1 } from "../con-13/seed";
import { issueCard, openAs, openLesson, waitCheckedHash } from "../con-13/helpers";

test.afterAll(stopLive);

test("reachable: insert quote", async ({ browser }) => {
  const live = await liveStack();
  const lesson = await seedWp1();
  await enqueueCheck(lesson.lessonId);
  const r = await openAs(browser, live, "reviewer");
  try {
    await waitCheckedHash(r.page, lesson.lessonId);
    await openLesson(r.page, lesson);
    const card = issueCard(r.page, "Quote placeholder open");
    await expect(card).toHaveCount(1);
    await card.getByRole("button", { name: "Insert quote or excerpt…" }).click();
    const dialog = r.page.getByRole("dialog", { name: "Insert quote" });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Text").fill("The hare slowed down at last.");
    await dialog.getByLabel("Book or title").fill("Synthetic Reader");
    await dialog.getByRole("button", { name: "Insert" }).click();
    await expect(r.page.getByRole("dialog")).toHaveCount(0);
    await expect(issueCard(r.page, "Quote placeholder open")).toHaveCount(0, { timeout: 15_000 });
  } finally {
    await r.context.close();
  }
});
