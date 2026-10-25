// NL-101 AC-7: an outage holds edits unsaved with a banner; reconnect stores them; a freeze during the outage refuses them.
import { expect, test } from "@playwright/test";
import { firstTextbox, latestDoc, savedState, signedInContext, startCollab } from "./helpers";
import { gatedBridge, newGate } from "./outage";
import { closeSeedPool, seedLesson } from "./seed";

test.afterAll(closeSeedPool);

const BANNER = /Reconnecting: your last edits are not saved yet/;

test("disconnect-reconnect: held edits show the banner and Submit stays off, then store after reconnect within 10 s [AC-7]", async ({ browser }) => {
  const lesson = await seedLesson("in_review");
  const collab = await startCollab();
  const { context, page } = await signedInContext(browser, "reviewer");
  const gate = newGate();
  try {
    await gatedBridge(page, collab.port, gate);
    await page.goto(lesson.url);
    await expect(firstTextbox(page)).toHaveAttribute("aria-readonly", "false", { timeout: 20_000 });
    gate.blocked = true;
    gate.closeAll();
    await expect(savedState(page, "DISCONNECTED")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(BANNER)).toBeVisible();
    await firstTextbox(page).click();
    await page.keyboard.type("HELD-OFFLINE");
    const submit = page.getByRole("button", { name: /Submit for approval/ });
    if (await submit.count()) await expect(submit).toBeDisabled();
    expect(JSON.stringify((await latestDoc(lesson.lessonId))!.derived_json)).not.toContain("HELD-OFFLINE");

    const t0 = Date.now();
    gate.blocked = false;
    await expect(savedState(page, "stored")).toBeVisible({ timeout: 25_000 });
    const ms = Date.now() - t0;
    console.log(`disconnect-reconnect: reconnect + stored in ${ms} ms`);
    expect(ms).toBeLessThanOrEqual(10_000);
    await expect(page.getByText(BANNER)).toHaveCount(0);
    await expect
      .poll(async () => JSON.stringify((await latestDoc(lesson.lessonId))!.derived_json), { timeout: 10_000 })
      .toContain("HELD-OFFLINE");
  } finally {
    await context.close();
    await collab.close();
  }
});

test("disconnect-reconnect: a freeze during the outage refuses the held edits on reconnect, nothing persists [AC-7]", async ({ browser }) => {
  const lesson = await seedLesson("in_review");
  const collab = await startCollab();
  const { context, page } = await signedInContext(browser, "reviewer");
  const gate = newGate();
  try {
    await gatedBridge(page, collab.port, gate);
    await page.goto(lesson.url);
    await expect(firstTextbox(page)).toHaveAttribute("aria-readonly", "false", { timeout: 20_000 });
    gate.blocked = true;
    gate.closeAll();
    await expect(savedState(page, "DISCONNECTED")).toBeVisible({ timeout: 10_000 });
    await firstTextbox(page).click();
    await page.keyboard.type("HELD-THEN-LOCKED");
    collab.wiring.frozen.freeze(lesson.lessonId);
    gate.blocked = false;
    await expect(page.getByText(/Your last edits were not saved because/)).toBeVisible({ timeout: 25_000 });
    await page.waitForTimeout(2500);
    expect(JSON.stringify((await latestDoc(lesson.lessonId))!.derived_json)).not.toContain("HELD-THEN-LOCKED");
  } finally {
    await context.close();
    await collab.close();
  }
});
