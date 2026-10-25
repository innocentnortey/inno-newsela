// NL-113 AC-16: Resolve… and Clear flag… open from the live workspace's rail, the call succeeds on the real stack, the rail re-reads.
import { expect, test } from "@playwright/test";
import { liveStack, stopLive } from "../con-13/stack";
import { enqueueCheck, seedWp4 } from "../con-13/seed";
import { issueCard, openAs, openLesson, waitCheckedHash } from "../con-13/helpers";

test.afterAll(stopLive);

test("reachable: resolve and clear flag", async ({ browser }) => {
  const live = await liveStack();
  const lesson = await seedWp4();
  await enqueueCheck(lesson.lessonId);
  const r = await openAs(browser, live, "reviewer");
  try {
    await waitCheckedHash(r.page, lesson.lessonId);
    await openLesson(r.page, lesson);
    const rail = r.page.getByRole("tab", { name: /Issues/ });
    await expect(rail).toBeVisible();

    // Resolve…: the dialog opens from the card, the call succeeds, the rail re-reads (Resolved (1) appears, the card leaves the open list).
    const open = issueCard(r.page, "Minutes out of range");
    await expect(open).toHaveCount(1);
    await open.getByRole("button", { name: "Resolve…" }).click();
    await expect(r.page.getByRole("dialog")).toBeVisible();
    await r.page.getByRole("dialog").getByRole("textbox").fill("Reviewed: the sheet allows 35 minutes here.");
    await r.page.getByRole("button", { name: "Record resolution" }).click();
    await expect(r.page.getByRole("dialog")).toHaveCount(0);
    await expect(r.page.getByText(/Resolved \(1\)/)).toBeVisible({ timeout: 15_000 });
    await expect(issueCard(r.page, "Minutes out of range").getByRole("button", { name: "Resolve…" })).toHaveCount(0);

    // Clear flag…: same, for the safety flag.
    const flag = issueCard(r.page, "Safety flag open");
    await flag.getByRole("button", { name: "Clear flag…" }).click();
    await expect(r.page.getByRole("dialog")).toBeVisible();
    await r.page.getByRole("dialog").getByRole("textbox").fill("Teacher tip is in place.");
    await r.page.getByRole("button", { name: "Clear flag", exact: true }).last().click();
    await expect(r.page.getByRole("dialog")).toHaveCount(0);
    await expect(r.page.getByText("Safety flag cleared.").or(r.page.getByText(/cleared/i)).first()).toBeVisible();
  } finally {
    await r.context.close();
  }
});
