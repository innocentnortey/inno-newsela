// NL-104 AC-3 (+ reachability b): no minutes beside a name; small segments are labelled; every role reads.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { signInAs } from "../support/users";
import { COPY, getJson, METRICS_PATH, openQuality, walk } from "./helpers";
import { cleanupGlobal, seedAll, UNITS } from "./seed";

test.describe.configure({ mode: "serial" });
let ids: Awaited<ReturnType<typeof seedAll>>;
test.beforeAll(async () => { ids = await seedAll(); });
test.afterAll(async () => { await cleanupGlobal(ids); });

test("aggregate-only: the metrics JSON has no object with a name-like key beside a minutes key, for every role", async ({ page }) => {
  let bad = 0;
  for (const u of ids.reviewers) { // reviewer, author, approver
    await page.context().clearCookies();
    await signInAs(page, u);
    for (const unit of Object.values(UNITS)) {
      const r = await getJson(page, METRICS_PATH(unit.unit_id));
      expect(r.status, `${u.role} ${unit.unit_id}`).toBe(200);
      walk(r.body, (o) => {
        const keys = Object.keys(o);
        if (keys.some((k) => /name|reviewer|user|by/i.test(k)) && keys.some((k) => /minute/i.test(k))) bad++;
      });
    }
  }
  console.log(`objects with a name-like key next to a minutes key: ${bad}`);
  expect(bad).toBe(0);
});

test("aggregate-only: no reviewer name near a minutes figure; one reviewer is labelled; three are not", async ({ page }) => {
  const names = (await db().query<{ name: string }>("select name from app_user where email like 'con10-%'")).map((r) => r.name);
  await openQuality(page, ids.reviewers[0]!, UNITS.main.unit_key);
  const text = await page.locator("main").innerText();
  for (const n of names) expect(text).not.toContain(n);
  expect(text).not.toMatch(/\d+\s*min(utes)?\b[^]{0,40}E2E|E2E[^]{0,40}\d+\s*min/);
  const ctx = page.getByLabel(COPY.context);
  await expect(ctx).toContainText("one reviewer, n = 4"); // 4 of the 5 approved lessons had a human session
  await page.goto(`/units/${UNITS.many.unit_key}/quality`);
  await expect(page.getByLabel(COPY.context)).toBeVisible();
  await expect(page.getByLabel(COPY.context)).not.toContainText("reviewer");
});

test("aggregate-only: author, reviewer and approver can each open the page", async ({ page }) => {
  for (const u of ids.reviewers) {
    await page.context().clearCookies();
    await signInAs(page, u);
    await page.goto(`/units/${UNITS.main.unit_key}/quality`);
    await expect(page.getByRole("heading", { name: COPY.title, level: 1 })).toBeVisible();
  }
});
