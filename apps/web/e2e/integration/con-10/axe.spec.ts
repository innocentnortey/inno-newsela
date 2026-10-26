// NL-104 AC-9: every SCR-19 state reached with real data, 0 serious and 0 critical axe violations, 2 viewports x 2 themes.
import { expect, test, type Page } from "@playwright/test";
import { axeScan, setTheme, THEMES, VIEWPORTS } from "../support/axe";
import { startCutStack } from "./cut-stack";
import { COPY, openQuality, QUALITY_URL } from "./helpers";
import { cleanupGlobal, seedAll, UNITS } from "./seed";
import { signInAs } from "../support/users";

let ids: Awaited<ReturnType<typeof seedAll>>;
let cut: Awaited<ReturnType<typeof startCutStack>> | undefined;
test.beforeAll(async () => { ids = await seedAll(); });
test.afterAll(async () => { await cut?.stop(); await cleanupGlobal(ids); });

type Setup = (page: Page) => Promise<() => void>;
const noop = () => undefined;
const rev = () => ids.reviewers[0]!;

const STATES: Record<string, Setup> = {
  populated: async (page) => { await openQuality(page, rev(), UNITS.main.unit_key); await expect(page.locator("main li").first()).toBeVisible(); return noop; },
  "one-reviewer": async (page) => { await openQuality(page, rev(), UNITS.main.unit_key); await expect(page.getByLabel(COPY.context)).toContainText("one reviewer"); return noop; },
  unmeasured: async (page) => { await openQuality(page, rev(), UNITS.many.unit_key); await expect(page.getByText(COPY.empty).first()).toBeVisible(); return noop; },
  empty: async (page) => { await openQuality(page, rev(), UNITS.empty.unit_key); await expect(page.getByText(COPY.empty)).toBeVisible(); return noop; },
  loading: async (page) => {
    await signInAs(page, rev());
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await page.route("**/api/units/*/metrics", async (route) => { await gate; await route.fallback(); });
    await page.goto(QUALITY_URL(UNITS.main.unit_key));
    await expect(page.getByText("Loading unit quality")).toBeAttached();
    return () => release();
  },
  "cant-load": async (page) => {
    await signInAs(page, rev());
    await page.route("**/api/units/*/metrics", (r) => r.abort());
    await page.goto(QUALITY_URL(UNITS.main.unit_key));
    await expect(page.getByText(COPY.cantLoad)).toBeVisible();
    await expect(page.getByRole("button", { name: "Retry" })).toBeVisible();
    return noop;
  },
  "cut-6-not-found": async (page) => {
    cut ??= await startCutStack();
    const base = cut.baseURL;
    await page.context().clearCookies();
    await page.goto(`${base}/sign-in`);
    await page.getByLabel("Staff email").fill(rev().email);
    await page.getByLabel("Password").fill(rev().password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).not.toHaveURL(/\/sign-in/);
    await page.goto(`${base}${QUALITY_URL(UNITS.main.unit_key)}`);
    await expect(page.getByText(COPY.notFound)).toBeVisible();
    return noop;
  },
};

for (const [state, setup] of Object.entries(STATES)) {
  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      test(`${state} ${vp.width}x${vp.height} ${theme} @axe`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        const done = await setup(page);
        await setTheme(page, theme);
        const r = await axeScan(page);
        console.log(`axe ${state} ${vp.width}x${vp.height} ${theme}: ${r.serious} serious / ${r.critical} critical`);
        expect(r.violations, `${state} ${vp.width} ${theme}`).toEqual([]);
        done();
      });
    }
  }
}
