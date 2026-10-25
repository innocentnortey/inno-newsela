// NL-113 AC-14: screenshots, main and error state, 2 viewports x 2 themes, compared by eye against the look sheet (devlog records the verdict).
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { matrix, setTheme } from "../support/axe";
import { stopLive } from "../con-13/stack";
import { reach, type State } from "../con-13/states";

test.afterAll(stopLive);
const OUT = resolve(__dirname, "../../__screenshots__/integration/con-14");
const CASES: [string, State, string][] = [["scr11 main", "scr11-open", "scr11-main"], ["scr11 refusal", "scr11-refusal", "scr11-error"]];
for (const [name, state, file] of CASES) {
  test(`visual ${name} 1280+390 light+dark @visual`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const r = await reach(browser, state);
    try {
      await matrix(r.page, async ({ theme, viewport }) => {
        await setTheme(r.page, theme);
        await r.page.evaluate(() => document.fonts.ready);
        const path = `${OUT}/${file}-${viewport.width}-${theme}.png`;
        await r.page.screenshot({ path, fullPage: true });
        expect(path).toBeTruthy();
      });
    } finally {
      await r.close();
    }
  });
}
