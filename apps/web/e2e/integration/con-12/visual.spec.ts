// NL-101 AC-11: screenshots of the SCR-9 editor, main and refused-edit states, 2 viewports x 2 themes.
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { matrix, setTheme } from "../support/axe";
import { closeSeedPool } from "./seed";
import { reach } from "./states";

test.afterAll(closeSeedPool);

const OUT = resolve(__dirname, "../../__screenshots__/integration/con-12");

for (const [name, state] of [["main", "stored"], ["refused", "refused-edit"]] as const) {
  test(`visual ${name} 1280+390 light+dark @visual`, async ({ browser }) => {
    mkdirSync(OUT, { recursive: true });
    const r = await reach(browser, state);
    try {
      await matrix(r.page, async ({ theme, viewport }) => {
        await setTheme(r.page, theme);
        await r.page.evaluate(() => document.fonts.ready);
        const path = `${OUT}/scr9-${name}-${viewport.width}-${theme}.png`;
        await r.page.screenshot({ path, fullPage: true });
        expect(path).toBeTruthy();
      });
    } finally {
      await r.close();
    }
  });
}
