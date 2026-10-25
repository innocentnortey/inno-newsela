// NL-116 (WF-14, CON-17): AI assist on the real stack (built web app, real collab process, stub model).
// Frozen-style security cases (AC-3, 4, 6, 7) sit beside the capture test. Synthetic data only.
import { expect, test } from "@playwright/test";
import {
  NEW_TEXT, PASSAGE, UNTRUSTED, apiAs, createRealIdUser, askForSuggestion, auditFor, closeSeedPool, db, docRows, editorBox, latestHash,
  openLesson, panel, seedLesson, typeInsidePassage, WP3_PASSAGE, setStub, startRealCollab, startWorker, suggestionRows, type Proc, type Reviewer,
} from "./helpers";

let collab: Proc;
let worker: Proc;
test.beforeAll(async () => {
  collab = await startRealCollab();
  worker = await startWorker();
});
test.afterAll(async () => {
  await worker?.stop();
  await collab?.stop();
  await closeSeedPool();
});
test.beforeEach(() => setStub({ kind: "text", text: NEW_TEXT }));

const lastDoc = (lessonId: string) =>
  db().query<{ derived_json: unknown; stored_by: string | null }>("select derived_json, stored_by from lesson_doc where lesson_id = $1 order by seq desc limit 1", [lessonId]);

test.describe("request", () => {
  test("test_ai_assist_capture (request half): pending suggestion outside the document, hash unchanged, model_call row first", async ({ browser }) => {
    const lesson = await seedLesson("in_review");
    const { page, context } = await openLesson(browser, lesson);
    const hash0 = await latestHash(lesson.lessonId);
    const docs0 = await docRows(lesson.lessonId);
    // A 1.5 s model delay lets the spec look at the model_call row while the call is in flight.
    setStub({ kind: "delay", ms: 1500, then: { kind: "text", text: NEW_TEXT } });
    const asking = askForSuggestion(page);
    await expect
      .poll(async () => (await db().query("select 1 from model_call where lesson_id = $1 and purpose = 'assist' and completed_at is null", [lesson.lessonId])).length, { timeout: 8000, intervals: [50] })
      .toBe(1);
    const res = await asking;
    expect(res.status()).toBe(201);
    const rows = await suggestionRows(lesson.lessonId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "pending", selected_text: PASSAGE, suggested_text: NEW_TEXT });
    expect(await latestHash(lesson.lessonId)).toBe(hash0);
    expect(await docRows(lesson.lessonId)).toBe(docs0);
    const mc = await db().query<{ sent_at: Date; completed_at: Date; status: string }>("select sent_at, completed_at, status from model_call where id = $1", [rows[0]!.model_call_id]);
    expect(mc[0]!.sent_at.getTime()).toBeLessThanOrEqual(mc[0]!.completed_at.getTime());
    console.log(`request: suggestion ${rows[0]!.id} pending; hash unchanged ${hash0?.slice(0, 12)}; model_call sent_at<=completed_at`);
    await expect(panel(page)).toContainText(NEW_TEXT);
    await context.close();
  });
});

test.describe("accept", () => {
  test("test_ai_assist_capture: one accept and one reject, ai-assist tag, audit events with the web request id, checks re-run", async ({ browser }) => {
    const lesson = await seedLesson("in_review");
    const { page, context, user } = await openLesson(browser, lesson);

    // Accept.
    const res1 = await askForSuggestion(page);
    expect(res1.status()).toBe(201);
    const [s1] = await suggestionRows(lesson.lessonId);
    const docs0 = await docRows(lesson.lessonId);
    const checksBefore = await db().count("check_job", "lesson_id = $1", [lesson.lessonId]);
    const [acc] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/decision")),
      panel(page).getByRole("button", { name: /accept/i }).click(),
    ]);
    expect(acc.status()).toBe(200);
    const reqId1 = acc.headers()["x-request-id"];
    await expect(editorBox(page)).toContainText(NEW_TEXT);
    await expect.poll(() => docRows(lesson.lessonId), { timeout: 15_000 }).toBeGreaterThan(docs0);
    expect((await suggestionRows(lesson.lessonId))[0]!.status).toBe("accepted");
    const audit1 = await auditFor("suggestion.accept", s1!.id);
    expect(audit1).toHaveLength(1);
    expect(audit1[0]!.actor_id).toBe(user.user_id);
    if (reqId1) expect(audit1[0]!.request_id).toBe(reqId1);
    const last = await db().query<{ last_editor_id: string }>("select last_editor_id from lesson where id = $1", [lesson.lessonId]);
    expect(last[0]!.last_editor_id).toBe(user.user_id);
    expect(JSON.stringify(await lastDoc(lesson.lessonId))).toContain(NEW_TEXT);
    await expect.poll(() => db().count("check_job", "lesson_id = $1", [lesson.lessonId]), { timeout: 20_000 }).toBeGreaterThan(checksBefore);

    // Reject.
    setStub({ kind: "text", text: "A second rewrite that will be discarded." });
    const res2 = await askForSuggestion(page, "Try again.", NEW_TEXT);
    expect(res2.status()).toBe(201);
    const s2 = (await suggestionRows(lesson.lessonId)).find((s) => s.status === "pending")!;
    const [rej] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/decision")),
      panel(page).getByRole("button", { name: /reject/i }).click(),
    ]);
    expect(rej.status()).toBe(200);
    const audit2 = await auditFor("suggestion.reject", s2.id);
    expect(audit2).toHaveLength(1);
    const reqId2 = rej.headers()["x-request-id"];
    if (reqId2) expect(audit2[0]!.request_id).toBe(reqId2);
    await expect(editorBox(page)).not.toContainText("A second rewrite");
    console.log(`accept: ai-assist applied by ${user.user_id}; audit accept ${audit1[0]!.id} reject ${audit2[0]!.id}; request ids match`);
    await context.close();
  });
});


const decisionPath = (lessonId: string, sid: string) => `/lessons/${lessonId}/suggestions/${sid}/decision`;
const errorCode = async (r: { json(): Promise<unknown> }) => ((await r.json()) as { error?: { code?: string } }).error?.code;

async function anchorOf(lessonId: string, sid: string) {
  const r = await db().query<{ anchor_start: string; anchor_end: string }>("select anchor_start, anchor_end from suggestion where id = $1", [sid]);
  void lessonId;
  return { start: r[0]!.anchor_start, end: r[0]!.anchor_end };
}

test.describe("anchor_changed", () => {
  test("anchor_changed: a co-editor changed the anchored text; accept is refused even with a forged anchored_text_now", async ({ browser }) => {
    const lesson = await seedLesson("in_review");
    const a = await openLesson(browser, lesson);
    const b = await openLesson(browser, lesson);
    expect((await askForSuggestion(a.page)).status()).toBe(201);
    const [s] = await suggestionRows(lesson.lessonId);
    // B types inside the anchored words.
    const docs0 = await docRows(lesson.lessonId);
    await typeInsidePassage(b.page, "ZZ");
    await expect(editorBox(b.page)).toContainText("Today we reaZZd");
    // Wait until B's edit is the stored document (the collab debounces writes).
    await expect.poll(async () => JSON.stringify(await lastDoc(lesson.lessonId)).includes("ZZ"), { timeout: 20_000 }).toBe(true);
    void docs0;
    const hashB = await latestHash(lesson.lessonId);
    const accepts0 = await auditFor("suggestion.accept", s!.id);
    // A accepts, forging anchored_text_now = the OLD text.
    const res = await apiAs(a.context, a.page, "POST", decisionPath(lesson.lessonId, s!.id), { decision: "accept", anchored_text_now: PASSAGE });
    if (res.status() !== 409) {
      const sr = await suggestionRows(lesson.lessonId);
      console.log("DEBUG anchor", res.status(), (await res.text()).slice(0, 400), JSON.stringify(sr.map((x) => x.status)), JSON.stringify(await lastDoc(lesson.lessonId)).slice(0, 1200));
      console.log("DEBUG collab", JSON.stringify(collab.log.slice(-6)).slice(0, 1500));
    }
    expect(res.status()).toBe(409);
    expect(await errorCode(res)).toBe("ANCHOR_CHANGED");
    expect((await suggestionRows(lesson.lessonId))[0]!.status).toBe("closed");
    expect(await latestHash(lesson.lessonId)).toBe(hashB);
    expect(accepts0).toHaveLength(0);
    expect(await auditFor("suggestion.accept", s!.id)).toHaveLength(0);
    expect(JSON.stringify(await lastDoc(lesson.lessonId))).not.toContain(NEW_TEXT);
    console.log(`anchor_changed: 409 ANCHOR_CHANGED, suggestion closed, hash unchanged ${hashB?.slice(0, 12)}`);
    await a.context.close();
    await b.context.close();
  });
});

async function submitBody(lessonId: string) {
  const r = await db().query<{ sv: string }>("select encode(state_vector,'base64') as sv from lesson_doc where lesson_id = $1 order by seq desc limit 1", [lessonId]);
  return { action: "submit", client_state_vector: r[0]!.sv };
}
const gatedRows = async (lessonId: string) => ({
  versions: await db().count("lesson_version", "lesson_id = $1", [lessonId]),
  events: await db().count("review_event", "lesson_id = $1", [lessonId]),
});

async function approverContext(browser: import("@playwright/test").Browser) {
  const { getStack } = await import("../support/real-stack");
  const { signInAs } = await import("../support/users");
  const ctx = await browser.newContext({ baseURL: getStack().baseURL });
  const page = await ctx.newPage();
  await signInAs(page, await createRealIdUser("approver"));
  return { ctx, page };
}
const transitions = (lessonId: string) => `/lessons/${lessonId}/transitions`;
const lessonState = async (lessonId: string) => (await db().query<{ state: string }>("select state from lesson where id = $1", [lessonId]))[0]!.state;

test.describe("blocks_transitions", () => {
  test("blocks_transitions: a pending suggestion makes Submit and Approve return SUGGESTION_PENDING 422; rejecting or expiring lifts it", async ({ browser }) => {
    test.setTimeout(240_000);

    // 1. Submit with a pending suggestion asked through the editor (WP-1 Lesson 4): refused, nothing written.
    const l1 = await seedLesson("in_review");
    const a = await openLesson(browser, l1);
    expect((await askForSuggestion(a.page)).status()).toBe(201);
    const [s1] = await suggestionRows(l1.lessonId);
    const before = await gatedRows(l1.lessonId);
    const refused = await apiAs(a.context, a.page, "POST", transitions(l1.lessonId), await submitBody(l1.lessonId));
    expect(refused.status()).toBe(422);
    expect(await errorCode(refused)).toBe("SUGGESTION_PENDING");
    expect(await gatedRows(l1.lessonId)).toEqual(before);
    expect(await lessonState(l1.lessonId)).toBe("in_review");
    // After the reject the suggestion no longer blocks (WP-1 is flawed on purpose, so another reason may still refuse).
    expect((await apiAs(a.context, a.page, "POST", decisionPath(l1.lessonId, s1!.id), { decision: "reject" })).status()).toBe(200);
    const after1 = await apiAs(a.context, a.page, "POST", transitions(l1.lessonId), await submitBody(l1.lessonId));
    expect(after1.status() === 200 ? "OK" : await errorCode(after1)).not.toBe("SUGGESTION_PENDING");
    await a.context.close();

    // 2. Submit succeeds after a reject, and after the 30 minutes pass (compiled WP-3 draft: every blocking finding resolved).
    for (const how of ["reject", "expiry"] as const) {
      const l = await seedLesson("in_review", "wp3");
      const r = await openLesson(browser, l, undefined, WP3_PASSAGE);
      const made = await apiAs(r.context, r.page, "POST", `/lessons/${l.lessonId}/suggestions`, { anchor: { start: "AA", end: "AB" }, selected_text: WP3_PASSAGE, note: "n" });
      expect(made.status()).toBe(201);
      const sid = ((await made.json()) as { suggestion_id: string }).suggestion_id;
      const blocked = await apiAs(r.context, r.page, "POST", transitions(l.lessonId), await submitBody(l.lessonId));
      expect(blocked.status()).toBe(422);
      expect(await errorCode(blocked)).toBe("SUGGESTION_PENDING");
      if (how === "reject") expect((await apiAs(r.context, r.page, "POST", decisionPath(l.lessonId, sid), { decision: "reject" })).status()).toBe(200);
      else await db().query("update suggestion set expires_at = now() - interval '1 minute' where id = $1", [sid]);
      const ok = await apiAs(r.context, r.page, "POST", transitions(l.lessonId), await submitBody(l.lessonId));
      console.log(`blocks_transitions: submit ${how}: 422 SUGGESTION_PENDING then ${ok.status()}`);
      expect(ok.status()).toBe(200);
      expect(await lessonState(l.lessonId)).toBe("submitted");
      await r.context.close();
    }

    // 3. Approve: a submitted lesson that holds a pending suggestion is refused; after reject or expiry the approval succeeds.
    for (const how of ["reject", "expiry"] as const) {
      const l = await seedLesson("submitted", "wp3");
      const snap = l.snapshot!;
      const sid = `sug_01${Date.now().toString(36).toUpperCase().padStart(24, "0").slice(-24)}`.slice(0, 30);
      const reviewer = await createRealIdUser("reviewer");
      await db().query(
        "insert into suggestion (id, lesson_id, anchor_start, anchor_end, selected_text, note, suggested_text, status, requested_by, expires_at, model_call_id) values ($1,$2,'AA','AB',$3,'n','y','pending',$4,now() + interval '30 minutes','mc_01SEEDEDFORAPPROVEGATE0000')",
        [sid, l.lessonId, WP3_PASSAGE, reviewer.user_id],
      );
      const { ctx, page } = await approverContext(browser);
      const body = { action: "approve", snapshot_hash: snap.content_hash, snapshot_state_vector: snap.state_vector, rating: "usable_as_drafted" };
      const rows0 = await gatedRows(l.lessonId);
      const no = await apiAs(ctx, page, "POST", transitions(l.lessonId), body);
      expect(no.status()).toBe(422);
      expect(await errorCode(no)).toBe("SUGGESTION_PENDING");
      expect(await gatedRows(l.lessonId)).toEqual(rows0);
      if (how === "reject") await db().query("update suggestion set status = 'rejected', decided_by = $2, decided_at = now() where id = $1", [sid, reviewer.user_id]);
      else await db().query("update suggestion set expires_at = now() - interval '1 minute' where id = $1", [sid]);
      const yes = await apiAs(ctx, page, "POST", transitions(l.lessonId), body);
      console.log(`blocks_transitions: approve ${how}: 422 SUGGESTION_PENDING then ${yes.status()} ${yes.status() === 200 ? "" : await errorCode(yes)}`);
      expect(yes.status()).toBe(200);
      await ctx.close();
    }
  });
});

test.describe("reject_and_list", () => {
  test("reject_and_list: reject logs, a second decision is INVALID_TRANSITION, and the list after a reload is exactly the pending ones", async ({ browser }) => {
    const lesson = await seedLesson("in_review");
    const a = await openLesson(browser, lesson);
    expect((await askForSuggestion(a.page)).status()).toBe(201);
    const [s1] = await suggestionRows(lesson.lessonId);
    const [rej] = await Promise.all([
      a.page.waitForResponse((r) => r.url().includes("/decision")),
      panel(a.page).getByRole("button", { name: /reject/i }).click(),
    ]);
    expect(rej.status()).toBe(200);
    expect(await auditFor("suggestion.reject", s1!.id)).toHaveLength(1);
    const again = await apiAs(a.context, a.page, "POST", decisionPath(lesson.lessonId, s1!.id), { decision: "reject" });
    expect(again.status()).toBe(409);
    expect(await errorCode(again)).toBe("INVALID_TRANSITION");
    expect(await auditFor("suggestion.reject", s1!.id)).toHaveLength(1);

    // Three requests, then the list after a reload shows what the database says is still pending.
    const anchor = await anchorOf(lesson.lessonId, s1!.id);
    for (let i = 0; i < 3; i++) {
      setStub({ kind: "text", text: `Rewrite number ${i}.` });
      const r = await apiAs(a.context, a.page, "POST", `/lessons/${lesson.lessonId}/suggestions`, { anchor, selected_text: PASSAGE, note: `n${i}` });
      expect(r.status()).toBe(201);
    }
    await a.page.reload();
    const list = await apiAs(a.context, a.page, "GET", `/lessons/${lesson.lessonId}/suggestions`);
    const listed = ((await list.json()) as { suggestions: { suggestion_id: string; status: string }[] }).suggestions.map((x) => x.suggestion_id).sort();
    const pending = (await suggestionRows(lesson.lessonId)).filter((r) => r.status === "pending").map((r) => r.id).sort();
    expect(listed).toEqual(pending);
    expect(listed.length).toBeGreaterThanOrEqual(1);
    console.log(`reject_and_list: ${listed.length} still pending, listed after reload`);
    await a.context.close();
  });
});

const issuesOf = async (r: Reviewer, lessonId: string) =>
  ((await (await apiAs(r.context, r.page, "GET", `/lessons/${lessonId}/issues`)).json()) as { issues: { kind: string; level: string; resolution?: unknown }[] }).issues;

test.describe("untrusted_text", () => {
  test("untrusted_text: markup from the model is stored as plain text, never runs, and the invented quote is flagged", async ({ browser }) => {
    const lesson = await seedLesson("in_review");
    const a = await openLesson(browser, lesson);
    setStub({ kind: "text", text: UNTRUSTED });
    expect((await askForSuggestion(a.page)).status()).toBe(201);
    const [acc] = await Promise.all([
      a.page.waitForResponse((r) => r.url().includes("/decision")),
      panel(a.page).getByRole("button", { name: /accept/i }).click(),
    ]);
    expect(acc.status()).toBe(200);
    await expect(editorBox(a.page)).toContainText("<script>window.__pwn=1</script>");
    expect(await a.page.evaluate(() => (window as unknown as { __pwn?: unknown }).__pwn)).toBeUndefined();
    expect(await editorBox(a.page).locator("script").count()).toBe(0);
    expect(await a.page.locator("script", { hasText: "__pwn" }).count()).toBe(0);
    // The check job re-runs on the stored accept; the invented quote is flagged.
    try {
      await expect
        .poll(async () => (await issuesOf(a, lesson.lessonId)).some((i) => i.kind === "quote_unmatched" && i.level === "blocking"), { timeout: 40_000 })
        .toBe(true);
    } catch (e) {
      console.log("DEBUG jobs", JSON.stringify(await db().query("select status, content_hash, enqueued_at, finished_at from check_job where lesson_id = $1 order by id", [lesson.lessonId])));
      console.log("DEBUG issues", JSON.stringify((await issuesOf(a, lesson.lessonId)).map((i) => i.kind)));
      console.log("DEBUG worker", JSON.stringify(worker.log.slice(-8)).slice(0, 2500));
      throw e;
    }
    console.log("untrusted_text: __pwn undefined; no script in the editor; quote_unmatched blocking present");
    await a.context.close();
  });
});

test.describe("refusals", () => {
  test("refusals: provider timeout is 503 with nothing stored and the reservation released; locked lesson, author and approved lesson are refused", async ({ browser }) => {
    const lesson = await seedLesson("in_review");
    const a = await openLesson(browser, lesson);
    const hash0 = await latestHash(lesson.lessonId);
    setStub({ kind: "delay", ms: 1600, then: { kind: "error", code: "timeout", error_kind: "timeout" } } as never);
    const res = await askForSuggestion(a.page);
    expect(res.status()).toBe(503);
    expect(await errorCode(res)).toBe("MODEL_UNAVAILABLE");
    expect(await suggestionRows(lesson.lessonId)).toHaveLength(0);
    const open = await db().query("select 1 from spend_reservation where status = 'reserved'");
    expect(open).toHaveLength(0);
    expect(await latestHash(lesson.lessonId)).toBe(hash0);
    await expect(panel(a.page)).toContainText("Nothing changed");

    // Author: ROLE_FORBIDDEN, counts unchanged.
    const author = await createRealIdUser("author");
    const { signInAs } = await import("../support/users");
    const { getStack } = await import("../support/real-stack");
    const ctx = await browser.newContext({ baseURL: getStack().baseURL });
    const ap = await ctx.newPage();
    await signInAs(ap, author);
    const before = { s: (await suggestionRows(lesson.lessonId)).length, m: await db().count("model_call", "lesson_id = $1", [lesson.lessonId]) };
    const anchor = { start: "AA", end: "AB" };
    const forb = await apiAs(ctx, ap, "POST", `/lessons/${lesson.lessonId}/suggestions`, { anchor, selected_text: PASSAGE, note: "x" });
    expect(forb.status()).toBe(403);
    expect(await errorCode(forb)).toBe("ROLE_FORBIDDEN");
    expect({ s: (await suggestionRows(lesson.lessonId)).length, m: await db().count("model_call", "lesson_id = $1", [lesson.lessonId]) }).toEqual(before);

    // Approved lesson: LESSON_LOCKED, no panel, no AI assist button.
    const locked = await seedLesson("approved");
    const r = await openLockedAsReviewer(browser, locked);
    const lockedRes = await apiAs(r.context, r.page, "POST", `/lessons/${locked.lessonId}/suggestions`, { anchor, selected_text: PASSAGE, note: "x" });
    expect(lockedRes.status()).toBe(409);
    expect(await errorCode(lockedRes)).toBe("LESSON_LOCKED");
    expect(await r.page.locator('[aria-label="AI assist"]').count()).toBe(0);
    expect(await r.page.getByRole("button", { name: "AI assist" }).count()).toBe(0);
    expect(await suggestionRows(locked.lessonId)).toHaveLength(0);
    console.log("refusals: 503 MODEL_UNAVAILABLE, 403 ROLE_FORBIDDEN, 409 LESSON_LOCKED; panel count 0 on approved");
    await a.context.close();
    await ctx.close();
    await r.context.close();
  });
});

async function openLockedAsReviewer(browser: import("@playwright/test").Browser, lesson: import("./helpers").SeededLesson) {
  const { context, page, user } = await (await import("./helpers")).signedInContext(browser, "reviewer");
  await page.goto(lesson.url);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  return { context, page, user };
}
