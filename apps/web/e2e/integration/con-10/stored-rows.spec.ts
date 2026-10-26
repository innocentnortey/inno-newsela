// NL-104 AC-4: reads never write or recompute; a reopened lesson leaves its frozen row alone.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { signInAs } from "../support/users";
import { getJson, METRICS_PATH, openQuality } from "./helpers";
import { expectedQuality } from "./oracle";
import { cleanupGlobal, seedAll, UNITS } from "./seed";

test.describe.configure({ mode: "serial" });
let ids: Awaited<ReturnType<typeof seedAll>>;
test.beforeAll(async () => { ids = await seedAll(); });
test.afterAll(async () => { await cleanupGlobal(ids); });

const counts = async () => ({
  model_call: await db().count("model_call"), lesson_metrics: await db().count("lesson_metrics"),
  issue: await db().count("issue"), audit_event: await db().count("audit_event"),
});

test("stored-rows-only: five page loads and five route reads leave the row counts unchanged", async ({ page }) => {
  const rev = ids.reviewers[0]!;
  await signInAs(page, rev);
  const before = await counts();
  for (let i = 0; i < 5; i++) {
    await openQuality(page, rev, UNITS.main.unit_key);
    expect((await getJson(page, METRICS_PATH(UNITS.main.unit_id))).status).toBe(200);
  }
  const after = await counts();
  console.log("counts before", JSON.stringify(before), "after", JSON.stringify(after));
  expect(after).toEqual(before);
});

test.describe("reopen", () => {
  const lesson = `${UNITS.main.unit_id}.L1`;
  // review_event is append-only: the reopen event stays (it counts in no tile); only the mutable lesson state is restored.
  test.afterEach(async () => {
    await db().query("update lesson set state='approved' where id=$1", [lesson]);
  });

  test("stored-rows-only: a reopened lesson keeps its frozen row byte-identical and the tiles' n", async ({ page }) => {
    const rev = ids.reviewers[0]!;
    await signInAs(page, rev);
    const sum = async () => (await db().query<{ s: string }>("select md5(m::text) as s from lesson_metrics m where lesson_id=$1", [lesson]))[0]!.s;
    const before = { sum: await sum(), n: await db().count("lesson_metrics"), body: (await getJson(page, METRICS_PATH(UNITS.main.unit_id))).body };
    await db().query("update lesson set state='reopened' where id=$1", [lesson]);
    await db().query(
      "insert into review_event (id, lesson_id, from_state, to_state, actor_id) values ('rev_con10_reopen',$1,'approved','reopened',$2) on conflict (id) do nothing",
      [lesson, rev.user_id],
    );
    await openQuality(page, rev, UNITS.main.unit_key);
    const res = await getJson(page, METRICS_PATH(UNITS.main.unit_id));
    expect(await sum()).toBe(before.sum);
    expect(await db().count("lesson_metrics")).toBe(before.n);
    const ns = (t: { id: string; n: number }[]) => t.map((x) => `${x.id}:${x.n}`);
    expect(ns(res.body.quality.tiles)).toEqual(ns(before.body.quality.tiles));
    const o = await expectedQuality(UNITS.main.unit_id);
    expect(res.body.quality.tiles.map((t: { id: string; value: number | null; n: number }) => ({ id: t.id, value: t.value, n: t.n }))).toEqual(o.tiles);
  });
});
