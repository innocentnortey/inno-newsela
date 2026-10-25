// NL-100 AC-3 (R-33, CON-G5): opening a draft lesson changes nothing; start_review only for the reviewer; both id forms agree.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { signInAs, type Role } from "../support/users";
import { getLesson, readCounts, scr9, waitForLesson } from "./helpers";
import { seed } from "./seed";

// Author and approver: opening the draft page posts nothing. The reviewer's first page open is the next-but-one test (UXP-1: it starts the review).
for (const role of ["author", "approver"] as Role[]) {
  test(`open-starts-nothing: ${role} opens the draft twice (page and API), nothing is written`, async ({
    page,
  }) => {
    const s = await seed();
    const posts: string[] = [];
    page.on(
      "request",
      (r) =>
        r.method() === "POST" &&
        r.url().includes("/transitions") &&
        posts.push(r.url()),
    );
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

test("open-starts-nothing: a reviewer's first page open of a draft posts one start_review; a second open posts nothing", async ({
  page,
}) => {
  const s = await seed();
  const id = s.lessons.fresh;
  const posts: string[] = [];
  page.on(
    "request",
    (r) =>
      r.method() === "POST" &&
      r.url().includes(`/api/lessons/${id}/transitions`) &&
      posts.push(r.postData() ?? ""),
  );
  const me = await signInAs(page, "reviewer");
  expect((await getLesson(page, id)).body.state).toBe("draft"); // the GET alone changes nothing
  const before = await readCounts();

  await page.goto(scr9(id));
  await waitForLesson(page);
  await expect
    .poll(async () => (await getLesson(page, id)).body.state, {
      timeout: 15_000,
    })
    .toBe("in_review");
  expect(posts).toHaveLength(1);
  expect(JSON.parse(posts[0]!)).toEqual({ action: "start_review" });
  const row = await db().query<{ state: string; reviewer_id: string }>(
    "select state, reviewer_id from lesson where id=$1",
    [id],
  );
  expect(row[0]).toEqual({ state: "in_review", reviewer_id: me.user_id });
  const ev = await db().query<{
    from_state: string;
    to_state: string;
    actor_id: string;
  }>(
    "select from_state, to_state, actor_id from review_event where lesson_id=$1",
    [id],
  );
  expect(ev).toEqual([
    { from_state: "draft", to_state: "in_review", actor_id: me.user_id },
  ]);
  const after = await readCounts();
  expect(after["review_event"]).toBe((before["review_event"] as number) + 1);

  await page.goto(scr9(id));
  await waitForLesson(page);
  await page.waitForTimeout(1500);
  expect(posts).toHaveLength(1);
  expect(await db().count("review_event", "lesson_id=$1", [id])).toBe(1);
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
