// NL-90 support: axe scan + theme/viewport matrix. Theme switch copied from e2e/sign-in/sign-in.spec.ts (data-theme attribute).
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
type AxePage = ConstructorParameters<typeof AxeBuilder>[0]["page"];

export const THEMES = ["light", "dark"] as const;
export const VIEWPORTS = [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
] as const;

export async function axeScan(page: Page): Promise<{ serious: number; critical: number; violations: unknown[] }> {
  await page.evaluate(() => document.fonts.ready);
  const res = await new AxeBuilder({ page: page as unknown as AxePage }).withTags(TAGS).analyze();
  const serious = res.violations.filter((v) => v.impact === "serious");
  const critical = res.violations.filter((v) => v.impact === "critical");
  return {
    serious: serious.length,
    critical: critical.length,
    violations: [...serious, ...critical].map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  };
}

export async function setTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
}

export async function matrix(
  page: Page,
  run: (ctx: { theme: "light" | "dark"; viewport: { width: number; height: number } }) => Promise<void>,
): Promise<void> {
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await run({ theme, viewport: { width: viewport.width, height: viewport.height } });
    }
  }
}
