// NL-100 AC-8 (GR-16): every role reads SCR-9 and SCR-16; no replace-writers phrasing; a history of an unknown lesson shows the shared not-found state.
import { expect, test } from "@playwright/test";
import { bannedIn } from "../support/copy-rules";
import { signInAs, type Role } from "../support/users";
import { blockStartReview, scr16, scr9, waitForLesson } from "./helpers";
import { seed } from "./seed";

for (const role of ["author", "reviewer", "approver"] as Role[]) {
  test(`roles-and-copy: ${role} reads the lesson and its versions, no banned phrase`, async ({
    page,
  }) => {
    const s = await seed();
    await signInAs(page, role);
    await blockStartReview(page); // a reviewer's page open would otherwise start the review (see helpers.ts)
    const lesson = await page.goto(scr9(s.lessons.wp1));
    expect(lesson!.status()).toBe(200);
    await waitForLesson(page);
    await expect(
      page.getByRole("heading", { level: 1, name: /The Lightning Thief/ }),
    ).toBeVisible();
    expect(
      bannedIn(await page.evaluate(() => document.body.innerText)),
    ).toEqual([]);

    const hist = await page.goto(scr16(s.lessons.reopened));
    expect(hist!.status()).toBe(200);
    await expect(page.getByRole("list", { name: "Versions" })).toBeVisible();
    expect(
      bannedIn(await page.evaluate(() => document.body.innerText)),
    ).toEqual([]);
  });
}

test("roles-and-copy: the version page of an unknown lesson shows the shared not-found state", async ({
  page,
}) => {
  await seed();
  await signInAs(page, "approver");
  await page.goto(scr16("G6.U4.L40"));
  await expect(
    page.getByText("There is no Lesson 40 in Grade 6 · Unit 4"),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to the board" }),
  ).toBeVisible();
  expect(bannedIn(await page.evaluate(() => document.body.innerText))).toEqual(
    [],
  );
});
