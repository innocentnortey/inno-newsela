// NL-93 AC-9: SCR-2 and SCR-3 carry no banned phrase; cell text is shown as plain text.
import { expect, test } from "@playwright/test";
import { BANNED_PHRASES } from "../support/copy-rules";
import { createUser, signInAs } from "../support/users";
import { ISSUED_XLSX, markupCsv, pdfRenamedXlsx } from "./fixtures/files";
import { ensureSeeded, resetIntake } from "./support/seed-and-reset";
import { chooseAndUpload, openUpload } from "./support/upload";

test.beforeAll(ensureSeeded);
test.beforeEach(resetIntake);

test("copy: SCR-2 and SCR-3 carry no banned phrase and cell text is plain", async ({
  page,
}) => {
  let dialogs = 0;
  page.on("dialog", async (d) => {
    dialogs++;
    await d.dismiss();
  });
  await signInAs(page, await createUser("author"));
  const check = async (label: string) => {
    const text = (await page.locator("body").innerText()).toLowerCase();
    for (const p of BANNED_PHRASES)
      expect(text, `${label}: ${p}`).not.toContain(p.toLowerCase());
    expect(await page.locator("img[src='x']").count()).toBe(0);
  };

  await openUpload(page);
  await check("scr3 idle");
  await chooseAndUpload(page, pdfRenamedXlsx());
  await expect(page.getByTestId("upload-error")).toBeVisible();
  await check("scr3 refusal");
  await chooseAndUpload(page, markupCsv());
  await expect(page.getByText(/version 1/).first()).toBeVisible();
  await check("scr3 success markup");
  await openUpload(page);
  await chooseAndUpload(page, ISSUED_XLSX);
  await expect(
    page.getByText(/Grade 6 · Unit 4 · version 2/).first(),
  ).toBeVisible();
  await check("scr3 second version");
  await page.goto("/units");
  await expect(page.getByRole("heading", { name: "Units" })).toBeVisible();
  await check("scr2");
  expect(dialogs).toBe(0);
});
