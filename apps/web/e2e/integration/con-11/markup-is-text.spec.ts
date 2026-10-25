// NL-100 AC-6 (R-58, CON-G6, CON-G8): stored markup shows as literal text on SCR-9 and SCR-16 and in both JSON bodies; no review minutes by name.
import { expect, test } from "@playwright/test";
import { signInAs } from "../support/users";
import {
  getHistory,
  getLesson,
  scr16,
  scr9,
  waitForLesson,
  walk,
} from "./helpers";
import { seed } from "./seed";

const SCRIPT = "<script>window.__pwned=1</script>";
const IMG = "<img src=x onerror=window.__pwned=1>";
const PERSON =
  /^(user|user_id|reviewer|reviewer_id|created_by|actor|actor_name|accepted_by|last_editor|by)$/;

function minutesByName(body: unknown): string[] {
  const hits: string[] = [];
  walk(body, (o, path) => {
    const keys = Object.keys(o);
    if (keys.some((k) => /minute/i.test(k)) && keys.some((k) => PERSON.test(k)))
      hits.push(path);
  });
  return hits;
}

test("markup-is-text: SCR-9, SCR-16 and both JSON bodies carry the markup as plain text", async ({
  page,
}) => {
  const s = await seed();
  const id = s.lessons.markup;
  await signInAs(page, "author");

  const lesson = await getLesson(page, id);
  const history = await getHistory(page, id);
  expect(lesson.status).toBe(200);
  expect(JSON.stringify(lesson.body)).toContain(
    JSON.stringify(`${SCRIPT} ${IMG}`).slice(1, -1),
  );
  expect(JSON.stringify(history.body)).toContain(
    JSON.stringify(`${SCRIPT} ${IMG}`).slice(1, -1),
  );
  expect(minutesByName(lesson.body)).toEqual([]);
  expect(minutesByName(history.body)).toEqual([]);

  await page.goto(scr9(id));
  await waitForLesson(page);
  const text = page.getByTestId("lesson-text");
  await expect(text).toContainText(SCRIPT);
  await expect(text).toContainText(IMG);
  expect(
    await page.evaluate(
      () => (window as unknown as { __pwned?: unknown }).__pwned,
    ),
  ).toBeUndefined();
  expect(await text.locator("script").count()).toBe(0);
  expect(await text.locator("img").count()).toBe(0);
  expect(await page.locator("main script, main img[src='x']").count()).toBe(0);

  await page.goto(scr16(id));
  await expect(page.getByRole("list", { name: "Versions" })).toBeVisible();
  const list = page.getByRole("list", { name: "Versions" });
  await expect(list).toContainText(SCRIPT);
  await expect(list).toContainText(IMG);
  expect(
    await page.evaluate(
      () => (window as unknown as { __pwned?: unknown }).__pwned,
    ),
  ).toBeUndefined();
  expect(await page.locator("main script, main img[src='x']").count()).toBe(0);
});

test("markup-is-text: the minutes-by-name walker would catch a violation (self-check)", () => {
  expect(
    minutesByName({ rows: [{ user: "Ada", review_minutes: 12 }] }),
  ).toEqual(["$.rows[0]"]);
  expect(minutesByName({ sections: [{ name: "Launch", minutes: 5 }] })).toEqual(
    [],
  );
});
