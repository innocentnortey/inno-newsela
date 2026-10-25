// NL-114 AC-11: axe on every SCR-12 and SCR-9 state this ticket reaches on the real backend, 2 viewports x 2 themes.
import { expect, test } from "@playwright/test";
import { axeScan, matrix, setTheme } from "../support/axe";
import { stopStack16 } from "./helpers";
import { reach, STATES } from "./states";

test.setTimeout(240_000);
test.afterAll(stopStack16);

for (const state of STATES) {
  test(`${state} 1280+390 light+dark @axe`, async ({ browser }) => {
    const r = await reach(browser, state);
    try {
      await matrix(r.s.page, async ({ theme, viewport }) => {
        await setTheme(r.s.page, theme);
        const res = await axeScan(r.s.page);
        console.log(`axe ${state} ${viewport.width} ${theme}: serious=${res.serious} critical=${res.critical}`);
        expect(res.violations, `${state} ${viewport.width} ${theme}`).toEqual([]);
        expect(res.serious + res.critical).toBe(0);
      });
    } finally {
      await r.close();
    }
  });
}
