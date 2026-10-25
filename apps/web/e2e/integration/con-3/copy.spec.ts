// NL-94 AC-9: no phrase on SCR-4 frames the tool as replacing writers (GR-16).
import { expect, test } from "@playwright/test";
import { bannedIn } from "../support/copy-rules";
import { createUser, signInAs } from "../support/users";
import { authorWithUpload, confirmAll, COPY, screenUrl } from "./helpers";

test("copy: the banned-phrase check catches a banned sentence", () => {
  expect(bannedIn("AI replaces writers")).not.toEqual([]);
});

test("copy: SCR-4 main, all-confirmed and reviewer views carry no banned phrase", async ({ page, browser }) => {
  const { up } = await authorWithUpload(page);
  await page.goto(screenUrl(up));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(bannedIn(await page.locator("body").innerText())).toEqual([]);
  await confirmAll(page, up);
  await expect(page.getByText(COPY.allConfirmed)).toBeVisible();
  expect(bannedIn(await page.locator("body").innerText())).toEqual([]);

  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  await signInAs(p2, await createUser("reviewer"));
  await p2.goto(screenUrl(up));
  await expect(p2.getByText(/You're viewing as a reviewer/)).toBeVisible();
  expect(bannedIn(await p2.locator("body").innerText())).toEqual([]);
  await ctx.close();
});
