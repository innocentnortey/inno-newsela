// NL-94 AC-5: the SYN-1 cell is text everywhere: response, screen, DOM.
import { expect, test } from "@playwright/test";
import { authorWithUpload, getReport, markupCsv, reportPath, screenUrl } from "./helpers";

test("markup-is-text: the injected cell is flagged, kept as content and never becomes markup", async ({ page }) => {
  const bytes = markupCsv();
  expect(bytes.toString("utf8")).toContain("onerror");
  const dialogs: string[] = [];
  page.on("dialog", (d) => {
    dialogs.push(d.message());
    void d.dismiss();
  });
  const { up } = await authorWithUpload(page, "syn1-injection-row09.csv", bytes);
  const res = await page.request.get(reportPath(up.outline_version_id));
  expect(await res.text()).toContain("<img src=x onerror=");
  const row9 = (await getReport(page, up.outline_version_id)).rows.find((r) => r.row_number === 9)!;
  expect(row9.findings.some((f) => f.kind === "instruction_shaped")).toBe(true);
  expect(row9.segments.some((s) => s.kind === "content" && s.text.includes("<img src=x"))).toBe(true);

  await page.goto(screenUrl(up));
  await expect(page.getByText("Instruction-shaped text, kept as content").first()).toBeVisible();
  await expect(page.getByText("<img src=x", { exact: false }).first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __pwned?: unknown }).__pwned)).toBeUndefined();
  expect(dialogs).toEqual([]);
  expect(await page.locator("main img").count()).toBe(0);
});
