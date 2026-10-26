// NL-103: how each SCR-21 state is reached on the real stack. Shared by axe.spec.ts and visual.spec.ts.
import { expect, type Browser, type Page } from "@playwright/test";
import type { TestUser } from "../support/users";
import { signInAs } from "../support/users";
import { getStack } from "../support/real-stack";
import {
  createAuthor, driver, driverBg, getPrompts, hex, insertSpend, openGuidance, saveApi, saveViaUi,
} from "./helpers";

export async function selectLesson4(page: Page): Promise<void> {
  const select = page.getByLabel("Lesson", { exact: true });
  const option = select.locator("option").filter({ hasText: /^Lesson 4:/ });
  await expect(option).toHaveCount(1);
  await select.selectOption({ label: (await option.textContent())! });
}

export async function reachReasonError(page: Page): Promise<void> {
  await openGuidance(page);
  await page.getByRole("button", { name: "Save as new version" }).click();
  await expect(page.getByText("A version needs a reason.")).toBeVisible();
}

/** Another author saves first, so this page's save is refused as stale and the banner shows. */
export async function reachStale(browser: Browser, page: Page): Promise<void> {
  await openGuidance(page);
  const other = await browser.newContext({ baseURL: getStack().baseURL });
  try {
    const op = await other.newPage();
    await signInAs(op, await createAuthor());
    const cur = (await getPrompts(op)).current_prompt_version_id;
    const res = await saveApi(op, { base_version_id: cur, guidance_text: `first author text NL103-ST-${hex()}`, reason: "e2e first" });
    expect(res.status()).toBe(201);
  } finally {
    await other.close();
  }
  await saveViaUi(page, `second author text NL103-ST-${hex()}`, "e2e second");
  await expect(page.getByText("Someone saved a newer version first. Review it below, then save again.")).toBeVisible();
}

/** The trial is started and no worker runs yet: "Making a candidate on Lesson 4…". The caller drains it with drainTrial. */
export async function reachMaking(page: Page): Promise<void> {
  await openGuidance(page);
  await selectLesson4(page);
  await page.getByRole("button", { name: "Try on one lesson" }).click();
  await expect(page.getByText("Making a candidate on Lesson 4…")).toBeVisible();
}
export const drainTrial = (user: TestUser) => driver(["trial", user.user_id]);

export async function reachMade(page: Page, user: TestUser): Promise<void> {
  await openGuidance(page);
  await selectLesson4(page);
  const worker = driverBg(["trial", user.user_id]);
  await page.getByRole("button", { name: "Try on one lesson" }).click();
  await expect(page.getByText("Candidate made on Lesson 4, not adopted.")).toBeVisible({ timeout: 60_000 });
  await worker;
}

/** Leaves 0.50 of the day: the page's $1.00 trial cap no longer fits. The caller releases the spend row. */
export async function reachDayCap(page: Page, user: TestUser): Promise<void> {
  await insertSpend(user.user_id, 25.5);
  await openGuidance(page);
  await selectLesson4(page);
  await page.getByRole("button", { name: "Try on one lesson" }).click();
  await expect(page.getByText(/The day's spend cap would be passed\. Remaining: \$/)).toBeVisible();
}
