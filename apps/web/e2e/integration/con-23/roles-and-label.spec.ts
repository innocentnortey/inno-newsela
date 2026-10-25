// NL-102 AC-7 (frozen): only approvers export; others are refused with nothing written; stored text renders as text.
import { expect, test, request as pwRequest } from "@playwright/test";
import { getStack } from "../support/real-stack";
import { as, countAll, createExport, download, exportUrl, exportsApi, lessonState, origin, type Created } from "./helpers";
import { approverUser, ensureSeeded, freshUnit, seedApproved } from "./seed";

test.setTimeout(300_000);
const MARKUP = "<img src=x onerror=window.__xss=1>";

for (const role of ["reviewer", "author"] as const) {
  test(`roles-and-label: ${role} sees no export button and is refused by the route`, async ({ page }) => {
    await ensureSeeded();
    const unit = await freshUnit();
    const approver = await approverUser();
    const l = await seedApproved({ unit, number: 1, approver_id: approver.user_id });
    await as(page, role);
    await page.goto(exportUrl(unit.unit_key));
    await expect(page.getByText("Only approvers can export.").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Create export" })).toHaveCount(0);
    const before = { ...(await countAll()), state: await lessonState(l.lesson_id) };
    const res = await createExport(page, unit.unit_key);
    expect(res.status()).toBe(403);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("ROLE_FORBIDDEN");
    expect({ ...(await countAll()), state: await lessonState(l.lesson_id) }).toEqual(before);
  });
}

test("roles-and-label: no session gets 401; an approver sees the screen title", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  const approver = await approverUser();
  await seedApproved({ unit, number: 1, approver_id: approver.user_id });
  const anon = await pwRequest.newContext({ baseURL: getStack().baseURL });
  const before = await countAll();
  const res = await anon.post(exportsApi(unit.unit_key), { headers: origin() });
  expect(res.status()).toBe(401);
  expect(await countAll()).toEqual(before);
  await anon.dispose();
  await as(page, approver);
  await page.goto(exportUrl(unit.unit_key));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Export (no live integration)");
});

test("roles-and-label: stored markup is returned as JSON text and never runs on the screen", async ({ page }) => {
  await ensureSeeded();
  const unit = await freshUnit();
  const approver = await approverUser();
  await seedApproved({ unit, number: 1, approver_id: approver.user_id, text: MARKUP });
  await as(page, approver);
  const c = (await (await createExport(page, unit.unit_key)).json()) as Created;
  const file = await download(page, c.export_id);
  expect(file.headers["content-type"]).toContain("application/json");
  expect(JSON.parse(file.text).lessons[0].lesson.sections).toBeTruthy();
  expect(file.text).toContain(JSON.stringify(MARKUP).slice(1, -1));
  await page.goto(exportUrl(unit.unit_key));
  await expect(page.getByRole("button", { name: "Download" })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  await expect(page.locator('img[src="x"]')).toHaveCount(0);
});
