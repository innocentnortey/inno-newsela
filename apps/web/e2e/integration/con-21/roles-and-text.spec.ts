// NL-97 AC-6: every role reads the summary; no per-person minutes; no replace-writers copy; markup in a failure is only ever text.
import { expect, test } from "@playwright/test";
import { bannedIn } from "../support/copy-rules";
import { asRole, getSummary, runScenario, screenFigures, summaryApi, summaryUrl } from "./helpers";

test.setTimeout(240_000);
const ALLOWED = new Set(["p95_minutes_per_lesson", "target_minutes_per_lesson"]);

test("roles-and-text: all roles read it, no named-person minutes, no banned copy, planted markup is not rendered", async ({ page }) => {
  const { up, runId } = await runScenario(page, "fails");
  const keys: string[] = [];
  const walk = (v: unknown) => {
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { keys.push(k); walk(x); }
  };
  for (const role of ["author", "reviewer", "approver"] as const) {
    await asRole(page, role);
    const res = await page.request.get(summaryApi(runId));
    expect(res.status(), role).toBe(200);
    walk(await res.json());
  }
  const bad = keys.filter((k) => /minutes_by|reviewer_minutes|by_user|person/i.test(k) && !ALLOWED.has(k));
  console.log(`keys scanned: ${keys.length}; named-person minute keys: ${bad.length}`);
  expect(bad).toEqual([]);

  let dialogs = 0;
  page.on("dialog", (d) => { dialogs++; void d.dismiss(); });
  await page.goto(summaryUrl(runId, up.unit_key));
  await screenFigures(page);
  const text = await page.locator("main").innerText();
  const banned = bannedIn(text);
  console.log(`banned phrases on SCR-17: ${banned.length}; <img> in main: ${await page.locator("main img").count()}`);
  expect(banned).toEqual([]);
  expect(await page.locator("main img").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  expect(dialogs).toBe(0);
  // The stored raw reply of the failed lesson carries the markup; it is never part of the summary.
  expect(JSON.stringify(await getSummary(page, runId))).not.toContain("<img");
});
