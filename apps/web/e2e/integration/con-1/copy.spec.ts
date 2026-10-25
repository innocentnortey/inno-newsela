// NL-90 AC-7 / GR-16: no banned "AI replaces writers" phrasing on the sign-in screen or the signed-in frame.
import { expect, test } from "@playwright/test";
import { BANNED_PHRASES, bannedIn } from "../support/copy-rules";
import { signInAs } from "../support/users";

test("copy: the self-check catches a banned sample", () => {
  expect(bannedIn("AI replaces writers")).toEqual(["ai replaces", "replaces writers"]);
  expect(bannedIn("Staff review every lesson")).toEqual([]);
  expect(BANNED_PHRASES.length).toBeGreaterThan(0);
});

test("copy: /sign-in and the signed-in frame carry no banned phrase", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByLabel("Staff email")).toBeVisible();
  const signIn = await page.locator("body").innerText();
  expect(bannedIn(signIn), "banned phrase on /sign-in").toEqual([]);

  await signInAs(page, "author");
  await expect(page).toHaveURL(/\/units$/);
  const frame = await page.locator("body").innerText();
  expect(bannedIn(frame), "banned phrase on /units").toEqual([]);
});
