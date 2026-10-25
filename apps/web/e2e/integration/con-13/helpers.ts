/* eslint-disable @typescript-eslint/no-explicit-any -- parsed JSON response bodies from the real stack are untyped */
// NL-113 helpers shared by con-13, con-14 and con-15. Never prints a cookie value; trace stays off.
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { db } from "../support/db";
import { randomBytes } from "node:crypto";
import { hash_password } from "@ls/core/auth/passwords";
import { PrefixedIdGenerator } from "@ls/core/ports/ids";
import { signInAs, type Role, type TestUser } from "../support/users";
import { bridgeCollab } from "../con-12/bridge";
import { cookieHeader, sessionToken } from "../con-12/helpers";
import type { Live } from "./stack";
import type { SeededLesson } from "./seed";

// support/users.ts mints `usr_e2e_<hex>` ids, which are not ULIDs. Collab commands return the editor's id in a StoreAck that the
// web parses with UserId (usr_<ULID>), so a user from there makes every standards decision / slot fill answer COLLAB_UNAVAILABLE
// after the edit was applied. Live-stack specs therefore use ULID-shaped users from here.
const ids = new PrefixedIdGenerator();
export async function createLiveUser(role: Role): Promise<TestUser> {
  const hex = randomBytes(6).toString("hex");
  const user: TestUser = {
    user_id: ids.new_id("usr"),
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

/** A fresh context on web2, signed in as a fresh user of `role`, with /collab bridged to the live collab server. */
export async function openAs(
  browser: Browser,
  live: Live,
  role: Role,
  opts: { bridge?: boolean } = {},
): Promise<{ context: BrowserContext; page: Page; user: TestUser }> {
  const context = await browser.newContext({ baseURL: live.baseURL });
  const page = await context.newPage();
  const user = await signInAs(page, await createLiveUser(role));
  if (opts.bridge !== false) await bridgeCollab(page, live.collabPort);
  return { context, page, user };
}

export async function openLesson(page: Page, lesson: SeededLesson): Promise<void> {
  await page.goto(lesson.url);
  await expect(page.getByTestId("lesson-editor").or(page.getByRole("heading", { level: 1 })).first()).toBeVisible({ timeout: 30_000 });
}

export const issueCard = (page: Page, kindText: string | RegExp) => page.locator("[data-issue-id]").filter({ hasText: kindText });

/** Authenticated API call from the page's own session (cookies stay inside the browser context). */
export async function api(
  page: Page,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<{ status: number; body: any; requestId: string | null }> {
  const res = await page.context().request.fetch(`/api${path}`, {
    method,
    headers: { "content-type": "application/json", origin: new URL(page.url() || "http://localhost").origin },
    data: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* keep text */
  }
  return { status: res.status(), body: parsed, requestId: res.headers()["x-request-id"] ?? null };
}

export async function issuesOf(page: Page, lessonId: string) {
  return api(page, "GET", `/lessons/${lessonId}/issues`);
}

/** Poll GET /issues until the list is no longer pending (and has issues, unless allowEmpty). */
export async function waitCheckedHash(page: Page, lessonId: string, ms = 30_000): Promise<any> {
  let last: any;
  await expect
    .poll(
      async () => {
        last = (await issuesOf(page, lessonId)).body;
        // The list is current only when it was checked at the newest stored hash (a decision or a fill stores a new one).
        return last?.pending === false && Array.isArray(last?.issues) && last.checked_hash === (await stored(lessonId)).content_hash;
      },
      { timeout: ms },
    )
    .toBe(true);
  return last;
}

export async function rows(lessonId: string) {
  const [audit, issue, doc, link, flag] = await Promise.all([
    db().count("audit_event"),
    db().count("issue", "lesson_id = $1", [lessonId]),
    db().count("lesson_doc", "lesson_id = $1", [lessonId]),
    db().count("alignment_link", "lesson_id = $1", [lessonId]),
    db().count("safety_flag", "lesson_id = $1", [lessonId]),
  ]);
  return { audit, issue, doc, link, flag };
}

export async function stored(lessonId: string) {
  return (
    await db().query<{ seq: number; content_hash: string; store_id: string; stored_at: string }>(
      "select seq, content_hash, store_id, stored_at from lesson_doc where lesson_id = $1 order by seq desc limit 1",
      [lessonId],
    )
  )[0]!;
}

export async function sessionCookie(context: BrowserContext): Promise<string> {
  return cookieHeader(await sessionToken(context));
}

export interface AuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  target_kind: string;
  target_id: string;
  version_hash: string | null;
  reason: string | null;
  request_id: string | null;
  store_id: string | null;
}
/** audit_event rows that belong to one lesson (target, details or version hash). Lessons are fresh per test, so this is exact. */
export async function auditFor(lessonId: string): Promise<AuditRow[]> {
  return db().query<AuditRow>(
    `select id, actor_id, action, target_kind, target_id, version_hash, reason, request_id, store_id from audit_event
      where target_id = $1 or target_id like $1 || '%' or details_json::text like '%' || $1 || '%'
         or version_hash in (select content_hash from lesson_doc where lesson_id = $1)
      order by at, id`,
    [lessonId],
  );
}
export async function lastEditor(lessonId: string): Promise<string | null> {
  return (await db().query<{ last_editor_id: string | null }>("select last_editor_id from lesson where id = $1", [lessonId]))[0]!.last_editor_id;
}
/** Open the rail's Issues tab (it is the default today; this keeps specs stable if that changes). */
export async function dialog(page: Page) {
  return page.getByRole("dialog");
}
