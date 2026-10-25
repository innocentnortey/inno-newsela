// NL-98 AC-5 (GR-15): no response and no page text pairs a person's name with review minutes.
import { expect, test } from "@playwright/test";
import { getJson, openBoard, walk } from "./helpers";
import { seedMainUnit, user } from "./seed";

for (const role of ["author", "reviewer", "approver"] as const) {
  test(`no-minutes-by-name: ${role} sees no object with a name field and a minutes field, and no minutes beside a name`, async ({ page }) => {
    const seeded = await seedMainUnit();
    const me = role === "reviewer" ? seeded.reviewers[0]! : await user(role, `role-${role}`);
    await openBoard(page, me);
    let offending = 0;
    let objects = 0;
    for (const path of ["/api/units/G6.U4/board", "/api/units/G6.U4/metrics"]) {
      const { status, body } = await getJson(page, path);
      expect(status).toBe(200);
      walk(body, (o) => {
        objects++;
        const keys = Object.keys(o);
        if (keys.some((k) => /name|reviewer|by/i.test(k)) && keys.some((k) => /minute/i.test(k))) offending++;
      });
    }
    console.log(`${role}: walked ${objects} objects, ${offending} with a name field and a minutes field`);
    expect(offending).toBe(0);

    const text = await page.locator("main").innerText();
    let near = 0;
    for (const r of [...seeded.reviewers, seeded.sendBackBy]) {
      let from = 0;
      for (;;) {
        const at = text.indexOf(r.name, from);
        if (at < 0) break;
        const window = text.slice(Math.max(0, at - 40), at + r.name.length + 40);
        if (/\d+(\.\d+)?\s*(min|minutes)\b|\b(min|minutes)\s*\d+/i.test(window)) near++;
        from = at + r.name.length;
      }
    }
    console.log(`${role}: names with minutes within 40 characters: ${near}`);
    expect(near).toBe(0);
  });
}
