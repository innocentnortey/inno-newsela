// NL-114 AC-12: screenshots of SCR-12 (main and an error state) and the SCR-9 regenerate dialog, 1280 and 390, light and dark.
// Written with page.screenshot because the real config's snapshotPathTemplate is fixed to con-1; no baseline diffing.
import { mkdirSync } from "node:fs";
import { test } from "@playwright/test";
import { matrix, setTheme } from "../support/axe";
import { SHOTS, stopStack16 } from "./helpers";
import { reach, type State } from "./states";

test.setTimeout(240_000);
test.afterAll(stopStack16);

const SHOT_STATES: State[] = ["scr12-ready", "scr12-collab-down", "scr12-failed", "scr9-dialog"];
for (const state of SHOT_STATES) {
  test(`${state} screenshots @visual`, async ({ browser }) => {
    mkdirSync(SHOTS, { recursive: true });
    const r = await reach(browser, state);
    try {
      await matrix(r.s.page, async ({ theme, viewport }) => {
        await setTheme(r.s.page, theme);
        await r.s.page.evaluate(() => document.fonts.ready);
        await r.s.page.screenshot({ path: `${SHOTS}/${state}-${viewport.width}-${theme}.png`, fullPage: true });
      });
    } finally {
      await r.close();
    }
  });
}
