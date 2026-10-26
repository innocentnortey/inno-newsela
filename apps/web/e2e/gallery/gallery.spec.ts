import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const SIZES = [
  { w: 1280, h: 900 },
  { w: 390, h: 844 },
];
const THEMES = ["light", "dark"] as const;
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
// axe-core/playwright resolves its own playwright-core copy (1.64.1); the Page type is structurally identical.
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];
const axe = (page: Page) => new AxeBuilder({ page: page as unknown as AxePage });
const SHOTS = "e2e/__screenshots__/gallery";

async function open(page: Page, w: number, h: number, theme?: string) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto("/gallery");
  await page.waitForLoadState("networkidle");
  if (theme) await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
  await page.evaluate(() => document.fonts.ready);
}

for (const { w, h } of SIZES) {
  for (const theme of THEMES) {
    test(`axe + screenshot ${w} ${theme}`, async ({ page }) => {
      await open(page, w, h, theme);
      const res = await axe(page).withTags(TAGS).analyze();
      const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      console.log(`axe ${w}x ${theme}: ${bad.length} serious/critical`);
      await page.screenshot({ path: `${SHOTS}/gallery-${w}-${theme}.png`, fullPage: true });
      expect(bad.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
    });
  }
}

test("390 has no horizontal scroll and the rail sits under the content", async ({ page }) => {
  await open(page, 390, 844, "light");
  const fits = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fits).toBe(true);
  const content = await page.getByTestId("gallery-two-pane-content").boundingBox();
  const rail = await page.getByTestId("gallery-two-pane-rail").boundingBox();
  expect(rail!.y).toBeGreaterThanOrEqual(content!.y + content!.height - 1);
});

test("light is the default theme even when the OS is dark (design.md, Design tokens)", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page, 1280, 900);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(244, 245, 247)");
});

test("'Match system' follows the OS and reduced motion zeroes transitions", async ({ page }) => {
  // DQ-4: following the OS is a stored choice from the account menu, applied before first paint.
  await page.addInitScript(() => window.localStorage.setItem("ls-theme", "system"));
  await page.emulateMedia({ colorScheme: "light" });
  await open(page, 1280, 900);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const light = await bg();
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
  const dark = await bg();
  expect(dark).not.toBe(light);
  await page.screenshot({ path: `${SHOTS}/dark-system-1280.png`, fullPage: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const dur = await page
    .getByRole("button", { name: "primary md" })
    .evaluate((el) => getComputedStyle(el).transitionDuration);
  expect(dur.split(",").every((d) => ["0s", "0ms"].includes(d.trim()))).toBe(true);
});

test("theme switch sets data-theme", async ({ page }) => {
  await open(page, 1280, 900);
  await page.getByRole("button", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("open dialog has no serious axe violations", async ({ page }) => {
  await open(page, 1280, 900, "light");
  await page.getByRole("button", { name: "Open dialog" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const res = await axe(page).withTags(TAGS).include('[role="dialog"]').analyze();
  const bad = res.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(bad.map((v) => v.id)).toEqual([]);
});
