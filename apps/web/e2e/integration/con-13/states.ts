// NL-113 states for axe and screenshots: SCR-9 rail (issues, pending), SCR-11 (open, refusal, clear flag), SCR-10 (open, error, success).
import type { Browser, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { liveStack, stopWorker } from "./stack";
import { enqueueCheck, seedWp1, seedWp4 } from "./seed";
import { issueCard, openAs, openLesson, stored, waitCheckedHash } from "./helpers";

export interface Reached {
  page: Page;
  close(): Promise<void>;
}
export type State =
  | "scr9-issues" | "scr9-pending"
  | "scr11-open" | "scr11-refusal" | "scr11-clear"
  | "scr10-open" | "scr10-error" | "scr10-success";

export async function reach(browser: Browser, state: State): Promise<Reached> {
  const live = await liveStack({ fresh: true });
  const lesson = state === "scr11-clear" ? await seedWp4() : await seedWp1();
  await enqueueCheck(lesson.lessonId);
  const r = await openAs(browser, live, "reviewer");
  const page = r.page;
  await page.setViewportSize({ width: 1280, height: 900 });
  await waitCheckedHash(page, lesson.lessonId);
  await openLesson(page, lesson);
  await expect(page.locator("[data-issue-id]").first()).toBeVisible({ timeout: 30_000 });
  const dialog = page.getByRole("dialog");
  switch (state) {
    case "scr9-issues":
      break;
    case "scr9-pending": {
      await stopWorker();
      const before = await stored(lesson.lessonId);
      await page.locator('[data-testid^="section-"] [role="textbox"]').first().click();
      await page.keyboard.type(" AXE");
      await expect.poll(async () => (await stored(lesson.lessonId)).seq, { timeout: 20_000 }).toBeGreaterThan(before.seq);
      await expect(page.getByTestId("checking")).toBeVisible({ timeout: 30_000 });
      break;
    }
    case "scr11-open":
    case "scr11-refusal":
      await issueCard(page, "Minutes out of range").getByRole("button", { name: "Resolve…" }).click();
      await expect(dialog).toBeVisible();
      if (state === "scr11-refusal") {
        await page.getByRole("button", { name: "Record resolution" }).click();
        await expect(dialog.getByText(/reason/i).first()).toBeVisible();
      }
      break;
    case "scr11-clear":
      await issueCard(page, "Safety flag open").getByRole("button", { name: "Clear flag…" }).click();
      await expect(dialog).toBeVisible();
      break;
    case "scr10-open":
    case "scr10-error":
    case "scr10-success":
      await issueCard(page, "Quote placeholder open").getByRole("button", { name: "Insert quote or excerpt…" }).click();
      await expect(dialog).toBeVisible();
      if (state !== "scr10-open") {
        await dialog.getByLabel("Text").fill("The hare slowed down at last.");
        if (state === "scr10-success") await dialog.getByLabel("Book or title").fill("Synthetic Reader");
        await dialog.getByRole("button", { name: "Insert" }).click();
        if (state === "scr10-error") await expect(dialog.getByText(/source/i).first()).toBeVisible();
        else {
          await expect(dialog).toHaveCount(0);
          await expect(page.getByText(/Quote inserted|Inserted/).first()).toBeVisible();
        }
      }
      break;
  }
  return {
    page,
    close: async () => {
      await r.context.close();
      if (state === "scr9-pending") await liveStack({ fresh: true }); // restart the held worker for the next state
    },
  };
}
