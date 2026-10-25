// NL-102 AC-6: concurrent creates for one unit write exactly one bundle (the per-unit advisory lock).
import { expect, test, request as pwRequest } from "@playwright/test";
import { getStack } from "../support/real-stack";
import { as, exportRows, exportsApi, origin, type Created } from "./helpers";
import { approverUser, ensureSeeded, freshUnit, seedApproved } from "./seed";

test.setTimeout(300_000);

test("serialized: parallel creates give one 201 and the rest 200 same_as_previous", async ({ page }) => {
  await ensureSeeded();
  const approver = await approverUser();
  await as(page, approver);
  const state = await page.context().storageState();

  for (const parallel of [2, 4]) {
    const unit = await freshUnit();
    await seedApproved({ unit, number: 1, approver_id: approver.user_id });
    await seedApproved({ unit, number: 2, approver_id: approver.user_id });
    const ctxs = await Promise.all(Array.from({ length: parallel }, () => pwRequest.newContext({ baseURL: getStack().baseURL, storageState: state })));
    const res = await Promise.all(ctxs.map((c) => c.post(exportsApi(unit.unit_key), { headers: origin() })));
    const bodies = await Promise.all(res.map(async (r) => ({ status: r.status(), body: (await r.json()) as Created })));
    console.log(`serialized x${parallel}: ${bodies.map((b) => b.status).join(",")}`);
    expect(bodies.filter((b) => b.status === 201)).toHaveLength(1);
    expect(bodies.filter((b) => b.status === 200)).toHaveLength(parallel - 1);
    for (const b of bodies.filter((x) => x.status === 200)) {
      expect(b.body.same_as_previous).toBe(true);
      expect(b.body.export_id).toBe(bodies.find((x) => x.status === 201)!.body.export_id);
      expect(b.body.version_number).toBe(1);
    }
    expect(await exportRows(unit.unit_id)).toHaveLength(1);
    await Promise.all(ctxs.map((c) => c.dispose()));
  }
});
