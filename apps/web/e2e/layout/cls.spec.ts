import { test, type Page } from "@playwright/test";
import { signInAs } from "../../src/test-utils/sign-in-as";
import { stubApproval } from "../approval/stubs";
import { passPageThrough, serveLesson } from "../workspace-read/serve";

// Recorded, not gated: layout shift depends on machine load. Run with E2E_CLS=1 (low load).
test.skip(!process.env.E2E_CLS, "CLS is measured at low load only: set E2E_CLS=1");

async function observe(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: { v: number; n: string[] }[] };
    w.__cls = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries() as unknown as { value: number; hadRecentInput: boolean; sources: { node?: Element }[] }[])
        if (!e.hadRecentInput)
          w.__cls.push({ v: e.value, n: e.sources.map((s) => { const r = s as unknown as { previousRect: DOMRect; currentRect: DOMRect }; return (s.node ? `${s.node.tagName}.${String(s.node.getAttribute("class")).slice(0, 50)}` : "?") + ` ${Math.round(r.previousRect.y)}+${Math.round(r.previousRect.height)} -> ${Math.round(r.currentRect.y)}+${Math.round(r.currentRect.height)}`; }) });
    }).observe({ type: "layout-shift", buffered: true });
  });
}
async function total(page: Page, label: string) {
  await page.waitForTimeout(1500);
  const entries = await page.evaluate(() => (window as unknown as { __cls: { v: number; n: string[] }[] }).__cls);
  const sum = entries.reduce((a, e) => a + e.v, 0);
  console.log(`CLS ${label}: ${sum.toFixed(4)}`, JSON.stringify(entries));
  return sum;
}

test("layout shift SCR-9 under 0.1", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await observe(page);
  await signInAs(page, "author");
  await serveLesson(page, { delayMs: 600 });
  await passPageThrough(page);
  await page.goto("/units/g6-u4/lessons/L4");
  await page.locator("h1").first().waitFor();
  const s = await total(page, "SCR-9");
  test.expect(s).toBeLessThan(0.1);
});

test("layout shift SCR-14 under 0.1", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await observe(page);
  await signInAs(page, "approver");
  const ctl = await stubApproval(page);
  ctl.issuesDelayMs = 800;
  await page.goto("/units/g6-u4/lessons/L5/approve");
  await page.getByRole("heading", { name: "Checklist" }).waitFor();
  const s = await total(page, "SCR-14");
  test.expect(s).toBeLessThan(0.1);
});
