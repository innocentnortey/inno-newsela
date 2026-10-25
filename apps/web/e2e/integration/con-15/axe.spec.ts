// NL-113 AC-13: axe on the SCR-10 states reachable on the real backend, 2 viewports x 2 themes, 0 serious and 0 critical.
import { expect, test } from "@playwright/test";
import { axeScan, matrix, setTheme } from "../support/axe";
import { stopLive } from "../con-13/stack";
import { reach, type State } from "../con-13/states";

test.afterAll(stopLive);

const STATES: State[] = ["scr10-open", "scr10-error", "scr10-success"];
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
