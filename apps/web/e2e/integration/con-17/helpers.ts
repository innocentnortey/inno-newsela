// NL-116 support: real-stack helpers for WF-14 (CON-17 AI assist). Synthetic data only; never print a cookie value.
// The web server (started once by global-setup) reaches a REAL collaboration process on E2E_COLLAB_PORT through
// COLLAB_INTERNAL_URL (support/real-stack.ts passes E2E_COLLAB_INTERNAL_URL through); the model is the stub, steered per
// test by the JSON control file E2E_ASSIST_STUB_FILE (wiring/assist.ts, stub mode only).
import { spawn, type ChildProcess } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Locator, type Page } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { hash_password } from "@ls/core/auth/passwords";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { bridgeCollab } from "../con-12/bridge";
import { COLLAB_TOKEN, COOKIE_NAME, cookieHeader, sessionToken } from "../con-12/helpers";
import { signInAs, type Role, type TestUser } from "../support/users";
import { ensureSeeded, freshUnit, seedLesson as seedLessonRow } from "../con-20/seed";
import { db } from "../support/db";
import { getStack, workerEnv } from "../support/real-stack";

export { bridgeCollab, cookieHeader, db, sessionToken };

export interface SeededLesson {
  lessonId: string;
  unitKey: string;
  lessonKey: string;
  url: string;
  snapshot?: { version_id: string; content_hash: string; state_vector: string };
}
export const closeSeedPool = async (): Promise<void> => undefined;

/**
 * A lesson with its unit outline and the standards seeded (NL-99's helpers), so the checks and the Submit/Approve gates can
 * load their context; without an outline row both fail with an InvariantViolation. "wp1" is the WP-1 lesson (Lesson 4, never
 * approvable); "wp3" is the compiled flex-day draft whose blocking findings are all resolved, so it can pass the gates.
 */
export async function seedLesson(state: "in_review" | "submitted" | "approved" = "in_review", content: "wp1" | "wp3" = "wp1"): Promise<SeededLesson> {
  await ensureSeeded();
  const unit = await freshUnit();
  const row = await seedLessonRow({ unit, number: 4, state: state === "approved" ? "submitted" : state, content });
  if (state === "approved") await db().query("update lesson set state = 'approved' where id = $1", [row.lesson_id]);
  return {
    lessonId: row.lesson_id,
    unitKey: row.unit_key,
    lessonKey: row.lesson_key,
    url: `/units/${row.unit_key}/lessons/${row.lesson_key}`,
    ...(row.snapshot ? { snapshot: row.snapshot } : {}),
  };
}
/** The first paragraph of the compiled WP-3 lesson: the passage the transition specs select. */
export const WP3_PASSAGE = "Choose small group or whole class from formative data.";

const ROOT = resolve(__dirname, "../../../../..");
export const PASSAGE = "Today we read a fable about a hare and a lion.";
export const NEW_TEXT = "Today we read a short fable about a hare and a lion.";
export const UNTRUSTED = '<script>window.__pwn=1</script> “…invented quote of fourteen words that the sources never contained at all…”';

export function stubFile(): string {
  const f = process.env.E2E_ASSIST_STUB_FILE;
  if (!f) throw new Error("E2E_ASSIST_STUB_FILE is not set: the con-17 run needs the exports in the plan (section 8)");
  return f;
}
export type StubControl =
  | { kind: "text"; text: string }
  | { kind: "delay"; ms: number; then: StubControl }
  | { kind: "error"; code: string };
export const setStub = (c: StubControl): void => writeFileSync(stubFile(), JSON.stringify(c));

export function collabPort(): number {
  const p = process.env.E2E_COLLAB_PORT;
  if (!p) throw new Error("E2E_COLLAB_PORT is not set");
  return Number(p);
}

export interface Proc {
  stop(): Promise<void>;
  log: string[];
}
async function waitFor200(url: string, ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).status === 200) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`not ready: ${url}`);
}
function killGroup(child: ChildProcess): Promise<void> {
  return new Promise((done) => {
    if (child.exitCode !== null || child.signalCode !== null) return done();
    const hard = setTimeout(() => void process.kill(-(child.pid as number), "SIGKILL"), 5000);
    child.once("exit", () => {
      clearTimeout(hard);
      done();
    });
    try {
      process.kill(-(child.pid as number), "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  });
}
function spawnProc(args: string[], env: NodeJS.ProcessEnv): { child: ChildProcess; log: string[] } {
  const child = spawn("npx", ["tsx", ...args], { cwd: ROOT, env, detached: true });
  const log: string[] = [];
  for (const s of [child.stdout, child.stderr]) s?.on("data", (d: Buffer) => log.push(...d.toString().split("\n").filter(Boolean)));
  return { child, log };
}
const baseEnv = (): NodeJS.ProcessEnv =>
  ({
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    DATABASE_URL: getStack().databaseUrl,
    AUDIT_HASH_SALT: "e2e-salt-0000000000000000",
    COLLAB_INTERNAL_TOKEN: COLLAB_TOKEN,
    SESSION_COOKIE_NAME: COOKIE_NAME,
    MODEL_PROVIDER_MODE: "stub",
    LOG_LEVEL: "info",
  }) as unknown as NodeJS.ProcessEnv;

/** The real collab process (apps/collab/src/main.ts) on the fixed port the web server was told about. Kill only this group. */
export async function startRealCollab(): Promise<Proc> {
  const port = String(collabPort());
  const { child, log } = spawnProc(["apps/collab/src/main.ts"], { ...baseEnv(), PORT: port, COLLAB_PORT: port, STORE_DEBOUNCE_MS: "500", STORE_MAX_DEBOUNCE_MS: "1000" });
  await waitFor200(`http://127.0.0.1:${port}/healthz`, 60_000);
  return { log, stop: () => killGroup(child) };
}

/** The e2e worker (stub model, no provider key): re-runs the checks after a durable save. */
export async function startWorker(): Promise<Proc> {
  const port = String(Number(collabPort()) + 1);
  const { child, log } = spawnProc(["apps/worker/src/main.ts"], workerEnv(baseEnv(), port));
  await waitFor200(`http://127.0.0.1:${port}/healthz`, 60_000);
  return { log, stop: () => killGroup(child) };
}

/**
 * A user whose id is a real prefixed ULID. support/users.ts mints `usr_e2e_<hex>`, which the web's collab client (UserId in
 * StoreAck.stored_by) rightly refuses once a person's edit is stored; production ids are ULIDs. Test data stays synthetic.
 */
export async function createRealIdUser(role: Role): Promise<TestUser> {
  const hex = randomBytes(6).toString("hex");
  const user: TestUser = {
    user_id: new PrefixedIdGenerator().new_id("usr"),
    email: `${role}.${hex}@example.test`,
    name: `E2E ${role} ${hex}`,
    role,
    synthetic: true,
    password: randomBytes(12).toString("base64url"),
  };
  await db().query("insert into app_user (id, email, name, role, synthetic, password_hash) values ($1,$2,$3,$4,$5,$6)", [
    user.user_id, user.email, user.name, user.role, user.synthetic, hash_password(user.password),
  ]);
  return user;
}

/** A fresh browser context signed in as a fresh user of `role` (ULID id). */
export async function signedInContext(browser: import("@playwright/test").Browser, role: Role) {
  const context = await browser.newContext({ baseURL: getStack().baseURL });
  const page = await context.newPage();
  const user = await signInAs(page, await createRealIdUser(role));
  return { context, page, user };
}

export interface Reviewer {
  page: Page;
  context: import("@playwright/test").BrowserContext;
  user: import("../support/users").TestUser;
}

/** Sign a fresh reviewer in, bridge the page's /collab socket to the real collab, and open the lesson. */
export async function openLesson(browser: import("@playwright/test").Browser, lesson: SeededLesson, viewport?: { width: number; height: number }, ready: string = PASSAGE): Promise<Reviewer> {
  const { context, page, user } = await signedInContext(browser, "reviewer");
  if (viewport) await page.setViewportSize(viewport);
  await bridgeCollab(page, collabPort());
  await page.goto(lesson.url);
  await expect(page.locator('[data-testid="lesson-editor"][data-client-state="stored"], [data-testid="lesson-editor"][data-client-state="saved"], [data-testid="lesson-editor"]')).toBeVisible();
  await expect(editorBox(page)).toContainText(ready, { timeout: 20_000 });
  return { page, context, user };
}

export const editorBox = (page: Page): Locator => page.locator('[data-testid="editor-region"]');

/** Select exactly `text` inside the live editor with a DOM range, as a drag would; ProseMirror reads it on selectionchange. */
export async function selectPassage(page: Page, text: string = PASSAGE): Promise<void> {
  const para = editorBox(page).locator('[role="textbox"] p', { hasText: text }).first();
  await para.click();
  await para.evaluate((el, t) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const i = (n.textContent ?? "").indexOf(t);
      if (i >= 0) {
        const r = document.createRange();
        r.setStart(n, i);
        r.setEnd(n, i + t.length);
        const s = window.getSelection()!;
        s.removeAllRanges();
        s.addRange(r);
        return;
      }
    }
    throw new Error("passage not found");
  }, text);
  await page.waitForTimeout(250);
}

/** Put a collapsed caret `offset` characters into the passage and type `text` there, as a co-editor would. */
export async function typeInsidePassage(page: Page, text: string, offset = 12): Promise<void> {
  const para = editorBox(page).locator('[role="textbox"] p', { hasText: PASSAGE }).first();
  await para.click();
  await para.evaluate((el, at) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const n = walker.nextNode()!;
    const r = document.createRange();
    r.setStart(n, at);
    r.collapse(true);
    const s = window.getSelection()!;
    s.removeAllRanges();
    s.addRange(r);
  }, offset);
  await page.waitForTimeout(250);
  await page.keyboard.type(text);
}

export async function openAssist(page: Page): Promise<void> {
  await page.getByRole("button", { name: "More" }).click();
  await page.getByRole("button", { name: "AI assist" }).click();
  await expect(page.getByRole("region", { name: "AI assist" })).toBeVisible();
}

/** Select the passage, open the panel, type a note and click Ask; resolves with the POST response. */
export async function askForSuggestion(page: Page, note = "Make this clearer.", text: string = PASSAGE) {
  await selectPassage(page, text);
  await openAssist(page);
  await page.getByLabel("My note").fill(note);
  const [res] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/suggestions") && r.request().method() === "POST"),
    page.getByRole("button", { name: "Ask for a suggestion" }).click(),
  ]);
  return res;
}

export const panel = (page: Page): Locator => page.getByRole("region", { name: "AI assist" });

export async function latestHash(lessonId: string): Promise<string | undefined> {
  const r = await db().query<{ content_hash: string }>("select content_hash from lesson_doc where lesson_id = $1 order by seq desc limit 1", [lessonId]);
  return r[0]?.content_hash;
}
export const docRows = (lessonId: string): Promise<number> => db().count("lesson_doc", "lesson_id = $1", [lessonId]);
export const suggestionRows = (lessonId: string) =>
  db().query<{ id: string; status: string; selected_text: string; suggested_text: string; model_call_id: string; expires_at: Date }>(
    "select id, status, selected_text, suggested_text, model_call_id, expires_at from suggestion where lesson_id = $1 order by expires_at, id",
    [lessonId],
  );
export const auditFor = (action: string, targetId: string) =>
  db().query<{ id: string; action: string; request_id: string | null; actor_id: string | null }>(
    "select id, action, request_id, actor_id from audit_event where action = $1 and target_id = $2",
    [action, targetId],
  );

/** POST/GET against the web API with a context's cookie (cookie value stays inside this process). */
export async function apiAs(r: Reviewer["context"], page: Page, method: "GET" | "POST", path: string, body?: unknown) {
  const url = `${getStack().baseURL}/api${path}`;
  const headers = { cookie: cookieHeader(await sessionToken(r)), origin: getStack().baseURL, "content-type": "application/json" };
  return method === "GET" ? page.request.get(url, { headers }) : page.request.post(url, { headers, data: body ?? {} });
}
