// NL-103 AC-2 (WF-20): the three refusals of saveGuidance leave no version and no audit row; a stale save keeps the typed text.
import { expect, test } from "@playwright/test";
import { ERROR_STATUS } from "../../../src/server/http/error-status.generated";
import { getStack } from "../support/real-stack";
import {
  auditCount, authorSession, createAuthor, currentNumber, errorOf, getPrompts, marker, openGuidance, pvCount, saveApi, saveViaUi,
} from "./helpers";
import { signInAs } from "../support/users";

test.describe.configure({ mode: "serial" });
const SAVE = "prompt.save_guidance";

test("refusals: empty reason", async ({ page }) => {
  await authorSession(page);
  const p = await getPrompts(page);
  const pv0 = await pvCount();
  const au0 = await auditCount(SAVE);
  await openGuidance(page);
  await page.getByLabel("Reason").fill("   ");
  await page.getByRole("button", { name: "Save as new version" }).click();
  await expect(page.getByText("A version needs a reason.")).toBeVisible();
  const res = await saveApi(page, { base_version_id: p.current_prompt_version_id, guidance_text: `${marker("empty")} text`, reason: "  " });
  expect(res.status()).toBe(ERROR_STATUS.REASON_REQUIRED);
  expect((await errorOf(res)).code).toBe("REASON_REQUIRED");
  expect(await pvCount()).toBe(pv0);
  expect(await auditCount(SAVE)).toBe(au0);
});

test("refusals: stale base", async ({ browser }) => {
  const baseURL = getStack().baseURL;
  const ctxA = await browser.newContext({ baseURL });
  const ctxB = await browser.newContext({ baseURL });
  try {
    const a = await ctxA.newPage();
    const b = await ctxB.newPage();
    await authorSession(a);
    await signInAs(b, await createAuthor());
    const p0 = await getPrompts(a);
    const n = currentNumber(p0);
    const vN = p0.current_prompt_version_id;
    await openGuidance(a);
    await openGuidance(b);

    const pv0 = await pvCount();
    const au0 = await auditCount(SAVE);
    const textA = `A text ${marker("S")}`;
    await saveViaUi(a, textA, "e2e A reason");
    await expect(a.getByRole("status").filter({ hasText: `Guidance v${n + 1} saved.` })).toBeVisible();
    const vA = (await getPrompts(a)).current_prompt_version_id;
    expect(await pvCount()).toBe(pv0 + 1);

    // a direct stale POST names the newer version
    const stale = await saveApi(b, { base_version_id: vN, guidance_text: "direct stale", reason: "e2e direct" });
    expect(stale.status()).toBe(ERROR_STATUS.STALE_BASE);
    const err = await errorOf(stale);
    expect(err.code).toBe("STALE_BASE");
    expect(err.details["latest_version_id"]).toBe(vA);
    expect(await pvCount()).toBe(pv0 + 1);

    const textB = `B text ${marker("S")}`;
    await b.getByLabel("Guidance text").fill(textB);
    await b.getByLabel("Reason").fill("e2e B reason");
    await b.getByRole("button", { name: "Save as new version" }).click();
    await expect(b.getByText("Someone saved a newer version first. Review it below, then save again.")).toBeVisible();
    await expect(b).toHaveURL(new RegExp(`version=${encodeURIComponent(vA)}`));
    await expect(b.getByRole("heading", { name: `Guidance v${n + 1}` })).toBeVisible();
    await expect(b.getByRole("heading", { name: `Changes from v${n}` })).toBeVisible();
    await expect(b.locator("[data-diff='add']").filter({ hasText: textA })).toBeVisible();
    await expect(b.getByLabel("Guidance text")).toHaveValue(textB);
    await expect(b.getByLabel("Reason")).toHaveValue("e2e B reason");
    expect(await pvCount(), "the refused save wrote no version").toBe(pv0 + 1);
    expect(await auditCount(SAVE), "the refused save wrote no audit row").toBe(au0 + 1);

    await b.getByRole("button", { name: "Save as new version" }).click();
    await expect(b.getByRole("status").filter({ hasText: `Guidance v${n + 2} saved. Runs already going keep v${n + 1}.` })).toBeVisible();
    expect(await pvCount()).toBe(pv0 + 2);
    expect(await auditCount(SAVE)).toBe(au0 + 2);
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

test("refusals: over 8000 characters", async ({ page }) => {
  await authorSession(page);
  const p = await getPrompts(page);
  const pv0 = await pvCount();
  const au0 = await auditCount(SAVE);
  const res = await saveApi(page, { base_version_id: p.current_prompt_version_id, guidance_text: "x".repeat(8001), reason: "e2e long" });
  expect(res.status()).toBe(ERROR_STATUS.INVALID_REQUEST);
  const err = await errorOf(res);
  expect(err.code).toBe("INVALID_REQUEST");
  expect(JSON.stringify(err.details["fields"])).toContain("guidance_text");
  expect(await pvCount()).toBe(pv0);
  expect(await auditCount(SAVE)).toBe(au0);
  await openGuidance(page);
  const box = page.getByLabel("Guidance text");
  expect(await box.getAttribute("maxlength")).toBe("8000");
  await box.fill("y".repeat(7990));
  await expect(page.getByText("10 characters left")).toBeVisible();
});
