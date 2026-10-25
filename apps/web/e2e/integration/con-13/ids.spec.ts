/* eslint-disable @typescript-eslint/no-explicit-any -- parsed JSON response bodies from the real stack are untyped */
// NL-113 AC-11: one store_id per store across lesson_doc, check_job and audit_event; x-request-id equals audit_event.request_id.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { liveStack, stopLive } from "./stack";
import { enqueueCheck, seedWp1WithStandards } from "./seed";
import { api, openAs, openLesson, stored, waitCheckedHash } from "./helpers";

test.afterAll(stopLive);

test("test_store_ids_and_request_ids [ids]: ids line up across the flows and nothing secret appears", async ({ browser }) => {
  const live = await liveStack();
  const lesson = await seedWp1WithStandards();
  await enqueueCheck(lesson.lessonId);
  const r = await openAs(browser, live, "reviewer");
  const responses: string[] = [];
  try {
    await waitCheckedHash(r.page, lesson.lessonId);
    await openLesson(r.page, lesson);
    const calls: { name: string; requestId: string | null; stores: boolean }[] = [];
    const call = async (name: string, path: string, body: unknown, stores: boolean) => {
      const res = await api(r.page, "POST", path, body);
      expect(res.status, name).toBe(200);
      responses.push(JSON.stringify(res.body));
      calls.push({ name, requestId: res.requestId, stores });
    };
    // an edit store through the live editor
    const before = await stored(lesson.lessonId);
    await r.page.locator('[data-testid^="section-"] [role="textbox"]').first().click();
    await r.page.keyboard.type(" IDS");
    await expect.poll(async () => (await stored(lesson.lessonId)).seq, { timeout: 20_000 }).toBeGreaterThan(before.seq);
    await waitCheckedHash(r.page, lesson.lessonId);
    // a resolution, a decision, a fill
    const list = await waitCheckedHash(r.page, lesson.lessonId); // issue ids change with the hash
    const target = list.issues.find((i: any) => i.kind === "minutes_out_of_range");
    await call("resolution", `/lessons/${lesson.lessonId}/issues/${target.issue_id}/resolution`, { reason: "ids check" }, false);
    await call("decision", `/lessons/${lesson.lessonId}/standards/decision`, { code: "W.6.2", decision: "confirm" }, true);
    await waitCheckedHash(r.page, lesson.lessonId);
    await call("fill", `/lessons/${lesson.lessonId}/slots/q-hare/fill`, { text: "A short line.", source_ref: { title: "Synthetic Reader", chapter: null, pages: null }, rights_status: "public-domain" }, true);
    await waitCheckedHash(r.page, lesson.lessonId);

    for (const c of calls) {
      expect(c.requestId, c.name).toBeTruthy();
      const audit = await db().query<{ request_id: string; store_id: string | null }>("select request_id, store_id from audit_event where request_id = $1", [c.requestId]);
      expect(audit.length, `${c.name}: one audit row for the response x-request-id`).toBeGreaterThanOrEqual(1);
      if (c.stores) {
        const doc = await db().query<{ store_id: string }>("select store_id from lesson_doc where lesson_id = $1 and request_id = $2", [lesson.lessonId, c.requestId]);
        expect(doc.length, `${c.name}: its lesson_doc row`).toBe(1);
        expect(audit.every((a) => a.store_id === doc[0]!.store_id)).toBe(true);
        const job = await db().query<{ store_id: string }>("select store_id from check_job where lesson_id = $1 and store_id = $2", [lesson.lessonId, doc[0]!.store_id]);
        expect(job.length, `${c.name}: its check_job row`).toBeGreaterThanOrEqual(1);
      }
    }
    const docs = await db().query<{ store_id: string }>("select store_id from lesson_doc where lesson_id = $1", [lesson.lessonId]);
    expect(new Set(docs.map((d) => d.store_id)).size).toBe(docs.length); // one store_id per store
    const edit = await db().query<{ store_id: string }>("select store_id from audit_event where store_id is not null and store_id in (select store_id from lesson_doc where lesson_id = $1)", [lesson.lessonId]);
    console.log(`ids: ${docs.length} lesson_doc rows with distinct store_id; ${edit.length} audit rows carry a store_id; ${calls.length} http calls matched by x-request-id`);

    const logs = live.logs().join("\n");
    const secret = /sk-[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{12,}|Bearer [A-Za-z0-9._-]{12,}|-----BEGIN [A-Z ]*PRIVATE KEY/;
    expect(responses.join("\n")).not.toMatch(secret);
    expect(logs).not.toMatch(secret);
    // The result bodies name the actor by contract (`by`, `inserted_by`); logs never do.
    expect(logs).not.toContain(r.user.name);
  } finally {
    await r.context.close();
  }
});
