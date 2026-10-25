// NL-101 AC-6 (frozen, risk::security). Guards: negative / regression (SP-2 assertions). Do not edit.
// Freeze mid-session: the keystroke is refused before it is applied, the typist is told, nothing persists, unfreeze works.
import { expect, test } from "@playwright/test";
import { bridgeCollab } from "./bridge";
import { docCount, firstTextbox, latestDoc, refusalLines, savedState, signedInContext, startCollab } from "./helpers";
import { closeSeedPool, seedLesson } from "./seed";

test.afterAll(closeSeedPool);

test("refused-after-lock: keystroke after FrozenDocs.freeze is refused, typist told, 0 rows persist, stored hash unchanged; unfreeze lets the reviewer type again [negative]", async ({ browser }) => {
  const lesson = await seedLesson("in_review");
  const collab = await startCollab();
  const { context, page } = await signedInContext(browser, "reviewer");
  try {
    await bridgeCollab(page, collab.port);
    await page.goto(lesson.url);
    await expect(firstTextbox(page)).toHaveAttribute("aria-readonly", "false", { timeout: 20_000 });

    // An earlier edit stores normally.
    await firstTextbox(page).click();
    await page.keyboard.type("EARLY-EDIT ");
    await expect(savedState(page, "stored")).toBeVisible({ timeout: 15_000 });
    const rowsBefore = await docCount(lesson.lessonId);
    const hashBefore = (await latestDoc(lesson.lessonId))!.content_hash;
    expect(JSON.stringify((await latestDoc(lesson.lessonId))!.derived_json)).toContain("EARLY-EDIT");

    // Lock mid-session (the Submit freeze, modelled directly: NL-106 is not built).
    collab.wiring.frozen.freeze(lesson.lessonId);
    await page.keyboard.type("LATE-KEYSTROKES");

    // The typist is told which keystrokes were refused, and the editor turns read-only.
    const notice = page.getByText(/Your last edits were not saved because/);
    await expect(notice).toBeVisible({ timeout: 10_000 });
    // The refused keystrokes are listed (the first ones typed after the lock; later ones hit the already-reset doc).
    await expect(page.getByText(/Removed text: “L/)).toBeVisible();
    await expect(firstTextbox(page)).toHaveAttribute("aria-readonly", "true");
    await expect(savedState(page, "read_only")).toBeVisible();

    // Zero edits persist after the freeze (wait past the store debounce); the last stored row is the pre-freeze one.
    await page.waitForTimeout(2500);
    expect(await docCount(lesson.lessonId)).toBe(rowsBefore);
    const after = (await latestDoc(lesson.lessonId))!;
    expect(after.content_hash).toBe(hashBefore);
    expect(JSON.stringify(after.derived_json)).not.toContain("LATE-KEYSTROKES");
    expect(refusalLines(collab).length).toBeGreaterThanOrEqual(1);

    // Unfreeze: the same reviewer reconnects (fresh socket re-evaluates the lock) and can type and store again.
    collab.wiring.frozen.unfreeze(lesson.lessonId);
    await page.reload();
    await expect(firstTextbox(page)).toHaveAttribute("aria-readonly", "false", { timeout: 20_000 });
    await firstTextbox(page).click();
    await page.keyboard.type("AFTER-UNFREEZE");
    await expect(savedState(page, "stored")).toBeVisible({ timeout: 15_000 });
    await expect.poll(() => docCount(lesson.lessonId), { timeout: 10_000 }).toBeGreaterThan(rowsBefore);
    expect(JSON.stringify((await latestDoc(lesson.lessonId))!.derived_json)).toContain("AFTER-UNFREEZE");
  } finally {
    await context.close();
    await collab.close();
  }
});
