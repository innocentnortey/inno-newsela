// NL-100 AC-5 (R-11): an unknown schema_version or node type fails loudly (SCHEMA_UNKNOWN, 500), nothing is dropped, the stored JSON is untouched.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { signInAs } from "../support/users";
import { getLesson, scr9 } from "./helpers";
import { seed } from "./seed";

const stored = async (id: string) =>
  (
    await db().query<{ j: string; v: number }>(
      "select derived_json::text as j, schema_version as v from lesson_doc where lesson_id=$1 order by seq",
      [id],
    )
  ).map((r) => `${r.v}:${r.j}`);

test("schema-unknown: schema_version 99 returns 500 naming lesson and version; SCR-9 says so; stored JSON unchanged", async ({
  page,
}) => {
  const s = await seed();
  const id = s.lessons.schema99;
  await signInAs(page, "author");
  const before = await stored(id);
  const { status, body } = await getLesson(page, id);
  expect(status).toBe(500);
  expect(body.error!.code).toBe("SCHEMA_UNKNOWN");
  expect(body.error!.details).toMatchObject({
    lesson_id: id,
    schema_version: 99,
  });
  expect(Object.keys(body)).toEqual(["error"]); // no partial lesson

  await page.goto(scr9(id));
  const alert = page.getByRole("alert").filter({ hasText: "won't open" });
  await expect(alert).toContainText("Lesson 8 won't open");
  await expect(alert).toContainText("schema version 99");
  await expect(alert).toContainText("Nothing has been dropped.");
  await expect(
    page.getByRole("link", { name: "Back to the board" }),
  ).toBeVisible();
  expect(await stored(id)).toEqual(before);
});

test("schema-unknown: a stored node of unknown type fails the same loud way and nothing is dropped", async ({
  page,
}) => {
  const s = await seed();
  const id = s.lessons.badnode;
  await signInAs(page, "author");
  const before = await stored(id);
  expect(before.join()).toContain("mystery_block");
  const { status, body } = await getLesson(page, id);
  expect(status).toBe(500);
  expect(body.error!.code).toBe("SCHEMA_UNKNOWN");
  expect(body.error!.details).toMatchObject({
    lesson_id: id,
    unknown_nodes: ["mystery_block"],
  });

  await page.goto(scr9(id));
  const alert = page.getByRole("alert").filter({ hasText: "won't open" });
  await expect(alert).toContainText("Lesson 9 won't open");
  await expect(alert).toContainText("Nothing has been dropped.");
  expect(await stored(id)).toEqual(before); // the unknown node is still in the stored row
});

test("schema-unknown: an unknown lesson id is NOT_FOUND (404) in the API and on SCR-9", async ({
  page,
}) => {
  await seed();
  await signInAs(page, "author");
  const { status, body } = await getLesson(page, "G6.U4.L40");
  expect(status).toBe(404);
  expect(body.error!.code).toBe("NOT_FOUND");
  await page.goto(scr9("G6.U4.L40"));
  await expect(
    page.getByText("There is no Lesson 40 in Grade 6 · Unit 4"),
  ).toBeVisible();
});
