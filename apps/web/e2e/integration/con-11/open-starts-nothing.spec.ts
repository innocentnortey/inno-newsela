// NL-100 AC-3 (R-33, CON-G5): opening a draft lesson changes nothing; start_review only for the reviewer; both id forms agree.
import { expect, test } from "@playwright/test";
import { signInAs, type Role } from "../support/users";
import { getLesson, readCounts, scr9, waitForLesson } from "./helpers";
import { seed } from "./seed";

// Reviewer: the API open is checked here. The reviewer's PAGE open is test.fixme below: SCR-9 posts start_review by itself (NEEDS-DECISION).
for (const role of ["reviewer", "author", "approver"] as Role[]) {
  test(`open-starts-nothing: ${role} opens the draft twice (page and API), nothing is written`, async ({
    page,
  }) => {
    test.fixme(
      role === "reviewer",
      "SCR-9 auto-posts start_review for a reviewer's page open (action-bar.tsx); contract text says opening never starts a review. Needs Innocent's ruling.",
    );
    const s = await seed();
    await signInAs(page, role);
    const before = await readCounts();
    for (let i = 0; i < 2; i++) {
      await page.goto(scr9(s.lessons.wp1));
      await waitForLesson(page);
      expect((await getLesson(page, s.lessons.wp1)).status).toBe(200);
    }
    await page.waitForTimeout(1500); // let any background call a page might make land before counting
    expect(await readCounts()).toEqual(before);
    const { body } = await getLesson(page, s.lessons.wp1);
    expect(body.state).toBe("draft");
    if (role === "reviewer")
      expect(body.allowed_actions).toContain("start_review");
    else expect(body.allowed_actions).not.toContain("start_review");
  });
}

test("open-starts-nothing: reviewer's API opens alone change nothing and offer start_review", async ({
  page,
}) => {
  const s = await seed();
  await signInAs(page, "reviewer");
  const before = await readCounts();
  for (let i = 0; i < 2; i++)
    expect((await getLesson(page, s.lessons.wp1)).status).toBe(200);
  expect(await readCounts()).toEqual(before);
  const { body } = await getLesson(page, s.lessons.wp1);
  expect(body.state).toBe("draft");
  expect(body.allowed_actions).toContain("start_review");
});

test("open-starts-nothing: G6.U4.L4 and g6-u4:L4 return identical bodies", async ({
  page,
}) => {
  const s = await seed();
  await signInAs(page, "reviewer");
  const a = await getLesson(page, s.lessons.wp1);
  const b = await getLesson(page, "g6-u4:L4");
  expect(a.status).toBe(200);
  expect(b.status).toBe(200);
  expect(b.body).toEqual(a.body);
});
