// NL-101 AC-1: two reviewers co-edit the WP-1 lesson through SCR-9; each sees the other's text and name quickly.
import { expect, test } from "@playwright/test";
import { bridgeCollab } from "./bridge";
import { docCount, firstTextbox, latestDoc, savedState, signedInContext, startCollab } from "./helpers";
import { closeSeedPool, seedLesson } from "./seed";

test.afterAll(closeSeedPool);

const secondTextbox = (p: import("@playwright/test").Page) => p.locator('[data-testid^="section-"] [role="textbox"]').nth(1);

test("two-sessions: two reviewers see each other's edits and name within 2 s, edits store and survive reload [AC-1]", async ({ browser }) => {
  const lesson = await seedLesson("in_review");
  const collab = await startCollab();
  const a = await signedInContext(browser, "reviewer");
  const b = await signedInContext(browser, "reviewer");
  try {
    for (const s of [a, b]) {
      await bridgeCollab(s.page, collab.port);
      await s.page.goto(lesson.url);
      await expect(firstTextbox(s.page)).toHaveAttribute("aria-readonly", "false", { timeout: 20_000 });
    }
    await secondTextbox(a.page).click();
    await a.page.keyboard.type("A ");
    await firstTextbox(b.page).click();
    await b.page.keyboard.type("B ");
    await expect(b.page.getByTestId("presence-sentence")).toContainText(a.user.name, { timeout: 2000 });
    await expect(a.page.getByTestId("presence-sentence")).toContainText(b.user.name, { timeout: 2000 });

    const lat: number[] = [];
    for (let i = 0; i < 20; i++) {
      const [writer, reader, box] = i % 2 === 0 ? [a.page, b.page, secondTextbox] : [b.page, a.page, firstTextbox];
      const token = `tok${i}x`;
      const t0 = Date.now();
      await box(writer).click();
      await writer.keyboard.type(`${token} `);
      await expect(box(reader)).toContainText(token, { timeout: 2000 });
      lat.push(Date.now() - t0);
    }
    lat.sort((x, y) => x - y);
    const p95 = lat[Math.ceil(lat.length * 0.95) - 1]!;
    console.log(`two-sessions latencies ms (incl. typing): ${lat.join(",")} p95=${p95}`);
    expect(p95).toBeLessThanOrEqual(2000);

    for (const s of [a, b]) await expect(savedState(s.page, "stored")).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => JSON.stringify((await latestDoc(lesson.lessonId))!.derived_json), { timeout: 15_000 })
      .toMatch(/tok19x[\s\S]*tok18x|tok18x[\s\S]*tok19x/);

    for (const s of [a, b]) {
      await s.page.reload();
      await expect(firstTextbox(s.page)).toHaveAttribute("aria-readonly", "false", { timeout: 20_000 });
    }
    const ta = (await firstTextbox(a.page).innerText()) + (await secondTextbox(a.page).innerText());
    const tb = (await firstTextbox(b.page).innerText()) + (await secondTextbox(b.page).innerText());
    expect(ta).toBe(tb);
    expect(ta).toContain("tok18x");
    expect(ta).toContain("tok19x");
  } finally {
    await a.context.close();
    await b.context.close();
    await collab.close();
  }
});
