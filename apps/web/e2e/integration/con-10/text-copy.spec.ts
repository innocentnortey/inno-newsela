// NL-104 AC-6: seed-controlled markup renders as text, no banned phrase, no bare "standards-aligned".
import { expect, test } from "@playwright/test";
import { bannedIn } from "../support/copy-rules";
import { signInAs } from "../support/users";
import { COPY, openQuality } from "./helpers";
import { cleanupGlobal, MARKUP_TITLE, seedAll, UNITS } from "./seed";

test.describe.configure({ mode: "serial" });
let ids: Awaited<ReturnType<typeof seedAll>>;
test.beforeAll(async () => { ids = await seedAll(); });
test.afterAll(async () => { await cleanupGlobal(ids); });

test("text-and-copy: markup in the unit title renders as text; zero injected elements", async ({ page }) => {
  const rev = ids.reviewers[0]!;
  await signInAs(page, rev);
  await page.goto(`/units/${UNITS.sparse.unit_key}/board`);
  await expect(page.getByText(MARKUP_TITLE, { exact: true }).first()).toBeVisible();
  const injected = await page.locator("main img[src='x'], main script").count();
  console.log(`injected img/script elements in main: ${injected}`);
  expect(injected).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __pwn?: number }).__pwn)).toBeUndefined();
  await openQuality(page, rev, UNITS.sparse.unit_key);
  expect(await page.locator("main img[src='x'], main script").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __pwn?: number }).__pwn)).toBeUndefined();
});

test("text-and-copy: no banned phrase and no bare 'standards-aligned' on populated, empty and error states", async ({ page }) => {
  const rev = ids.reviewers[0]!;
  const bodies: string[] = [];
  await openQuality(page, rev, UNITS.main.unit_key);
  bodies.push(await page.locator("body").innerText());
  await openQuality(page, rev, UNITS.empty.unit_key);
  bodies.push(await page.locator("body").innerText());
  await page.route("**/api/units/*/metrics", (r) => r.abort());
  await page.goto(`/units/${UNITS.main.unit_key}/quality`);
  await expect(page.getByText(COPY.cantLoad)).toBeVisible();
  bodies.push(await page.locator("body").innerText());
  const banned = bodies.flatMap(bannedIn);
  console.log(`banned phrases found: ${banned.length}`);
  expect(banned).toEqual([]);
  expect(bodies.filter((b) => /standards-aligned/i.test(b))).toHaveLength(0);
});
