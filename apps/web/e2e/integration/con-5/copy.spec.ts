// NL-95 AC-8: dialog text and every server banner avoid the banned phrases; guidance text is shown as plain text.
import { expect, test } from "@playwright/test";
import { bannedIn } from "../support/copy-rules";
import { getStack } from "../support/real-stack";
import { authorWithConfirmedUpload, COPY, insertSpend, releaseSpend, openDialog, revertOne, screenUrl } from "./helpers";

test.afterEach(releaseSpend);

test("copy: the banned-phrase check catches a bad phrase", () => {
  expect(bannedIn("AI replaces writers")).not.toEqual([]);
});

test("copy: dialog text and each server banner are free of banned phrases", async ({ page }) => {
  const { user, up } = await authorWithConfirmedUpload(page);
  const text = async (d: ReturnType<typeof page.getByRole>) => d.innerText();
  const dialog = await openDialog(page, up);
  expect(bannedIn(await text(dialog)), "main state with prompt line").toEqual([]);

  await dialog.getByRole("textbox", { name: "Rows" }).fill("99");
  await dialog.getByRole("button", { name: COPY.startRun }).click();
  await expect(dialog.getByText(/not part of|isn't|aren't|not a/i).first()).toBeVisible();
  expect(bannedIn(await text(dialog)), "rows-invalid").toEqual([]);
  await dialog.getByRole("textbox", { name: "Rows" }).fill("8, 9, 25");

  await insertSpend(user.user_id, 20);
  await dialog.getByRole("button", { name: COPY.startRun }).click();
  await expect(dialog.getByText(COPY.dayCap("6.00"))).toBeVisible();
  expect(bannedIn(await text(dialog)), "DAY_CAP_REACHED").toEqual([]);

  await page.reload();
  const d2 = await openDialog(page, up);
  await revertOne(page, up.outline_version_id);
  await d2.getByRole("button", { name: COPY.startRun }).click();
  await expect(d2.getByText(COPY.incomplete(1))).toBeVisible();
  expect(bannedIn(await text(d2)), "VALIDATION_INCOMPLETE").toEqual([]);
});

test("copy: guidance text with markup is plain text in the dialog", async ({ page }) => {
  const { up } = await authorWithConfirmedUpload(page);
  const cur = (await (await page.request.get("/api/prompt-versions")).json()) as { current_prompt_version_id: string };
  const save = await page.request.post("/api/prompt-versions", {
    data: { base_version_id: cur.current_prompt_version_id, guidance_text: '<img src=x onerror="window.__pwned=1">', reason: "e2e markup" },
    headers: { Origin: getStack().baseURL },
  });
  expect(save.status(), await save.text()).toBe(201);
  let dialogEvents = 0;
  page.on("dialog", (d) => {
    dialogEvents++;
    void d.dismiss();
  });
  await page.goto(screenUrl(up));
  await page.getByRole("button", { name: COPY.generate }).click();
  const dialog = page.getByRole("dialog", { name: COPY.dialogTitle });
  await expect(dialog.getByRole("button", { name: COPY.startRun })).toBeEnabled();
  expect(await dialog.locator("img").count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  expect(dialogEvents).toBe(0);
});
