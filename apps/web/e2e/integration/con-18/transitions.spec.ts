// NL-115 (risk::security): CON-18 on the real stack. Submit, approve by a second account, send back, reopen.
// Cases stale_pin, four_eyes, precedence, dependency_order, send_back, reopen and no_named_minutes are the frozen set
// (docs/plans/frozen-tests/NL-115.manifest.json). Every refused call must leave the lesson's rows exactly as they were.
// Lesson numbers: L98 stands for the ticket's "Lesson 4" (the dependant), L99 for "Lesson 5" (its source); see seed.ts.
import { expect, test, type Browser } from "@playwright/test";
import { bridgeCollab } from "../con-12/bridge";
import { db } from "../support/db";
import { expectUnchanged, snapshot } from "./counts";
import {
  apiAs, approveBody, errCode, errDetails, flowRowsText, latestDocHash, latestSubmit, lessonPath, rawSocket, reviewerEdits,
  signedInPage, storedVector, transition, transitionPaths,
} from "./flow";
import {
  DEPENDANT, DISTINCT_MINUTES, DISTINCT_SECONDS, SOURCE, cast, freshUnit, linkDependant, seedFlex, seedReviewTime, slotOf, type Cast, type SeededLesson,
} from "./seed";
import { startCon18Stack, type Con18Stack } from "./stack";

let stack: Con18Stack;
test.beforeAll(async () => {
  test.setTimeout(240_000);
  stack = await startCon18Stack();
});
test.afterAll(async () => {
  await stack?.stop();
});

const pinOf = (l: SeededLesson) => ({ snapshot_hash: l.snapshot!.content_hash, snapshot_state_vector: l.snapshot!.state_vector });

/** A unit with L99 (source, slot filled) and L98 (dependant) both submitted and linked. */
async function linkedPair(c: Cast, over: { last_editor?: string | null } = {}): Promise<{ dep: SeededLesson; src: SeededLesson }> {
  const R = c.reviewer.user_id;
  const last = over.last_editor === undefined ? R : over.last_editor;
  const src = await seedFlex({ unit: c.unit, number: SOURCE, state: "submitted", reviewer_id: R, last_editor_id: last, slot_id: slotOf(c.unit.unit_id) });
  const dep = await seedFlex({ unit: c.unit, number: DEPENDANT, state: "submitted", reviewer_id: R, last_editor_id: last });
  await linkDependant(c.unit.unit_id);
  return { dep, src };
}

async function loneSubmitted(c: Cast, o: { last_editor?: string | null; resolved?: boolean; confirmation?: boolean } = {}): Promise<SeededLesson> {
  return seedFlex({
    unit: c.unit, number: SOURCE, state: "submitted", reviewer_id: c.reviewer.user_id,
    last_editor_id: o.last_editor === undefined ? c.reviewer.user_id : o.last_editor,
    ...(o.resolved === undefined ? {} : { resolved: o.resolved }), ...(o.confirmation === undefined ? {} : { confirmation: o.confirmation }),
  });
}

async function userCtx(browser: Browser, user: Cast["reviewer"]) {
  const context = await browser.newContext();
  const page = await signedInPage(context, user, stack);
  return { context, page };
}

const editor = (page: import("@playwright/test").Page) => page.locator('[data-testid^="section-"] [role="textbox"]').first();
const clientState = (page: import("@playwright/test").Page, s: string) => page.locator(`[data-testid="lesson-editor"][data-client-state="${s}"]`);

// ---------------------------------------------------------------------------------------------------------------------
test("submit: the reviewer submits a clear lesson; one snapshot, one review_event, read_only, a later socket write is refused LESSON_LOCKED [invariant]", async ({ browser }) => {
  const c = await cast();
  const lesson = await seedFlex({ unit: c.unit, number: DEPENDANT, state: "in_review", reviewer_id: c.reviewer.user_id, last_editor_id: c.reviewer.user_id });
  const { context, page } = await userCtx(browser, c.reviewer);
  try {
    await bridgeCollab(page, stack.collabPort);
    await page.goto(`${stack.baseURL}${lessonPath(lesson)}`);
    await expect(editor(page)).toHaveAttribute("aria-readonly", "false", { timeout: 30_000 });
    const submit = page.getByRole("button", { name: "Submit for approval" });
    await expect(submit).not.toHaveAttribute("aria-disabled", "true", { timeout: 30_000 });
    const before = await snapshot(lesson.lesson_id);
    const reply = page.waitForResponse((r) => r.url().includes(`/api/lessons/${lesson.lesson_id}/transitions`) && r.request().method() === "POST");
    await submit.click();
    const res = await reply;
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { to_state: string; version: { content_hash: string } };
    expect(body.to_state).toBe("submitted");

    const after = await snapshot(lesson.lesson_id);
    expect(after.state).toBe("submitted");
    expect(after.lesson_version).toBe(before.lesson_version + 1);
    expect(after.review_event).toBe(before.review_event + 1);
    const snap = await latestSubmit(lesson.lesson_id);
    expect(snap.content_hash).toBe(await latestDocHash(lesson.lesson_id)); // the snapshot is what was stored
    expect(snap.content_hash).toBe(body.version.content_hash);
    await expect(clientState(page, "read_only")).toBeVisible({ timeout: 15_000 }); // the collaboration server told the editor: read_only
    await expect(editor(page)).toHaveAttribute("aria-readonly", "true");

    // A socket write after the freeze is refused and writes nothing.
    const raw = await rawSocket(stack, context, lesson.lesson_id);
    try {
      expect(raw.ofType("mode")[0]).toMatchObject({ mode: "read_only" });
      raw.edit("LATE-WRITE");
      await raw.until(() => raw.ofType("refused").length > 0, 8000, "refused");
      expect(raw.ofType("refused")[0]).toMatchObject({ code: "LESSON_LOCKED" });
    } finally {
      raw.destroy();
    }
    await page.waitForTimeout(1500);
    const later = await snapshot(lesson.lesson_id);
    expect(later.lesson_doc).toBe(after.lesson_doc);
    expect(later.audit_event).toBe(after.audit_event);
    expect(later.lesson_version).toBe(after.lesson_version);
    console.log(`ids submit: lesson=${lesson.lesson_id} version=${snap.version_id} hash=${snap.content_hash.slice(0, 12)}`);
  } finally {
    await context.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
test("approve_second_account: an approver other than the reviewer approves the pinned snapshot with a rating; one frozen metrics row [invariant]", async ({ browser }) => {
  const c = await cast();
  const { dep, src } = await linkedPair(c);
  const A = await apiAs(stack, c.approver);
  const first = await transition(A, src.lesson_id, approveBody(pinOf(src)));
  expect(first.status).toBe(200);
  const srcApproved = (await db().query<{ content_hash: string }>("select content_hash from lesson_version where lesson_id = $1 and kind = 'approve'", [src.lesson_id]))[0]!.content_hash;

  const { context, page } = await userCtx(browser, c.approver);
  try {
    await page.goto(`${stack.baseURL}${lessonPath(dep, true)}`);
    await expect(page.getByRole("heading", { name: "Checklist" })).toBeVisible({ timeout: 30_000 });
    const before = await snapshot(dep.lesson_id);
    await page.getByLabel("Usable with edits").check();
    const reply = page.waitForResponse((r) => r.url().includes(`/api/lessons/${dep.lesson_id}/transitions`) && r.request().method() === "POST");
    await page.getByRole("button", { name: "Approve this version" }).click();
    const res = await reply;
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { to_state: string; metrics_row_written: boolean; dependency_record: { lesson_id: string; approved_hash: string }[]; version: { content_hash: string } };
    expect(body.to_state).toBe("approved");
    expect(body.metrics_row_written).toBe(true);
    expect(body.dependency_record).toEqual([{ lesson_id: src.lesson_id, approved_hash: srcApproved }]);
    await expect(page.getByText(/Approved by .* pinned .* Usable with edits/)).toBeVisible();

    const after = await snapshot(dep.lesson_id);
    expect(after.state).toBe("approved");
    expect(after.lesson_version).toBe(before.lesson_version + 1); // the approval snapshot
    expect(after.review_event).toBe(before.review_event + 1);
    expect(after.lesson_metrics).toBe(1);
    const [m] = await db().query<{ draft_rating: number }>("select draft_rating from lesson_metrics where lesson_id = $1", [dep.lesson_id]);
    expect(m!.draft_rating).toBe(2); // usable_with_edits
    const [v] = await db().query<{ content_hash: string; dependency_record_json: unknown }>("select content_hash, dependency_record_json from lesson_version where lesson_id = $1 and kind = 'approve'", [dep.lesson_id]);
    expect(v!.content_hash).toBe(dep.snapshot!.content_hash); // the approval snapshot is the reviewed one
    expect(JSON.stringify(v!.dependency_record_json)).toContain(srcApproved);
    const [ev] = await db().query<{ actor_id: string; request_id: string | null }>("select actor_id, request_id from review_event where lesson_id = $1 order by at desc limit 1", [dep.lesson_id]);
    expect(ev!.actor_id).toBe(c.approver.user_id);
    expect(ev!.actor_id).not.toBe(c.reviewer.user_id); // a second account
  } finally {
    await context.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
test("test_transition_capture: submit then approve then a stale-pin approve; ids, request_id on each row, refused call writes nothing [capture]", async ({ browser }) => {
  const c = await cast();
  const lesson = await seedFlex({ unit: c.unit, number: SOURCE, state: "in_review", reviewer_id: c.reviewer.user_id, last_editor_id: c.reviewer.user_id });
  const R = await apiAs(stack, c.reviewer);
  const A = await apiAs(stack, c.approver);
  const submitted = await transition(R, lesson.lesson_id, { action: "submit", client_state_vector: await storedVector(lesson.lesson_id) });
  expect(submitted.status, submitted.text).toBe(200);
  const snap = await latestSubmit(lesson.lesson_id);
  const pin = { snapshot_hash: snap.content_hash, snapshot_state_vector: snap.state_vector };

  // A stale-pin approve while the lesson is submitted: refused, writes nothing.
  const afterSubmit = await snapshot(lesson.lesson_id);
  const stale = await transition(A, lesson.lesson_id, approveBody({ snapshot_hash: "0".repeat(64), snapshot_state_vector: pin.snapshot_state_vector }));
  expect(stale.status).toBe(409);
  expect(errCode(stale)).toBe("STALE_PIN");
  expectUnchanged(afterSubmit, await snapshot(lesson.lesson_id));

  const approved = await transition(A, lesson.lesson_id, approveBody(pin, "rewritten"));
  expect(approved.status, approved.text).toBe(200);
  expect(approved.body["metrics_row_written"]).toBe(true);
  const events = await db().query<{ to_state: string; request_id: string | null; actor_id: string }>("select to_state, request_id, actor_id from review_event where lesson_id = $1 order by at", [lesson.lesson_id]);
  expect(events.map((e) => e.to_state)).toEqual(["submitted", "approved"]); // one review_event per move; the refused call added none
  expect(events.every((e) => e.request_id !== null && e.request_id !== "")).toBe(true);
  expect(events[0]!.request_id).toBe(submitted.requestId);
  expect(events[1]!.request_id).toBe(approved.requestId);
  const rows = await db().query<{ draft_rating: number }>("select draft_rating from lesson_metrics where lesson_id = $1", [lesson.lesson_id]);
  expect(rows).toEqual([{ draft_rating: 3 }]); // one frozen metrics row with the rating
  console.log(`ids capture: lesson=${lesson.lesson_id} submit_req=${submitted.requestId} approve_req=${approved.requestId} stale_req=${stale.requestId} audit=${approved.body["audit_id"]}`);
  void browser;
});

// ---------------------------------------------------------------------------------------------------------------------
test("stale_pin: the approver loaded SCR-14, the lesson was withdrawn, edited and resubmitted; approve is 409 STALE_PIN and writes nothing [negative]", async ({ browser }) => {
  const c = await cast();
  const lesson = await seedFlex({ unit: c.unit, number: SOURCE, state: "in_review", reviewer_id: c.reviewer.user_id, last_editor_id: c.reviewer.user_id });
  const R = await apiAs(stack, c.reviewer);
  const rCtx = await browser.newContext();
  await signedInPage(rCtx, c.reviewer, stack);
  expect((await transition(R, lesson.lesson_id, { action: "submit", client_state_vector: await storedVector(lesson.lesson_id) })).status).toBe(200);
  const first = await latestSubmit(lesson.lesson_id);

  const { context, page } = await userCtx(browser, c.approver);
  try {
    await page.goto(`${stack.baseURL}${lessonPath(lesson, true)}`);
    await expect(page.getByRole("heading", { name: "Checklist" })).toBeVisible({ timeout: 30_000 });

    // The reviewer withdraws, changes the text and submits again: a new snapshot.
    expect((await transition(R, lesson.lesson_id, { action: "withdraw" })).status).toBe(200);
    const vector = await reviewerEdits(stack, rCtx, lesson.lesson_id, `Edited after the approver opened it ${Date.now()}`);
    expect((await transition(R, lesson.lesson_id, { action: "submit", client_state_vector: vector })).status).toBe(200);
    const second = await latestSubmit(lesson.lesson_id);
    expect(second.content_hash).not.toBe(first.content_hash);

    const before = await snapshot(lesson.lesson_id);
    await page.getByLabel("Usable as drafted").check();
    const reply = page.waitForResponse((r) => r.url().includes(`/api/lessons/${lesson.lesson_id}/transitions`) && r.request().method() === "POST");
    await page.getByRole("button", { name: "Approve this version" }).click();
    const res = await reply;
    expect(res.status()).toBe(409);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("STALE_PIN");
    expectUnchanged(before, await snapshot(lesson.lesson_id)); // lesson_version, review_event, lesson_metrics, state all as before
    await expect(page.getByText(/This lesson changed since you opened it/)).toBeVisible();

    // Reload shows the new snapshot.
    await page.getByRole("button", { name: "Reload" }).click();
    await expect(page.getByLabel(`snapshot ${second.content_hash.slice(0, 4)}…${second.content_hash.slice(-4)}`).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/This lesson changed since you opened it/)).toBeHidden();
  } finally {
    await context.close();
    await rCtx.close();
  }
});

// ---------------------------------------------------------------------------------------------------------------------
test("four_eyes: an approver who is the last stored editor is refused 422 FOUR_EYES and nothing changes [negative]", async () => {
  const c = await cast();
  const lesson = await loneSubmitted(c);
  // Test-database fixture only (AC-4): the approver is made the last stored editor.
  await db().query("update lesson set last_editor_id = $2 where id = $1", [lesson.lesson_id, c.approver.user_id]);
  const A = await apiAs(stack, c.approver);
  const before = await snapshot(lesson.lesson_id);
  const r = await transition(A, lesson.lesson_id, approveBody(pinOf(lesson)));
  expect(r.status).toBe(422);
  expect(errCode(r)).toBe("FOUR_EYES");
  expectUnchanged(before, await snapshot(lesson.lesson_id));
  // A different approver may approve the same snapshot.
  const B = await apiAs(stack, c.approver2);
  expect((await transition(B, lesson.lesson_id, approveBody(pinOf(lesson)))).status).toBe(200);
});

// ---------------------------------------------------------------------------------------------------------------------
test("precedence: one lesson failing several ways refuses in CON-18 order, each refusal writes nothing [failure/refusal]", async () => {
  const c = await cast();
  // Fails four ways at once: blocking findings unresolved and a confirmation open.
  const many = await loneSubmitted(c, { resolved: false, confirmation: true });
  const R = await apiAs(stack, c.reviewer);
  const A = await apiAs(stack, c.approver);
  const seen: Array<[number, string | undefined]> = [];
  const check = async (who: typeof A, lessonId: string, body: unknown, status: number, code: string) => {
    const before = await snapshot(lessonId);
    const r = await transition(who, lessonId, body);
    seen.push([r.status, errCode(r)]);
    expect([r.status, errCode(r)], r.text.slice(0, 400)).toEqual([status, code]);
    expectUnchanged(before, await snapshot(lessonId));
    return r;
  };

  // 1 ROLE_FORBIDDEN beats everything (also a missing lesson and a bad state).
  await check(R, many.lesson_id, approveBody(pinOf(many)), 403, "ROLE_FORBIDDEN");
  await check(R, `${c.unit.unit_id}.L97`, approveBody(pinOf(many)), 403, "ROLE_FORBIDDEN");
  // 2 NOT_FOUND
  await check(A, `${c.unit.unit_id}.L97`, approveBody(pinOf(many)), 404, "NOT_FOUND");
  // 3 INVALID_TRANSITION: an in_review lesson cannot be approved, whatever else is wrong with it.
  const inReview = await seedFlex({ unit: c.unit, number: 96, state: "in_review", reviewer_id: c.reviewer.user_id, resolved: false });
  await check(A, inReview.lesson_id, approveBody({ snapshot_hash: "0".repeat(64), snapshot_state_vector: "AQGyBA==" }, null), 409, "INVALID_TRANSITION");
  // 4 RATING_REQUIRED beats the pin, four-eyes and every gate.
  await check(A, many.lesson_id, approveBody(pinOf(many), null), 422, "RATING_REQUIRED");
  // 5 STALE_PIN beats the gates.
  await check(A, many.lesson_id, approveBody({ snapshot_hash: "0".repeat(64), snapshot_state_vector: many.snapshot!.state_vector }), 409, "STALE_PIN");
  // 6 BLOCKED lists blocking and confirmation issues together.
  const blocked = await check(A, many.lesson_id, approveBody(pinOf(many)), 422, "BLOCKED");
  const levels = new Set(((errDetails(blocked)["issues"] ?? []) as { level: string }[]).map((i) => i.level));
  expect(levels).toEqual(new Set(["blocking", "confirmation"]));

  // 7 CONFIRMATION_OPEN when only the confirmation is left.
  const only = await loneSubmitted({ ...c, unit: await freshUnit() }, { confirmation: true });
  const conf = await check(A, only.lesson_id, approveBody(pinOf(only)), 422, "CONFIRMATION_OPEN");
  expect(((errDetails(conf)["issues"] ?? []) as { kind: string }[]).map((i) => i.kind)).toEqual(["standard_confirmation"]);
  console.log(`precedence order: ${JSON.stringify(seen)}`);
});

// ---------------------------------------------------------------------------------------------------------------------
test("dependency_order: the dependant is refused DEPENDENCY_UNAPPROVED until its source is approved, then records the source's approved hash [invariant]", async () => {
  const c = await cast();
  const { dep, src } = await linkedPair(c);
  expect(await db().count("lesson_link", "from_lesson_id = $1 and to_lesson_id = $2", [dep.lesson_id, src.lesson_id])).toBe(1); // the link exists, so the case is not a no-op
  const A = await apiAs(stack, c.approver);

  const before = await snapshot(dep.lesson_id);
  const refused = await transition(A, dep.lesson_id, approveBody(pinOf(dep)));
  expect(refused.status).toBe(422);
  expect(errCode(refused)).toBe("DEPENDENCY_UNAPPROVED");
  expect(errDetails(refused)["source_lesson_ids"]).toEqual([src.lesson_id]); // names Lesson 5
  expectUnchanged(before, await snapshot(dep.lesson_id));

  expect((await transition(A, src.lesson_id, approveBody(pinOf(src)))).status).toBe(200);
  const ok = await transition(A, dep.lesson_id, approveBody(pinOf(dep)));
  expect(ok.status, ok.text).toBe(200);
  const srcHash = (await db().query<{ content_hash: string }>("select content_hash from lesson_version where lesson_id = $1 and kind = 'approve'", [src.lesson_id]))[0]!.content_hash;
  expect((ok.body["dependency_record"] as { lesson_id: string; approved_hash: string }[])).toEqual([{ lesson_id: src.lesson_id, approved_hash: srcHash }]);
});

// ---------------------------------------------------------------------------------------------------------------------
test("send_back: request_changes with a tag and note unfreezes the lesson; an empty note is NOTE_REQUIRED; withdraw returns to in_review [invariant]", async ({ browser }) => {
  const c = await cast();
  const lesson = await loneSubmitted(c);
  const A = await apiAs(stack, c.approver);
  const rCtx = await browser.newContext();
  await signedInPage(rCtx, c.reviewer, stack);
  try {
    // Empty note: refused, nothing written.
    const before = await snapshot(lesson.lesson_id);
    const empty = await transition(A, lesson.lesson_id, { action: "request_changes", tag: "standards", note: "   " });
    expect(empty.status).toBe(422);
    expect(errCode(empty)).toBe("NOTE_REQUIRED");
    expectUnchanged(before, await snapshot(lesson.lesson_id));

    // Tag and note: changes_requested, unfrozen (a socket write is accepted and stored).
    const sent = await transition(A, lesson.lesson_id, { action: "request_changes", tag: "standards", note: "Check the standards codes in Look Back.", ...pinOf(lesson) });
    expect(sent.status, sent.text).toBe(200);
    expect(sent.body["to_state"]).toBe("changes_requested");
    const after = await snapshot(lesson.lesson_id);
    expect(after.state).toBe("changes_requested");
    expect(after.review_event).toBe(before.review_event + 1);
    const [ev] = await db().query<{ reason_tag: string; note: string }>("select reason_tag, note from review_event where lesson_id = $1 order by at desc limit 1", [lesson.lesson_id]);
    expect(ev).toEqual({ reason_tag: "standards", note: "Check the standards codes in Look Back." });
    const raw = await rawSocket(stack, rCtx, lesson.lesson_id);
    try {
      expect(raw.ofType("mode")[0]).toMatchObject({ mode: "editable" });
      raw.edit("Fixed after the send-back");
      await raw.until(() => raw.ofType("stored").length > 0, 12_000, "store ack after unfreeze");
    } finally {
      raw.destroy();
    }
  } finally {
    await rCtx.close();
  }

  // withdraw: a submitted lesson goes back to in_review.
  const other = await loneSubmitted({ ...c, unit: await freshUnit() });
  const R = await apiAs(stack, c.reviewer);
  const w = await transition(R, other.lesson_id, { action: "withdraw" });
  expect(w.status, w.text).toBe(200);
  expect(w.body["to_state"]).toBe("in_review");
  expect((await snapshot(other.lesson_id)).state).toBe("in_review");
});

// ---------------------------------------------------------------------------------------------------------------------
test("reopen: the approver reopens an approved lesson with a reason; the dependant is flagged, nothing reopens by itself, the old metrics row never changes [invariant]", async () => {
  const c = await cast();
  const { dep, src } = await linkedPair(c);
  const A = await apiAs(stack, c.approver);
  const R = await apiAs(stack, c.reviewer);
  expect((await transition(A, src.lesson_id, approveBody(pinOf(src)))).status).toBe(200);
  expect((await transition(A, dep.lesson_id, approveBody(pinOf(dep)))).status).toBe(200);
  const rowBefore = (await db().query<{ t: string }>("select m::text as t from lesson_metrics m where lesson_id = $1", [src.lesson_id]))[0]!.t;
  const approvedHash = (await db().query<{ content_hash: string }>("select content_hash from lesson_version where lesson_id = $1 and kind = 'approve'", [src.lesson_id]))[0]!.content_hash;

  // REASON_REQUIRED writes nothing.
  const before = await snapshot(src.lesson_id);
  const empty = await transition(A, src.lesson_id, { action: "reopen", reason: "  " });
  expect(empty.status).toBe(422);
  expect(errCode(empty)).toBe("REASON_REQUIRED");
  expectUnchanged(before, await snapshot(src.lesson_id));
  // A reviewer cannot reopen.
  expect(errCode(await transition(R, src.lesson_id, { action: "reopen", reason: "I want to" }))).toBe("ROLE_FORBIDDEN");

  const ok = await transition(A, src.lesson_id, { action: "reopen", reason: "A rights question came up after approval." });
  expect(ok.status, ok.text).toBe(200);
  expect(ok.body["to_state"]).toBe("reopened");
  const after = await snapshot(src.lesson_id);
  expect(after.state).toBe("reopened");
  expect(after.lesson_version).toBe(before.lesson_version + 1);
  const [reopened] = await db().query<{ kind: string; content_hash: string }>("select kind, content_hash from lesson_version where lesson_id = $1 order by number desc limit 1", [src.lesson_id]);
  expect(reopened).toEqual({ kind: "reopen", content_hash: approvedHash }); // a new version from the approved snapshot

  // The dependant is flagged on the board; nothing reopened by itself.
  const board = await A.get(`/api/units/${c.unit.unit_id}/board`);
  expect(board.status()).toBe(200);
  const rows = ((await board.json()) as { rows: { lesson_id: string; state: string; dependency_flags: { kind: string; lesson_id: string }[] }[] }).rows;
  const depRow = rows.find((r) => r.lesson_id === dep.lesson_id)!;
  expect(depRow.state).toBe("approved");
  expect(depRow.dependency_flags).toContainEqual(expect.objectContaining({ kind: "source_reopened", lesson_id: src.lesson_id }));
  expect((await snapshot(dep.lesson_id)).state).toBe("approved");

  // The old metrics row is never edited, and re-approval does not add or change one.
  expect((await db().query<{ t: string }>("select m::text as t from lesson_metrics m where lesson_id = $1", [src.lesson_id]))[0]!.t).toBe(rowBefore);
  const resub = await transition(R, src.lesson_id, { action: "submit", client_state_vector: await storedVector(src.lesson_id) });
  expect(resub.status, resub.text).toBe(200);
  const snap = await latestSubmit(src.lesson_id);
  const again = await transition(A, src.lesson_id, approveBody({ snapshot_hash: snap.content_hash, snapshot_state_vector: snap.state_vector }, "rewritten"));
  expect(again.status, again.text).toBe(200);
  // NL-48's writer writes the first-approval row only (lesson_id is the primary key); record what it does, never edit it.
  expect(again.body["metrics_row_written"]).toBe(false);
  expect(await db().count("lesson_metrics", "lesson_id = $1", [src.lesson_id])).toBe(1);
  expect((await db().query<{ t: string }>("select m::text as t from lesson_metrics m where lesson_id = $1", [src.lesson_id]))[0]!.t).toBe(rowBefore);
});

// ---------------------------------------------------------------------------------------------------------------------
test("no_bulk: a body naming two lessons is INVALID_REQUEST and the contract has one transitions path [negative]", async () => {
  const c = await cast();
  const { dep, src } = await linkedPair(c);
  const A = await apiAs(stack, c.approver);
  const before = [await snapshot(dep.lesson_id), await snapshot(src.lesson_id)];
  for (const body of [
    { ...approveBody(pinOf(dep)), lesson_ids: [dep.lesson_id, src.lesson_id] },
    { action: "approve", lessons: [{ lesson_id: dep.lesson_id, ...pinOf(dep) }, { lesson_id: src.lesson_id, ...pinOf(src) }], rating: "usable_with_edits" },
  ]) {
    const r = await transition(A, dep.lesson_id, body);
    expect([400, 422]).toContain(r.status);
    expect(errCode(r)).toBe("INVALID_REQUEST");
  }
  expect([await snapshot(dep.lesson_id), await snapshot(src.lesson_id)]).toEqual(before);
  const { paths, grepCount } = transitionPaths();
  test.info().annotations.push({ type: "grep -c transitions", description: String(grepCount) });
  expect(paths).toHaveLength(1);
  expect(paths[0]).toContain("/lessons/{lessonId}/transitions:");
});

// ---------------------------------------------------------------------------------------------------------------------
test("append_only: UPDATE and DELETE on review_event, lesson_version and audit_event are rejected by the database trigger [invariant]", async () => {
  const c = await cast();
  const lesson = await loneSubmitted(c);
  const A = await apiAs(stack, c.approver);
  expect((await transition(A, lesson.lesson_id, approveBody(pinOf(lesson)))).status).toBe(200);
  await db().query("insert into audit_event (id, actor_id, action, target_kind, target_id, request_id) values ($1,$2,'e2e.append_only','lesson',$3,'req_e2e')", [
    `aud_e2e_${Date.now()}`, c.approver.user_id, lesson.lesson_id,
  ]);
  const cases: Array<[string, string]> = [
    ["review_event", "lesson_id"],
    ["lesson_version", "lesson_id"],
    ["audit_event", "target_id"],
  ];
  for (const [table, col] of cases) {
    expect(await db().count(table, `${col} = $1`, [lesson.lesson_id]), `${table} has a row to attack`).toBeGreaterThan(0);
    const note = table === "lesson_version" ? "content_hash" : table === "review_event" ? "note" : "reason";
    await expect(db().query(`update ${table} set ${note} = 'tampered' where ${col} = $1`, [lesson.lesson_id])).rejects.toThrow(new RegExp(`append-only: ${table}`));
    await expect(db().query(`delete from ${table} where ${col} = $1`, [lesson.lesson_id])).rejects.toThrow(new RegExp(`append-only: ${table}`));
  }
});

// ---------------------------------------------------------------------------------------------------------------------
test("no_named_minutes: a distinctive review time (7.77 min) never comes back with the reviewer's name in the response, the audit rows or the logs [negative]", async () => {
  const c = await cast();
  const lesson = await loneSubmitted(c);
  await seedReviewTime(c.reviewer, lesson);
  const seen: string[] = [];
  const A = await apiAs(stack, c.approver);
  const logsBefore = stack.logs().length;
  const r = await transition(A, lesson.lesson_id, approveBody(pinOf(lesson)));
  expect(r.status, r.text).toBe(200);
  seen.push(r.text);
  const history = await A.get(`/api/lessons/${lesson.lesson_id}/history`);
  seen.push(await history.text());
  const detail = await A.get(`/api/lessons/${lesson.lesson_id}`);
  seen.push(await detail.text());
  const rows = await flowRowsText([lesson.lesson_id]);
  const logs = stack.logs().slice(logsBefore).join("\n");
  expect(logs.length, "the flow logged something to scan").toBeGreaterThan(0);

  // The distinctive value really flowed into the frozen row (unnamed), so absence below is meaningful.
  const [m] = await db().query<{ active_minutes: string; t: string }>("select active_minutes::text, m::text as t from lesson_metrics m where lesson_id = $1", [lesson.lesson_id]);
  expect(m!.active_minutes).toBe(DISTINCT_MINUTES);
  expect(m!.t).not.toContain(c.reviewer.user_id);

  const count = (hay: string, needle: string) => hay.split(needle).length - 1;
  for (const [what, hay] of [["response", seen.join("\n")], ["audit rows", rows], ["log lines", logs]] as const) {
    expect(count(hay, DISTINCT_MINUTES), `${what} contains ${DISTINCT_MINUTES}`).toBe(0);
    expect(count(hay, String(DISTINCT_SECONDS)), `${what} contains ${DISTINCT_SECONDS}`).toBe(0);
    expect(hay, `${what} names the reviewer with minutes`).not.toMatch(/active_(minutes|seconds)/);
  }
});
