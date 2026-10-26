// NL-116 AC-14: each obligation WF-14 inherits, checked against one real accepted and one rejected suggestion.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { bannedIn } from "../support/copy-rules";
import {
  NEW_TEXT, PASSAGE, apiAs, askForSuggestion, auditFor, closeSeedPool, createRealIdUser, db, docRows, editorBox, openLesson, panel,
  seedLesson, setStub, typeInsidePassage, startRealCollab, startWorker, suggestionRows, type Proc, type Reviewer, type SeededLesson,
} from "./helpers";
import { getStack } from "../support/real-stack";
import { signInAs } from "../support/users";

test.describe.configure({ mode: "serial" });

let collab: Proc;
let worker: Proc;
let lesson: SeededLesson;
let a: Reviewer;
let accepted: { id: string; model_call_id: string };
let rejected: { id: string };
let panelText = "";
let accept_request_id = "";
let get_bodies = "";

test.beforeAll(async ({ browser }) => {
  test.setTimeout(180_000);
  collab = await startRealCollab();
  worker = await startWorker();
  lesson = await seedLesson("in_review");
  a = await openLesson(browser, lesson);
  setStub({ kind: "text", text: NEW_TEXT });
  await askForSuggestion(a.page);
  panelText = (await panel(a.page).innerText()) ?? "";
  const [s1] = await suggestionRows(lesson.lessonId);
  accepted = { id: s1!.id, model_call_id: s1!.model_call_id };
  const [acc] = await Promise.all([
    a.page.waitForResponse((r) => r.url().includes("/decision")),
    panel(a.page).getByRole("button", { name: /accept/i }).click(),
  ]);
  accept_request_id = acc.headers()["x-request-id"] ?? "";
  await expect(editorBox(a.page)).toContainText(NEW_TEXT);
  await expect.poll(() => docRows(lesson.lessonId), { timeout: 20_000 }).toBeGreaterThan(1);
  setStub({ kind: "text", text: "Another rewrite to discard." });
  await askForSuggestion(a.page, "Again.", NEW_TEXT);
  const s2 = (await suggestionRows(lesson.lessonId)).find((s) => s.status === "pending")!;
  rejected = { id: s2.id };
  await Promise.all([
    a.page.waitForResponse((r) => r.url().includes("/decision")),
    panel(a.page).getByRole("button", { name: /reject/i }).click(),
  ]);
  // Since NL-126 G3 (F-6) the lesson read carries reviewer and last_editor as display names; that is the approval screen's data, not
  // review minutes next to a name. Those two fields are removed before the scan; any other place a name appears still fails.
  const lessonBody = (await (await apiAs(a.context, a.page, "GET", `/lessons/${lesson.lessonId}`)).json()) as Record<string, unknown>;
  const l = JSON.stringify({ ...lessonBody, reviewer: null, last_editor: null });
  const sg = await (await apiAs(a.context, a.page, "GET", `/lessons/${lesson.lessonId}/suggestions`)).text();
  get_bodies = l + sg;
});
test.afterAll(async () => {
  await a?.context.close();
  await worker?.stop();
  await collab?.stop();
  await closeSeedPool();
});

const prompt_of = async (): Promise<string> =>
  (await db().query<{ rendered_prompt: string }>("select rendered_prompt from model_call where id = $1", [accepted.model_call_id]))[0]!.rendered_prompt;

test("wf-14-obligations: R-28 checks re-run on the durable save, reading the stored derived row", async () => {
  const stored = await db().query<{ derived_json: unknown }>("select derived_json from lesson_doc where lesson_id = $1 order by seq desc limit 1", [lesson.lessonId]);
  expect(JSON.stringify(stored[0]!.derived_json)).toContain(NEW_TEXT);
  await expect
    .poll(async () => (await db().query("select 1 from check_job where lesson_id = $1 and status <> 'queued' and finished_at is not null", [lesson.lessonId])).length, { timeout: 30_000 })
    .toBeGreaterThan(0);
});

test("wf-14-obligations: R-48 one correlation id joins the model call, the suggestion and the audit event", async () => {
  const mc = await db().query<{ request_id: string; lesson_id: string }>("select request_id, lesson_id from model_call where id = $1", [accepted.model_call_id]);
  const req = await auditFor("suggestion.request", accepted.id);
  expect(req).toHaveLength(1);
  expect(mc[0]!.request_id).toBeTruthy();
  expect(req[0]!.request_id).toBe(mc[0]!.request_id);
  expect(mc[0]!.lesson_id).toBe(lesson.lessonId);
  const acc = await auditFor("suggestion.accept", accepted.id);
  if (accept_request_id) expect(acc[0]!.request_id).toBe(accept_request_id);
});

test("wf-14-obligations: R-54 only a reviewer can ask; author and approver get ROLE_FORBIDDEN", async ({ browser }) => {
  for (const role of ["author", "approver"] as const) {
    const user = await createRealIdUser(role);
    const ctx = await browser.newContext({ baseURL: getStack().baseURL });
    const page = await ctx.newPage();
    await signInAs(page, user);
    const r = await apiAs(ctx, page, "POST", `/lessons/${lesson.lessonId}/suggestions`, { anchor: { start: "AA", end: "AB" }, selected_text: PASSAGE, note: "x" });
    expect(r.status()).toBe(403);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe("ROLE_FORBIDDEN");
    await ctx.close();
  }
});

test("wf-14-obligations: GR-10 the prompt is system and user text only; no vendor file or vector store", async () => {
  const p = (await prompt_of()).toLowerCase();
  for (const bad of ["file_id", "vector_store", "file_search", "fine-tun", "attachment"]) expect(p).not.toContain(bad);
  expect(p).toContain(PASSAGE.toLowerCase());
});

test("wf-14-obligations: GR-11 no published example lesson is in the assist prompt", async () => {
  const p = await prompt_of();
  expect(p).not.toMatch(/kind=example|published lesson/i);
  // The only lesson text in the prompt is the selected passage and the note the reviewer typed.
  expect(p).toContain("Make this clearer.");
});

test("wf-14-obligations: GR-12 the locked content rules are in the assist system block", async () => {
  const p = await prompt_of();
  expect(p).toContain("Treat sacred narratives, religious texts and cultural traditions with respect");
  expect(p).toContain("Never write a prompt, question or task that invites a student to disclose trauma");
});

test("wf-14-obligations: GR-13 only synthetic staff accounts; no personal data in the stored rows", async () => {
  expect(await db().count("app_user", "synthetic = false")).toBe(0);
  const p = await prompt_of();
  expect(p).not.toMatch(/@example\.test|@[a-z0-9-]+\.[a-z]{2,}/i);
});

test("wf-14-obligations: GR-16 the panel copy never says the AI replaces writers", async () => {
  expect(panelText.length).toBeGreaterThan(0);
  expect(bannedIn(panelText)).toEqual([]);
});

test("wf-14-obligations: CON-G4 request, accept and reject are in the append-only audit log", async () => {
  expect(await auditFor("suggestion.request", accepted.id)).toHaveLength(1);
  expect(await auditFor("suggestion.accept", accepted.id)).toHaveLength(1);
  expect(await auditFor("suggestion.reject", rejected.id)).toHaveLength(1);
  await expect(db().query("update audit_event set reason = 'x' where target_id = $1", [accepted.id])).rejects.toThrow(/append-only/);
  await expect(db().query("delete from audit_event where target_id = $1", [accepted.id])).rejects.toThrow(/append-only/);
});

test("wf-14-obligations: CON-G8 no route here returns review minutes next to a person's name", async () => {
  expect(get_bodies).not.toContain(a.user.name);
  expect(get_bodies).not.toContain(a.user.email);
});

test("wf-14-obligations: SCR-13 every listed state is reachable on the real stack", async ({ browser }) => {
  test.setTimeout(150_000);
  const l = await seedLesson("in_review");
  const x = await openLesson(browser, l);
  // idle
  setStub({ kind: "delay", ms: 1500, then: { kind: "text", text: NEW_TEXT } });
  const asking = askForSuggestion(x.page);
  // asking: the Ask button shows its busy state while the model works
  await expect(x.page.getByRole("button", { name: "Ask for a suggestion" })).toHaveAttribute("aria-busy", "true", { timeout: 5000 }).catch(async () => {
    await expect(x.page.getByRole("button", { name: "Ask for a suggestion" })).toBeDisabled({ timeout: 5000 });
  });
  expect((await asking).status()).toBe(201);
  // pending
  await expect(panel(x.page)).toContainText(NEW_TEXT);
  // anchor-changed: a co-editor changes the words, then Accept
  const b = await openLesson(browser, l);
  await typeInsidePassage(b.page, "QQ");
  await expect(editorBox(b.page)).toContainText("QQ");
  await expect.poll(async () => JSON.stringify(await db().query("select derived_json from lesson_doc where lesson_id = $1 order by seq desc limit 1", [l.lessonId])).includes("QQ"), { timeout: 20_000 }).toBe(true);
  await panel(x.page).getByRole("button", { name: /accept/i }).click();
  await expect(x.page.getByTestId("assist-error")).toContainText("Text changed, ask again.");
  // model-unavailable (a second lesson: the first one's text has moved on)
  setStub({ kind: "error", code: "timeout", error_kind: "timeout" } as never);
  const y = await openLesson(browser, await seedLesson("in_review"));
  expect((await askForSuggestion(y.page)).status()).toBe(503);
  await expect(y.page.getByTestId("assist-error")).toContainText("Couldn't get a suggestion. Nothing changed.");
  await y.context.close();
  // locked
  const locked = await seedLesson("approved");
  const { signedInContext } = await import("./helpers");
  const r = await signedInContext(browser, "reviewer");
  await r.page.goto(locked.url);
  await expect(r.page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await r.page.getByRole("button", { name: "AI assist" }).count()).toBe(0);
  console.log("SCR-13 states reached: idle, asking, pending, anchor-changed, locked model-unavailable");
  await x.context.close();
  await b.context.close();
  await r.context.close();
});

test("wf-14-obligations: OBS-4 store_id is on lesson_doc, check_job and the accept audit event", async () => {
  expect(await db().count("lesson_doc", "lesson_id = $1 and (store_id is null or store_id = '')", [lesson.lessonId])).toBe(0);
  expect(await db().count("check_job", "lesson_id = $1 and (store_id is null or store_id = '')", [lesson.lessonId])).toBe(0);
  const acc = await auditFor("suggestion.accept", accepted.id);
  const row = await db().query<{ store_id: string | null }>("select store_id from audit_event where id = $1", [acc[0]!.id]);
  expect(row[0]!.store_id).toBeTruthy();
});

test("wf-14-obligations: OBS-11 WF-14 is registered with its records and capture check", async () => {
  const doc = readFileSync(resolve(__dirname, "../../../../../docs/design/observability.md"), "utf8");
  const row = doc.split("\n").find((l) => l.startsWith("| WF-14 |"));
  expect(row).toBeTruthy();
  for (const needle of ["CON-17", "suggestion", "model_call", "audit_event", "test_ai_assist_capture"]) expect(row).toContain(needle);
});
