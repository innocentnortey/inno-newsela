// NL-94 AC-1: the issued sheet, uploaded for real, reads R-5's counts on the API and on SCR-4; rereads are byte-identical.
import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { authorWithUpload, distinctEldMismatchCodes, getReport, getReportText, screenUrl } from "./helpers";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

test("issued-counts: R-5 counts on the API and the screen, rereads byte-identical", async ({ page }) => {
  const { up } = await authorWithUpload(page);
  const audit0 = await db().count("audit_event");
  const choices0 = await db().count("intake_choice");
  const a = await getReportText(page, up.outline_version_id);
  const b = await getReportText(page, up.outline_version_id);
  expect(sha(a)).toBe(sha(b));
  expect(a).toBe(b);
  expect(await db().count("audit_event")).toBe(audit0);
  expect(await db().count("intake_choice")).toBe(choices0);
  expect(await db().count("model_call")).toBe(0);

  const r = JSON.parse(a);
  const c = r.counts;
  expect(c).toMatchObject({
    teaching_days: 47,
    unit_conflicts: 1,
    malformed_codes: 1,
    rows_with_nonexistent_code: 3,
    bad_filenames: 2,
    errors: 6, // unit conflict + malformed + 4 nonexistent_code findings (row 30 has two); the plan's "5" counted one per row
    errors_unconfirmed: 6,
  });
  expect(r.generate_allowed).toBe(false);
  const distinct = distinctEldMismatchCodes(r);
  console.log(`observed: eld findings=${c.eld_mismatches} distinct mismatch codes=${distinct.length} warnings=${c.warnings}`);
  expect(c.eld_mismatches).toBe(16);
  // Observed on the real stack: 9 codes carry a mismatch on some row (7 whole-code + PI.6.6/PI.6.7 label-level); the ticket's "7": fixme below.
  expect(distinct).toHaveLength(9);

  await page.goto(screenUrl(up));
  const card = page.locator("dl");
  await expect(card).toBeVisible();
  const val = (k: string) => card.locator("dt", { hasText: new RegExp(`^${k}$`) }).locator("xpath=following-sibling::dd[1]");
  await expect(val("Teaching days")).toHaveText("47");
  await expect(val("Errors to confirm")).toHaveText("6");
  await expect(val("Warnings")).toHaveText(String(c.warnings));
  await expect(val("ELD labels flagged")).toHaveText("9");
  await expect(val("ELD findings")).toHaveText("16");
  await expect(val("Bad filenames")).toHaveText("2");
  await expect(page.getByRole("button", { name: "Generate 47 lessons" })).toHaveAttribute("aria-disabled", "true");
});

// The old "7 ELD mismatches" wording is superseded by PD-36: 16 findings across 9 distinct codes are asserted above.
