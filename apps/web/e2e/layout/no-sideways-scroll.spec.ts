import { expect, test, type Page } from "@playwright/test";
import { signInAs } from "../../src/test-utils/sign-in-as";
import { installReportMock } from "../validation-report/report-mock";
import { issuedShapeReport } from "../validation-report/fixtures";
import { passPageThrough, serveLesson } from "../workspace-read/serve";
import { COVERAGE_URL, matrix, serveCoverage } from "../coverage/fixtures";
import { overflowProbe } from "./overflow-probe";

const L4 = "/units/g6-u4/lessons/L4";
const screens: { id: string; setup: (p: Page) => Promise<void>; url: string }[] = [
  { id: "SCR-3", setup: async () => {}, url: "/units/g6-u4/outlines/new" },
  { id: "SCR-4/5", setup: async (p) => void (await installReportMock(p, { report: issuedShapeReport() })), url: "/units/g6-u4/outlines/1" },
  {
    id: "SCR-9",
    setup: async (p) => {
      await serveLesson(p);
      await passPageThrough(p);
    },
    url: L4,
  },
  {
    id: "SCR-10",
    setup: async (p) => {
      await serveLesson(p);
      await passPageThrough(p);
    },
    url: `${L4}?tab=standards`,
  },
  {
    id: "SCR-11",
    setup: async (p) => {
      await serveLesson(p);
      await passPageThrough(p);
    },
    url: `${L4}?issue=iss-4-1`,
  },
  { id: "SCR-18", setup: (p) => serveCoverage(p, matrix()), url: COVERAGE_URL },
];

for (const s of screens) {
  for (const [w, h] of [[1280, 800], [390, 844]] as const) {
    for (const theme of ["light", "dark"] as const) {
      test(`no sideways scroll ${s.id} ${w} ${theme}`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: h });
        await signInAs(page, "author");
        await s.setup(page);
        await page.goto(s.url);
        await page.locator("h1").first().waitFor();
        await page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(500);
        const r = await overflowProbe(page);
        if (r.overflow > 0) console.log(`PROBE ${s.id} ${w} ${theme}: ${r.overflow}px`, JSON.stringify(r.widest));
        expect(r.overflow).toBeLessThanOrEqual(0);
        // A wide table scrolls inside its own region box rather than widening the page.
        for (const region of await page.locator('[role="region"][tabindex="0"]').all()) {
          const box = await region.boundingBox();
          if (box) expect(box.x + box.width).toBeLessThanOrEqual(w + 1);
        }
      });
    }
  }
}
