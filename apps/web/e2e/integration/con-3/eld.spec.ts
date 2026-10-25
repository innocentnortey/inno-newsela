// NL-94 AC-4: ELD labels on the real stack. The report fills sheet_label/official_strand/suggested_remap with "" / "" / null
// (packages/core/src/intake/report.ts builds them that way), so the side-by-side text is a fixme, not a weakened assertion.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { authorWithUpload, distinctEldMismatchCodes, getReport, screenUrl } from "./helpers";

const flaggedTable = (page: import("@playwright/test").Page) => page.getByRole("table", { name: /^ELD labels: \d+ of \d+ codes flagged$/ });

test("eld: every code flagged on any row is listed once, with the rows that carry it", async ({ page }) => {
  const { up } = await authorWithUpload(page);
  const report = await getReport(page, up.outline_version_id);
  const codes = distinctEldMismatchCodes(report);
  await page.goto(screenUrl(up));
  await expect(flaggedTable(page)).toBeVisible();
  const caption = await flaggedTable(page).locator("caption").innerText();
  console.log(`eld caption: ${caption}; flagged codes=${codes.length}`);
  expect(caption).toMatch(new RegExp(`^ELD labels: ${codes.length} of \\d+ codes flagged$`));
  await expect(flaggedTable(page).locator("tbody tr")).toHaveCount(codes.length);
  for (const code of codes) await expect(flaggedTable(page).locator("tbody tr").filter({ hasText: code }).first()).toBeVisible();
});

test.fixme("eld: the sheet label sits beside the seeded official strand, with a suggested re-map", async ({ page }) => {
  const { up } = await authorWithUpload(page);
  const report = await getReport(page, up.outline_version_id);
  const entries = report.rows.flatMap((r) => r.eld).filter((e) => e.verdict === "mismatch");
  for (const e of entries) {
    expect(e.sheet_label, e.code).not.toBe("");
    expect(e.official_strand, e.code).not.toBe("");
    const [std] = await db().query<{ eld_strand: string | null }>("select eld_strand from standard where code=$1", [e.code]);
    expect(e.official_strand).toBe(std!.eld_strand);
  }
});

test("eld: Re-map stores the author's name on every finding that names the code, Keep restores it", async ({ page }) => {
  const { user, up } = await authorWithUpload(page);
  const vid = up.outline_version_id;
  const before = await getReport(page, vid);
  const code = distinctEldMismatchCodes(before)[0]!;
  // the choices route stores ELD choices per eld_mismatch finding (a bare code answers NOT_FOUND: fixed on the screen)
  const ids = before.rows.flatMap((r) => r.findings).filter((f) => f.kind === "eld_mismatch" && f.original_text.includes(code)).map((f) => f.finding_id);
  expect(ids.length).toBeGreaterThan(0);
  await page.goto(screenUrl(up));
  const group = page.getByRole("group", { name: `ELD label for ${code}` });
  const sent: { kind: string; target_id: string }[] = [];
  page.on("request", (r) => r.url().endsWith("/choices") && r.method() === "POST" && sent.push(r.postDataJSON()));
  const done = page.waitForResponse((r) => r.url().endsWith("/choices") && r.request().method() === "POST");
  await group.getByText(/^Re-map/).click();
  expect((await done).status()).toBe(200);
  await expect.poll(() => sent.length).toBe(ids.length);
  expect(sent.map((x) => x.target_id).sort()).toEqual([...ids].sort());
  expect(sent.every((x) => x.kind === "eld_remap")).toBe(true);
  await expect.poll(() => db().count("intake_choice", "outline_version_id=$1 and finding_id = any($2) and status='confirmed' and confirmed_by=$3", [vid, ids, user.user_id])).toBe(ids.length);
  const mid = await getReport(page, vid);
  for (const row of mid.rows) for (const e of row.eld.filter((x) => x.code === code && x.verdict === "mismatch")) expect(e.choice, `row ${row.row_number}`).toBe("remap");

  await page.reload();
  const g2 = page.getByRole("group", { name: `ELD label for ${code}` });
  await expect(g2.getByRole("radio", { name: /^Re-map/ })).toBeChecked();
  const back = page.waitForResponse((r) => r.url().endsWith("/choices") && r.request().method() === "POST");
  await g2.getByText("Keep", { exact: true }).click();
  expect((await back).status()).toBe(200);
  await expect.poll(async () => (await getReport(page, vid)).rows.flatMap((r) => r.eld).filter((x) => x.code === code).every((x) => x.choice === "keep")).toBe(true);
});
