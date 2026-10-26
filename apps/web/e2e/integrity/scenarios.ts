// NL-125: the scenario bodies, one per assertion (plan section 5). All through the real entry points: the SCR-9 editor in
// real Chromium over the real collaboration socket, the SCR-9 Submit button, the SCR-14 Approve button and the transitions route.
// No collab fault hooks and no product code here; the only SQL is the test-database fixtures the existing specs also use.
import { expect, type Page } from "@playwright/test";
import { content_hash } from "@ls/ydoc/hash";
import { lesson_to_ydoc, ydoc_to_lesson } from "@ls/ydoc/convert";
import type { StoredLesson } from "@ls/schema/lesson";
import { auditCount, docCount, firstTextbox, latestDoc, savedState } from "../integration/con-12/helpers";
import { apiAs, approveBody, errCode, latestDocHash, latestSubmit, lessonPath, rawSocket, storedVector, transition } from "../integration/con-18/flow";
import { expectUnchanged, snapshot } from "../integration/con-18/counts";
import { db } from "../integration/support/db";
import { COPY } from "../../src/features/approval/copy";
import { typeAndMeasure } from "./store-latency";
import { FAULT, TRIALS } from "./results";
import type { Rec, Seat, World } from "./trial";

const box = (page: Page, i: number) => page.locator('[data-testid^="section-"] [role="textbox"]').nth(i);
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const pad = (n: number) => String(n).padStart(2, "0");
const lessonId = (w: World): string => w.lesson.lesson_id;

export async function openEditor(w: World, s: Seat): Promise<void> {
  await s.page.goto(`${w.stack.baseURL}${lessonPath(w.lesson)}`);
  await expect(firstTextbox(s.page)).toHaveAttribute("aria-readonly", "false", { timeout: 30_000 });
}

export async function openApproval(w: World, s: Seat): Promise<void> {
  await s.page.goto(`${w.stack.baseURL}${lessonPath(w.lesson, true)}`);
  await expect(s.page.getByRole("heading", { name: "Checklist" })).toBeVisible({ timeout: 30_000 });
}

async function typeIn(page: Page, i: number, text: string, delay?: number): Promise<void> {
  await box(page, i).click();
  await page.keyboard.type(text, delay === undefined ? undefined : { delay });
}

async function stored(w: World, token: string): Promise<void> {
  await expect
    .poll(async () => JSON.stringify((await latestDoc(lessonId(w)))?.derived_json ?? "").includes(token), { timeout: 20_000, intervals: [100] })
    .toBe(true);
}

/** The real SCR-9 Submit button; resolves with the 200 response. */
async function submitViaUi(w: World, s: Seat, rec: Rec): Promise<void> {
  const btn = s.page.getByRole("button", { name: "Submit for approval" });
  await expect(btn).not.toHaveAttribute("aria-disabled", "true", { timeout: 30_000 });
  await expect(btn).toBeEnabled({ timeout: 30_000 });
  const reply = s.page.waitForResponse((r) => r.url().includes(`/api/lessons/${lessonId(w)}/transitions`) && r.request().method() === "POST");
  await btn.click();
  const res = await reply;
  expect(res.status(), await res.text()).toBe(200);
  rec.request_ids.push(res.headers()["x-request-id"] ?? "");
}

const pinOf = async (w: World) => {
  const s = await latestSubmit(lessonId(w));
  return { snapshot_hash: s.content_hash, snapshot_state_vector: s.state_vector };
};

/** Press Approve on SCR-14 with the rating chosen; resolves with the response. */
async function approveViaUi(s: Seat, id: string) {
  await s.page.getByLabel("Usable as drafted").check();
  const reply = s.page.waitForResponse((r) => r.url().includes(`/api/lessons/${id}/transitions`) && r.request().method() === "POST");
  await s.page.getByRole("button", { name: "Approve this version" }).click();
  return reply;
}

// ---------------------------------------------------------------------------------------------------------------------
/** AC-1 stale approve: C loaded the snapshot, B withdrew, edited and resubmitted; C's approve is 409 STALE_PIN and nothing changes. */
export async function stale_approve(w: World, rec: Rec): Promise<void> {
  const id = lessonId(w);
  const t = w.trial;
  const [ta1, tb1, tb2] = [`sa${pad(t)}a1`, `sa${pad(t)}b1`, `sa${pad(t)}b2`];
  await openEditor(w, w.A);
  await openEditor(w, w.B);
  rec.store_ms = await typeAndMeasure(id, () => typeIn(w.A.page, 0, `${ta1} `));
  await typeIn(w.B.page, 1, `${tb1} `);
  await stored(w, ta1);
  await stored(w, tb1);
  await expect(savedState(w.A.page, "stored")).toBeVisible({ timeout: 15_000 });
  await submitViaUi(w, w.A, rec);
  const first = await latestSubmit(id);

  await openApproval(w, w.C);
  const apiB = await apiAs(w.stack, w.B.user);
  const apiC = await apiAs(w.stack, w.C.user);
  const wd = await transition(apiB, id, { action: "withdraw" });
  expect(wd.status, wd.text).toBe(200);
  rec.request_ids.push(wd.requestId ?? "");
  await expect(box(w.B.page, 1)).toHaveAttribute("aria-readonly", "false", { timeout: 20_000 });
  await typeIn(w.B.page, 1, `${tb2} `);
  await stored(w, tb2);
  const re = await transition(apiB, id, { action: "submit", client_state_vector: await storedVector(id) });
  expect(re.status, re.text).toBe(200);
  rec.request_ids.push(re.requestId ?? "");
  const second = await latestSubmit(id);
  expect(second.content_hash).not.toBe(first.content_hash);

  // C presses Approve on the page it loaded before the resubmit: refused, the page says so (reachability), nothing written.
  const before = await snapshot(id);
  const res = await approveViaUi(w.C, id);
  expect(res.status()).toBe(409);
  rec.request_ids.push(res.headers()["x-request-id"] ?? "");
  expect(((await res.json()) as { error: { code: string } }).error.code).toBe("STALE_PIN");
  await expect(w.C.page.getByText(COPY.stale)).toBeVisible();
  // And the API call with the OLD pin.
  const old = await transition(apiC, id, approveBody({ snapshot_hash: first.content_hash, snapshot_state_vector: first.state_vector }));
  expect(old.status).toBe(409);
  expect(errCode(old)).toBe("STALE_PIN");
  expectUnchanged(before, await snapshot(id));
  // Reload shows the new snapshot.
  await w.C.page.getByRole("button", { name: "Reload" }).click();
  await expect(w.C.page.getByLabel(`snapshot ${second.content_hash.slice(0, 4)}…${second.content_hash.slice(-4)}`).first()).toBeVisible({ timeout: 15_000 });
  rec.detail = { codes: ["STALE_PIN", "STALE_PIN"], counts_unchanged: true, snapshot_changed: true };
}

// ---------------------------------------------------------------------------------------------------------------------
/** AC-2 zero edits after lock: a page that has not yet heard about the lock types; the server refuses, writes nothing, the typist is told. */
export async function zero_edits_after_lock(w: World, rec: Rec): Promise<void> {
  const id = lessonId(w);
  const hold = w.hold!;
  const t = w.trial;
  const early = `ze${pad(t)}early`;
  await openEditor(w, w.A);
  await openEditor(w, w.B);
  rec.store_ms = await typeAndMeasure(id, () => typeIn(w.A.page, 0, `${early} `));
  await stored(w, early);
  await expect(savedState(w.A.page, "stored")).toBeVisible({ timeout: 15_000 });
  await expect(box(w.B.page, 0)).toContainText(early, { timeout: 15_000 });

  // Lock: B presses the real Submit button while A's page is not told what the server did (frames to A held). A's own Submit
  // would swap A's page to the read view, so B is the one who submits and A is the one still typing.
  hold.on = true;
  await submitViaUi(w, w.B, rec);
  const afterLock = await snapshot(id);
  expect(afterLock.state).toBe("submitted");
  const docs = await docCount(id);
  const audits = await auditCount();

  // A real keystroke in the still-open editor.
  const late = `LATE${pad(t)}`;
  await expect(firstTextbox(w.A.page)).toHaveAttribute("aria-readonly", "false");
  await box(w.A.page, 0).click();
  await w.A.page.keyboard.type(late);
  await sleep(400);
  hold.release();

  const notice = w.A.page.getByText(/Your last edits were not saved because/);
  await expect(notice).toBeVisible({ timeout: 15_000 });
  const removed = w.A.page.getByText(/Removed text: “/);
  await expect(removed).toBeVisible();
  await expect(firstTextbox(w.A.page)).toHaveAttribute("aria-readonly", "true");
  await expect(savedState(w.A.page, "read_only")).toBeVisible();
  const removedText = await removed.innerText();
  expect(removedText, "the typist is told which text was refused").toContain(late.slice(0, 4));

  // A second writer on a raw socket is refused too.
  const raw = await rawSocket(w.stack, w.B.context, id);
  try {
    expect(raw.ofType("mode")[0]).toMatchObject({ mode: "read_only" });
    raw.edit(`LATEB${pad(t)}`);
    await raw.until(() => raw.ofType("refused").length > 0, 8000, "refused");
    expect(raw.ofType("refused")[0]).toMatchObject({ code: "LESSON_LOCKED" });
  } finally {
    raw.destroy();
  }

  if (FAULT && t === Math.ceil(TRIALS / 2)) {
    // Fault fixture (AC-7), test side only: one stray row for this trial's own lesson, as a write that slipped past the lock would leave.
    await db().query(
      `insert into lesson_doc (lesson_id, seq, store_id, ydoc_bytes, derived_json, content_hash, state_vector, schema_version)
       select lesson_id, seq + 1, 'st_fault_' || substr(md5(random()::text), 1, 8), ydoc_bytes, derived_json, content_hash, state_vector, schema_version
         from lesson_doc where lesson_id = $1 order by seq desc limit 1`,
      [id],
    );
  }
  await sleep(2500); // past the 500/1000 ms store debounce
  expect(await docCount(id), "lesson_doc rows after the lock").toBe(docs);
  expect(await auditCount(), "audit_event rows after the lock").toBe(audits);
  const end = await snapshot(id);
  expect(end).toEqual(afterLock);
  rec.detail = { lock_rows_added: 0, refused_notice: true, read_only: true, raw_refused: "LESSON_LOCKED", docs_after_lock: docs };
}

// ---------------------------------------------------------------------------------------------------------------------
/** AC-3 no silent keystroke loss: every token typed either lands in the submit snapshot or is in the refused notice. */
export async function no_silent_loss(w: World, rec: Rec): Promise<void> {
  const id = lessonId(w);
  const t = w.trial;
  const tok = (who: string, i: number) => `n${pad(t)}${who}${pad(i)}`;
  const a: string[] = []; // tokens whose every keystroke went into an editable, focused editor
  const b: string[] = [];
  let ambiguous = 0; // tokens typed while the editor turned read-only under the typist: not counted, reported
  const editable = (page: Page, idx: number) =>
    page.evaluate((i) => {
      const el = document.querySelectorAll('[data-testid^="section-"] [role="textbox"]')[i];
      return !!el && el.getAttribute("contenteditable") === "true" && document.activeElement === el;
    }, idx).catch(() => false);
  const typeTokens = async (s: Seat, idx: number, who: string, into: string[], from: number, to: number, delay: number) => {
    for (let i = from; i <= to; i++) {
      const before = await editable(s.page, idx);
      if (!before) break; // the page already shows the read view: nothing can be typed
      await s.page.keyboard.type(`${tok(who, i)} `, { delay }).catch(() => {});
      if (await editable(s.page, idx)) into.push(tok(who, i));
      else ambiguous += 1;
    }
  };
  await openEditor(w, w.A);
  await openEditor(w, w.B);
  await box(w.A.page, 0).click();
  await box(w.B.page, 1).click();
  // Before the lock: A and B type; A waits until its edits are stored (Submit is off until then).
  await Promise.all([typeTokens(w.A, 0, "a", a, 1, 4, 8), typeTokens(w.B, 1, "b", b, 1, 4, 8)]);
  expect(a.length).toBe(4);
  await stored(w, a[3]!);
  await expect(savedState(w.A.page, "stored")).toBeVisible({ timeout: 15_000 });
  // B keeps typing across the lock (about 1.5 s of keystrokes); A presses the real Submit button 250 ms in, without moving focus
  // (a DOM click). A retries when the server says the edits are not stored yet (B's keystrokes are still arriving).
  const bTyping = typeTokens(w.B, 1, "b", b, 5, 12, 25);
  await sleep(250);
  const btn = w.A.page.getByRole("button", { name: "Submit for approval" });
  let res: Awaited<ReturnType<Page["waitForResponse"]>> | undefined;
  let attempts = 0;
  for (; attempts < 8; attempts++) {
    await expect(btn).toBeEnabled({ timeout: 30_000 });
    const reply = w.A.page.waitForResponse((r) => r.url().includes(`/api/lessons/${id}/transitions`) && r.request().method() === "POST");
    await btn.evaluate((el) => (el as HTMLButtonElement).click());
    res = await reply;
    rec.request_ids.push(res.headers()["x-request-id"] ?? "");
    if (res.status() === 200) break;
    expect(res.status(), await res.text()).toBe(409);
    await sleep(300);
  }
  expect(res?.status(), "Submit succeeded within 8 attempts").toBe(200);
  await bTyping;
  await expect.poll(async () => (await snapshot(id)).state, { timeout: 15_000 }).toBe("submitted");
  await sleep(2500);

  const snap = (await db().query<{ lesson_json: unknown }>("select lesson_json from lesson_version where lesson_id = $1 and kind = 'submit' order by number desc limit 1", [id]))[0]!;
  const snapText = JSON.stringify(snap.lesson_json);
  const notice = async (s: Seat): Promise<string> => {
    const loc = s.page.getByText(/Removed text: “/);
    return (await loc.count()) > 0 ? await loc.first().innerText() : "";
  };
  const noticeA = await notice(w.A);
  const noticeB = await notice(w.B);
  const typed = [...a, ...b];
  const inSnapshot = typed.filter((x) => snapText.includes(x));
  const refused = typed.filter((x) => !snapText.includes(x) && ((a.includes(x) && noticeA.includes(x)) || (b.includes(x) && noticeB.includes(x))));
  const lost = typed.filter((x) => !inSnapshot.includes(x) && !refused.includes(x));
  rec.detail = { submit_attempts: attempts + 1, ambiguous, typed: typed.length, in_snapshot: inSnapshot.length, refused: refused.length, union: inSnapshot.length + refused.length, lost: lost };
  expect(lost, `tokens in neither the snapshot nor the refused notice (typed ${typed.length}, snapshot ${inSnapshot.length}, refused ${refused.length})`).toEqual([]);
  expect(inSnapshot.length + refused.length).toBe(typed.length);
}

// ---------------------------------------------------------------------------------------------------------------------
/** AC-4a four-eyes: the last stored editor cannot approve; the same approve passes once the cause is removed. */
export async function four_eyes(w: World, rec: Rec): Promise<void> {
  const id = lessonId(w);
  const tb = `fe${pad(w.trial)}b1`;
  await openEditor(w, w.B);
  rec.store_ms = await typeAndMeasure(id, () => typeIn(w.B.page, 1, `${tb} `));
  await stored(w, tb);
  await expect(savedState(w.B.page, "stored")).toBeVisible({ timeout: 15_000 });
  await submitViaUi(w, w.B, rec);
  // Test-database fixture only (as NL-115): the approver is made the last stored editor.
  await db().query("update lesson set last_editor_id = $2 where id = $1", [id, w.C.user.user_id]);
  await openApproval(w, w.C);
  const apiC = await apiAs(w.stack, w.C.user);
  const pin = await pinOf(w);
  const before = await snapshot(id);
  const res = await approveViaUi(w.C, id); // the real SCR-14 button: refused, and the page says who must approve
  expect(res.status()).toBe(422);
  expect(((await res.json()) as { error: { code: string } }).error.code).toBe("FOUR_EYES");
  rec.request_ids.push(res.headers()["x-request-id"] ?? "");
  await expect(w.C.page.getByText(COPY.fourEyesNo)).toBeVisible();
  const no = await transition(apiC, id, approveBody(pin));
  expect(no.status).toBe(422);
  expect(errCode(no)).toBe("FOUR_EYES");
  expectUnchanged(before, await snapshot(id));
  // Remove the cause: the same approve now passes, so the refusal was four-eyes and not a broken fixture.
  await db().query("update lesson set last_editor_id = $2 where id = $1", [id, w.B.user.user_id]);
  const yes = await transition(apiC, id, approveBody(pin));
  expect(yes.status, yes.text).toBe(200);
  expect((await snapshot(id)).state).toBe("approved");
  rec.detail = { first: "FOUR_EYES", counts_unchanged: true, then: "approved" };
}

// ---------------------------------------------------------------------------------------------------------------------
/** AC-4b a pending suggestion blocks Submit and Approve (NL-116). Created through the real route; lifted through the real route. */
export async function suggestion_blocks(w: World, rec: Rec): Promise<void> {
  const id = lessonId(w);
  const passage = "Choose small group or whole class from formative data.";
  await openEditor(w, w.A);
  const apiA = await apiAs(w.stack, w.A.user);
  const made = await apiA.post(`/api/lessons/${id}/suggestions`, { data: { anchor: { start: "AA", end: "AB" }, selected_text: passage, note: "n" } });
  expect(made.status(), await made.text()).toBe(201);
  const sid = ((await made.json()) as { suggestion_id: string }).suggestion_id;
  // Submit is refused while the suggestion is pending, and writes nothing.
  const before = await snapshot(id);
  const refused = await transition(apiA, id, { action: "submit", client_state_vector: await storedVector(id) });
  expect(refused.status).toBe(422);
  expect(errCode(refused)).toBe("SUGGESTION_PENDING");
  rec.request_ids.push(refused.requestId ?? "");
  expectUnchanged(before, await snapshot(id));
  // Reject through the real route: Submit now passes.
  const rej = await apiA.post(`/api/lessons/${id}/suggestions/${sid}/decision`, { data: { decision: "reject" } });
  expect(rej.status(), await rej.text()).toBe(200);
  await submitViaUi(w, w.A, rec);

  // Approve: a pending suggestion on the submitted lesson (test-database fixture, as the NL-116 spec does) is refused first.
  const sid2 = `sg_e2e_${w.trial}_${Date.now().toString(36)}`;
  await db().query(
    "insert into suggestion (id, lesson_id, anchor_start, anchor_end, selected_text, note, suggested_text, status, requested_by, expires_at, model_call_id) values ($1,$2,'AA','AB',$3,'n','y','pending',$4,now() + interval '30 minutes','mc_01SEEDEDFORAPPROVEGATE0000')",
    [sid2, id, passage, w.A.user.user_id],
  );
  const apiC = await apiAs(w.stack, w.C.user);
  const pin = await pinOf(w);
  const b2 = await snapshot(id);
  const no = await transition(apiC, id, approveBody(pin));
  expect(no.status).toBe(422);
  expect(errCode(no)).toBe("SUGGESTION_PENDING");
  rec.request_ids.push(no.requestId ?? "");
  expectUnchanged(b2, await snapshot(id));
  await db().query("update suggestion set status = 'rejected', decided_by = $2, decided_at = now() where id = $1", [sid2, w.A.user.user_id]);
  const yes = await transition(apiC, id, approveBody(pin));
  expect(yes.status, yes.text).toBe(200);
  rec.detail = { submit: "SUGGESTION_PENDING", approve: "SUGGESTION_PENDING", lifted: true };
}

// ---------------------------------------------------------------------------------------------------------------------
/** AC-5 round trip: JSON to Y.Doc to JSON keeps the hash after reload; the export carries the approved snapshot's hash (NL-102). */
export async function round_trip(w: World, rec: Rec): Promise<void> {
  const id = lessonId(w);
  const [ta, tb] = [`rt${pad(w.trial)}a1`, `rt${pad(w.trial)}b1`];
  await openEditor(w, w.A);
  await openEditor(w, w.B);
  rec.store_ms = await typeAndMeasure(id, () => typeIn(w.A.page, 0, `${ta} `));
  await typeIn(w.B.page, 1, `${tb} `);
  await stored(w, ta);
  await stored(w, tb);
  await expect(savedState(w.A.page, "stored")).toBeVisible({ timeout: 15_000 });
  await w.A.page.reload();
  await expect(firstTextbox(w.A.page)).toHaveAttribute("aria-readonly", "false", { timeout: 30_000 });
  await expect(box(w.A.page, 0)).toContainText(ta, { timeout: 20_000 });
  await expect(box(w.A.page, 1)).toContainText(tb, { timeout: 20_000 });

  const row = (await latestDoc(id))!;
  const lesson = row.derived_json as StoredLesson;
  expect(content_hash(lesson)).toBe(row.content_hash);
  const back = ydoc_to_lesson(lesson_to_ydoc(lesson), lesson.schema_version);
  expect(content_hash(back)).toBe(row.content_hash);

  // Export half: the exported lesson hash equals the approval snapshot hash.
  await submitViaUi(w, w.A, rec);
  const apiC = await apiAs(w.stack, w.C.user);
  const pin = await pinOf(w);
  const yes = await transition(apiC, id, approveBody(pin));
  expect(yes.status, yes.text).toBe(200);
  const origin = { Origin: w.stack.baseURL };
  const made = await apiC.post(`/api/units/${w.unit.unit_key}/exports`, { headers: origin });
  expect(made.status(), await made.text()).toBe(201);
  const created = (await made.json()) as { export_id: string };
  const dl = await apiC.get(`/api/exports/${created.export_id}/download`);
  expect(dl.status()).toBe(200);
  const bundle = (await dl.json()) as { lessons: { lesson_id: string; content_hash: string }[] };
  const mine = bundle.lessons.find((l) => l.lesson_id === id);
  expect(mine, "the approved lesson is in the bundle").toBeDefined();
  const snap = await latestSubmit(id);
  const [ap] = await db().query<{ content_hash: string }>("select content_hash from lesson_version where lesson_id = $1 and kind = 'approve' order by number desc limit 1", [id]);
  expect(mine!.content_hash).toBe(ap!.content_hash);
  expect(mine!.content_hash).toBe(snap.content_hash);
  rec.detail = { stored_hash_ok: true, round_trip_ok: true, export_hash_equals_snapshot: true, stored_doc_rows: await docCount(id), latest_hash: (await latestDocHash(id)).slice(0, 12) };
}

// ---------------------------------------------------------------------------------------------------------------------
/** AC-9 ids: every row the flow wrote carries the web request id (WF-15) and the store id (WF-9). */
export async function ids(w: World, rec: Rec): Promise<void> {
  const id = lessonId(w);
  const tok = `id${pad(w.trial)}a1`;
  await openEditor(w, w.A);
  await typeIn(w.A.page, 0, `${tok} `);
  await stored(w, tok);
  await expect(savedState(w.A.page, "stored")).toBeVisible({ timeout: 15_000 });
  const apiA = await apiAs(w.stack, w.A.user);
  const apiC = await apiAs(w.stack, w.C.user);
  const sub = await transition(apiA, id, { action: "submit", client_state_vector: await storedVector(id) });
  expect(sub.status, sub.text).toBe(200);
  const pin = await pinOf(w);
  const stale = await transition(apiC, id, approveBody({ snapshot_hash: "0".repeat(64), snapshot_state_vector: pin.snapshot_state_vector }));
  expect(stale.status).toBe(409);
  const ok = await transition(apiC, id, approveBody(pin, "rewritten"));
  expect(ok.status, ok.text).toBe(200);
  rec.request_ids.push(sub.requestId ?? "", stale.requestId ?? "", ok.requestId ?? "");

  const events = await db().query<{ to_state: string; request_id: string | null }>("select to_state, request_id from review_event where lesson_id = $1 order by at", [id]);
  expect(events.map((e) => e.to_state)).toEqual(["submitted", "approved"]);
  expect(events[0]!.request_id).toBe(sub.requestId);
  expect(events[1]!.request_id).toBe(ok.requestId);
  const audits = await db().query<{ action: string; request_id: string | null; store_id: string | null }>("select action, request_id, store_id from audit_event where target_id = $1", [id]);
  expect(audits.length).toBeGreaterThan(0);
  // Rows the web wrote carry the request id; rows the collaboration server wrote (lesson.store) carry the store id.
  expect(audits.filter((a) => (a.action === "lesson.store" ? !a.store_id : !a.request_id)).map((a) => a.action)).toEqual([]);
  
  const docs = await db().query<{ store_id: string | null }>("select store_id from lesson_doc where lesson_id = $1 order by seq", [id]);
  expect(docs.length).toBeGreaterThanOrEqual(2);
  expect(docs.every((d) => d.store_id !== null && d.store_id !== "")).toBe(true);
  rec.store_id = docs.at(-1)!.store_id;
  rec.detail = { review_events: events.length, audit_rows: audits.length, lesson_doc_rows: docs.length, refused_wrote_nothing: true };
}
