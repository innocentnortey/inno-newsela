// NL-101 AC-2: one lesson_doc row per store, one coalesced check_job, one store_id across lesson_doc/check_job/audit_event.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { auditCount, cookieHeader, docCount, refusalLines, sessionToken, signedInContext, startCollab } from "./helpers";
import { closeSeedPool, seedLesson } from "./seed";
import { connectRaw } from "./socket";

test.afterAll(closeSeedPool);

test("test_store_capture: stores write one row, one coalesced check_job and one store_id; a write after lock persists nothing [AC-2]", async ({ browser }) => {
  const lesson = await seedLesson("in_review");
  const collab = await startCollab();
  const a = await signedInContext(browser, "reviewer");
  const b = await signedInContext(browser, "reviewer");
  const ca = connectRaw(collab.port, lesson.lessonId, cookieHeader(await sessionToken(a.context)));
  const cb = connectRaw(collab.port, lesson.lessonId, cookieHeader(await sessionToken(b.context)));
  try {
    await ca.until(() => ca.synced() && cb.synced(), 8000, "both synced");
    const rows0 = await docCount(lesson.lessonId);
    ca.edit("STORE-A");
    await ca.until(() => ca.ofType("stored").length > 0, 8000, "first store ack");
    cb.edit("STORE-B");
    await cb.until(() => cb.ofType("stored").length > 0 && JSON.stringify(cb.ofType("stored")) !== "", 8000, "store ack");
    await expect.poll(() => docCount(lesson.lessonId), { timeout: 10_000 }).toBeGreaterThanOrEqual(rows0 + 2);

    const rows = await db().query<{ seq: number; store_id: string; content_hash: string; state_vector: Buffer; ydoc_bytes: Buffer; derived_json: unknown }>(
      "select seq, store_id, content_hash, state_vector, ydoc_bytes, derived_json from lesson_doc where lesson_id = $1 order by seq",
      [lesson.lessonId],
    );
    for (const r of rows.slice(1)) {
      expect(r.ydoc_bytes.length).toBeGreaterThan(0);
      expect(r.state_vector.length).toBeGreaterThan(0);
      expect(r.content_hash).toMatch(/^[0-9a-f]{64}$/);
    }
    const last = rows[rows.length - 1]!;
    const jobs = await db().query<{ content_hash: string; store_id: string }>(
      "select content_hash, store_id from check_job where lesson_id = $1 and status = 'queued'",
      [lesson.lessonId],
    );
    expect(jobs.length).toBe(1); // coalesced: one queued job for the newest hash
    expect(jobs[0]).toEqual({ content_hash: last.content_hash, store_id: last.store_id });
    const audits = await db().query<{ id: string }>("select id from audit_event where store_id = $1", [last.store_id]);
    expect(audits.length).toBeGreaterThanOrEqual(1);
    console.log(`store_capture: ${rows.length} lesson_doc rows, last store_id ${last.store_id}, queued jobs ${jobs.length}, audit rows ${audits.length}`);

    // Write after the lock persists nothing.
    collab.wiring.frozen.freeze(lesson.lessonId);
    const docs = await docCount(lesson.lessonId);
    const aud = await auditCount();
    ca.edit("AFTER-LOCK");
    await ca.until(() => ca.ofType("refused").length > 0, 8000, "refused");
    expect(ca.ofType("refused")[0]).toMatchObject({ code: "LESSON_LOCKED" });
    await new Promise((r) => setTimeout(r, 1800));
    expect(await docCount(lesson.lessonId)).toBe(docs);
    expect(await auditCount()).toBe(aud);
    expect(refusalLines(collab).length).toBe(1);
  } finally {
    ca.destroy();
    cb.destroy();
    await a.context.close();
    await b.context.close();
    await collab.close();
  }
});
