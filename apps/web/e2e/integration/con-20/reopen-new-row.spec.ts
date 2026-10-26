// NL-99 AC-6 (WF-16) under ruling S-RULING-2 (PD-32, option A): lesson_metrics keeps ONE row per lesson (lesson_id is the primary key).
// Approve, reopen, approve again: the first frozen row is never edited, no second row appears, and the append-only history
// (lesson_version approve snapshots, review_event rows) shows both approvals.
// Reopen sets the editor mode through collab, which the shared stack does not start, so this spec uses the con-18 private collab + web.
import { expect, test } from "@playwright/test";
import { db } from "../support/db";
import { apiAs, approveBody, latestSubmit, storedVector, transition } from "../con-18/flow";
import { SOURCE, cast, seedFlex, type SeededLesson } from "../con-18/seed";
import { startCon18Stack, type Con18Stack } from "../con-18/stack";

let stack: Con18Stack;
test.beforeAll(async () => {
  test.setTimeout(240_000);
  stack = await startCon18Stack();
});
test.afterAll(async () => {
  await stack?.stop();
});

const pinOf = (l: SeededLesson) => ({ snapshot_hash: l.snapshot!.content_hash, snapshot_state_vector: l.snapshot!.state_vector });
const rowText = async (lesson_id: string) =>
  db().query<{ t: string }>("select m::text as t from lesson_metrics m where lesson_id = $1", [lesson_id]);

test("reopen-new-row: approve, reopen, approve again keeps one byte-identical lesson_metrics row and appends both approvals to the history [invariant]", async () => {
  test.setTimeout(150_000);
  const c = await cast();
  const lesson = await seedFlex({ unit: c.unit, number: SOURCE, state: "submitted", reviewer_id: c.reviewer.user_id, last_editor_id: c.reviewer.user_id });
  const id = lesson.lesson_id;
  const A = await apiAs(stack, c.approver);
  const R = await apiAs(stack, c.reviewer);

  const first = await transition(A, id, approveBody(pinOf(lesson)));
  expect(first.status, first.text).toBe(200);
  expect(first.body["metrics_row_written"]).toBe(true);
  const firstRow = await rowText(id);
  expect(firstRow).toHaveLength(1);
  const approveVersions1 = await db().query<{ id: string; content_hash: string }>("select id, content_hash from lesson_version where lesson_id = $1 and kind = 'approve' order by number", [id]);
  expect(approveVersions1).toHaveLength(1);

  // The frozen row cannot be edited or deleted, even by SQL.
  await expect(db().query("update lesson_metrics set active_minutes = 99 where lesson_id = $1", [id])).rejects.toThrow();
  await expect(db().query("delete from lesson_metrics where lesson_id = $1", [id])).rejects.toThrow();

  const reopen = await transition(A, id, { action: "reopen", reason: "e2e reopen after approval" });
  expect(reopen.status, reopen.text).toBe(200);
  expect(reopen.body["to_state"]).toBe("reopened");
  expect(await rowText(id)).toEqual(firstRow);

  const resub = await transition(R, id, { action: "submit", client_state_vector: await storedVector(id) });
  expect(resub.status, resub.text).toBe(200);
  const snap = await latestSubmit(id);
  const second = await transition(A, id, approveBody({ snapshot_hash: snap.content_hash, snapshot_state_vector: snap.state_vector }, "rewritten"));
  expect(second.status, second.text).toBe(200);
  expect(second.body["metrics_row_written"]).toBe(false);

  // One row, byte-identical to the first.
  expect(await db().count("lesson_metrics", "lesson_id = $1", [id])).toBe(1);
  expect(await rowText(id)).toEqual(firstRow);

  // Append-only history shows both approvals; the first approval snapshot is untouched.
  const approveVersions2 = await db().query<{ id: string; content_hash: string }>("select id, content_hash from lesson_version where lesson_id = $1 and kind = 'approve' order by number", [id]);
  expect(approveVersions2).toHaveLength(2);
  expect(approveVersions2[0]).toEqual(approveVersions1[0]);
  const events = await db().query<{ from_state: string; to_state: string }>("select from_state, to_state from review_event where lesson_id = $1 order by at, id", [id]);
  expect(events.filter((e) => e.to_state === "approved")).toHaveLength(2);
  expect(events.filter((e) => e.to_state === "reopened")).toHaveLength(1);
});
