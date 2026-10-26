// NL-104 AC-5 (+ reachability c, d): with cut #6 the route returns quality: null (key present) and SCR-19 shows not-found.
// The real app's FIRED_CUTS is compile-time, so link hiding is proved by tests/unit/features/quality/cut-flag.test.tsx.
import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../support/users";
import { startCutStack } from "./cut-stack";
import { COPY, getJson, METRICS_PATH } from "./helpers";
import { expectedQuality } from "./oracle";
import { cleanupGlobal, seedAll, UNITS } from "./seed";

// The app's left navigation only: the board's own "Related pages" row sits inside <main> and is checked separately.
const navQualityLinks = (p: Page): Promise<number> =>
  p.evaluate(() => [...document.querySelectorAll("nav a")].filter((a) => !a.closest("main") && (a.getAttribute("href") ?? "").endsWith("/quality")).length);

test.describe.configure({ mode: "serial" });
let ids: Awaited<ReturnType<typeof seedAll>>;
let cut: Awaited<ReturnType<typeof startCutStack>>;
test.beforeAll(async () => { ids = await seedAll(); cut = await startCutStack(); });
test.afterAll(async () => { await cut?.stop(); await cleanupGlobal(ids); });

test("cut-6: route returns quality null with the key present; north star unchanged; address shows not-found; nav and board", async ({ browser, page }, info) => {
  const rev = ids.reviewers[0]!;
  const ctx = await browser.newContext({ baseURL: cut.baseURL });
  const cutPage = await ctx.newPage();
  await signInAs(cutPage, rev);
  const res = await getJson(cutPage, METRICS_PATH(UNITS.main.unit_id));
  expect(res.status).toBe(200);
  expect(Object.prototype.hasOwnProperty.call(res.body, "quality")).toBe(true);
  expect(res.body.quality).toBeNull();
  const oracle = await expectedQuality(UNITS.main.unit_id);
  expect(res.body.north_star.n).toBe(oracle.tiles.find((t) => t.id === "O-2")!.n);

  await cutPage.goto(`/units/${UNITS.main.unit_key}/quality`);
  await expect(cutPage.getByText(COPY.notFound)).toBeVisible();
  await expect(cutPage.locator("main li")).toHaveCount(0);
  expect(await navQualityLinks(cutPage)).toBe(0);

  // SCR-8 on both stacks: the north-star tile and its numbers are identical
  await signInAs(page, rev);
  const main = await getJson(page, METRICS_PATH(UNITS.main.unit_id));
  expect(main.body.quality).not.toBeNull();
  expect(res.body.north_star).toEqual(main.body.north_star);
  for (const p of [page, cutPage]) {
    await p.goto(`/units/${UNITS.main.unit_key}/board`);
    await expect(p.getByText("Reviewer minutes per approved lesson")).toBeVisible();
    await expect(p.getByText("approved 5 of 5")).toBeVisible();
    expect(await navQualityLinks(p)).toBe(0);
    // FIRED_CUTS is compile-time: the board link stays on both stacks; hiding is proved by the cut-flag vitest.
    await expect(p.getByRole("link", { name: "Unit quality" })).toHaveCount(1);
  }
  info.annotations.push({ type: "gap", description: "Board link hiding under cut #6 is proved by tests/unit/features/quality/cut-flag.test.tsx; FIRED_CUTS is compile-time (seam follow-up)." });
  await ctx.close();
});
