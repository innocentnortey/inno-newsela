// NL-101 AC-3: the stored hash is the hash of the stored JSON; Y.Doc round trip is hash-stable.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { lesson_to_ydoc, ydoc_to_lesson } from "@ls/ydoc/convert";
import { content_hash } from "@ls/ydoc/hash";
import type { StoredLesson } from "@ls/schema/lesson";
import { db } from "../support/db";
import { cookieHeader, docCount, sessionToken, signedInContext, startCollab } from "./helpers";
import { closeSeedPool, seedLesson } from "./seed";
import { connectRaw } from "./socket";

test.afterAll(closeSeedPool);

test("round-trip-hash: lesson_to_ydoc then ydoc_to_lesson keeps the hash; every stored hash equals the hash of its stored JSON [AC-3]", async ({ browser }) => {
  const wp1 = JSON.parse(readFileSync(resolve(__dirname, "../../../../../packages/ydoc/tests/fixtures/stored-wp1.json"), "utf8")) as StoredLesson;
  const back = ydoc_to_lesson(lesson_to_ydoc(wp1), wp1.schema_version);
  console.log(`round-trip hash seed ${content_hash(wp1)} back ${content_hash(back)}`);
  expect(content_hash(back)).toBe(content_hash(wp1));

  const lesson = await seedLesson("in_review");
  const collab = await startCollab();
  const { context } = await signedInContext(browser, "reviewer");
  const c = connectRaw(collab.port, lesson.lessonId, cookieHeader(await sessionToken(context)));
  try {
    await c.until(() => c.synced(), 8000, "sync");
    const n0 = await docCount(lesson.lessonId);
    c.edit("HASHED");
    await expect.poll(() => docCount(lesson.lessonId), { timeout: 10_000 }).toBeGreaterThan(n0);
    const rows = await db().query<{ seq: number; content_hash: string; derived_json: StoredLesson }>(
      "select seq, content_hash, derived_json from lesson_doc where lesson_id = $1 order by seq",
      [lesson.lessonId],
    );
    expect(rows.length).toBeGreaterThanOrEqual(2); // seed snapshot + stored derived JSON (M-8 inputs)
    for (const r of rows) {
      console.log(`round-trip store seq ${r.seq} hash ${r.content_hash}`);
      expect(content_hash(r.derived_json)).toBe(r.content_hash);
    }
  } finally {
    c.destroy();
    await context.close();
    await collab.close();
  }
});
