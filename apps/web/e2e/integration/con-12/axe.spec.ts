// NL-101 AC-10: axe on the SCR-9 editor states, 2 viewports x 2 themes, 0 serious and 0 critical.
import { expect, test } from "@playwright/test";
import { axeScan, matrix, setTheme } from "../support/axe";
import { closeSeedPool } from "./seed";
import { reach, type State } from "./states";

test.afterAll(closeSeedPool);

const STATES: State[] = ["connecting", "synced", "saving", "stored", "disconnected", "read-only", "refused-edit"];
for (const state of STATES) {
  test(`axe ${state} 1280+390 light+dark @axe`, async ({ browser }) => {
    const r = await reach(browser, state);
    try {
      await matrix(r.page, async ({ theme, viewport }) => {
        await setTheme(r.page, theme);
        const res = await axeScan(r.page);
        console.log(`axe ${state} ${viewport.width} ${theme}: serious=${res.serious} critical=${res.critical}`);
        expect(res.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
        expect(res.serious + res.critical).toBe(0);
      });
    } finally {
      await r.close();
    }
  });
}
