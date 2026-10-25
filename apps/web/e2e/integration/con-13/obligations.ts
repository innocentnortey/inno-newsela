// NL-113 shared checks for the three wf-1x obligation files (one test per obligation id; each file ends by printing the ids that passed).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { db } from "../support/db";
import { workerEnv } from "../support/real-stack";
import { liveStack, type Live } from "./stack";
import { enqueueCheck, seedWp1WithStandards, type SeededLesson } from "./seed";
import { api, issuesOf, openAs, openLesson, waitCheckedHash } from "./helpers";
import type { TestUser } from "../support/users";

export const ROOT = resolve(__dirname, "../../../../..");
export const WEB = resolve(ROOT, "apps/web");

export interface Flow {
  live: Live;
  lesson: SeededLesson;
  reviewer: { context: BrowserContext; page: Page; user: TestUser };
  author: { context: BrowserContext; page: Page; user: TestUser };
}

/** A seeded Lesson 4 (with two standards awaiting a decision), checked once, with a reviewer and an author signed in on web2. */
export async function startFlow(browser: Browser): Promise<Flow> {
  const live = await liveStack();
  const lesson = await seedWp1WithStandards();
  await enqueueCheck(lesson.lessonId);
  const reviewer = await openAs(browser, live, "reviewer");
  const author = await openAs(browser, live, "author", { bridge: false });
  await waitCheckedHash(reviewer.page, lesson.lessonId);
  return { live, lesson, reviewer, author };
}
export async function endFlow(f: Flow | undefined): Promise<void> {
  await f?.reviewer.context.close();
  await f?.author.context.close();
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

export const RESTRICTED = ["docs", "source", "restricted"].join("/");
export function restrictedFolderRule(): void {
  expect(spawnSync("git", ["check-ignore", "-q", `${RESTRICTED}/x`], { cwd: ROOT }).status).toBe(0);
  expect(spawnSync("git", ["ls-files", RESTRICTED], { cwd: ROOT, encoding: "utf8" }).stdout.trim()).toBe("");
  for (const dir of ["con-13", "con-14", "con-15"]) {
    for (const f of walk(join(WEB, "e2e/integration", dir)).filter((p) => p.endsWith(".ts"))) expect(readFileSync(f, "utf8"), f).not.toContain(RESTRICTED);
  }
}

export async function staffOnly(): Promise<void> {
  const roles = await db().query<{ role: string }>("select distinct role from app_user");
  for (const r of roles) expect(["author", "reviewer", "approver"]).toContain(r.role);
  const cols = await db().query<{ column_name: string }>("select column_name from information_schema.columns where table_schema = 'public'");
  expect(cols.map((c) => c.column_name).filter((c) => /student|teacher_of_record|school_id|class_id/i.test(c))).toEqual([]);
}

const FRAMING = /replaces? (the )?(writers?|teachers?|editors?|humans?|experts?)|AI[- ]written|fully automated/i;
export async function expertFraming(page: Page, lesson: SeededLesson): Promise<void> {
  await openLesson(page, lesson);
  await page.getByRole("tab", { name: /Standards/ }).click();
  expect(await page.locator("body").innerText()).not.toMatch(FRAMING);
  expect(await page.locator("body").innerText()).not.toMatch(/^standards-aligned$/im);
}

export function observabilityRow(wf: string): string {
  const row = readFileSync(join(ROOT, "docs/design/observability.md"), "utf8").split("\n").find((l) => l.startsWith(`| ${wf} |`));
  expect(row, `${wf} row`).toBeDefined();
  return row!;
}
export function registered(wf: string, token: string, specFile: string): void {
  expect(observabilityRow(wf)).toContain(token);
  expect(existsSync(join(WEB, "e2e/integration", specFile))).toBe(true);
}

/** CON-G1 on the server: an author's call is ROLE_FORBIDDEN. */
export async function authorForbidden(f: Flow, path: string, body: unknown): Promise<void> {
  const res = await api(f.author.page, "POST", path, body);
  expect(res.status).toBe(403);
  expect(res.body.error.code).toBe("ROLE_FORBIDDEN");
}

/** CON-G8: no route in this flow returns review minutes next to a person's name. */
export async function noNamedMinutes(f: Flow): Promise<void> {
  const bodies = [
    await issuesOf(f.reviewer.page, f.lesson.lessonId),
    await api(f.reviewer.page, "GET", `/lessons/${f.lesson.lessonId}`),
    await api(f.reviewer.page, "GET", `/lessons/${f.lesson.lessonId}/history`),
  ].map((r) => JSON.stringify(r.body));
  for (const b of bodies) {
    expect(b).not.toMatch(/review_minutes|active_minutes|reviewer_minutes|minutes_by_user/);
    expect(b).not.toContain(f.author.user.name);
  }
}

export function noProviderKey(f: Flow): void {
  const env = workerEnv({ ANTHROPIC_API_KEY: "x", OPENROUTER_API_KEY: "y", PATH: "p" } as unknown as NodeJS.ProcessEnv, "1");
  expect(env.ANTHROPIC_API_KEY).toBeUndefined();
  expect(env.OPENROUTER_API_KEY).toBeUndefined();
  expect(env.MODEL_PROVIDER_MODE).toBe("stub");
  expect(f.live.logs().join("\n")).not.toMatch(/sk-[A-Za-z0-9_-]{16,}|sk-ant-/);
}

export async function auditAppendOnly(): Promise<void> {
  const row = (await db().query<{ id: string }>("select id from audit_event limit 1"))[0];
  expect(row, "an audit row exists").toBeDefined();
  await expect(db().query("update audit_event set reason = 'tamper' where id = $1", [row!.id])).rejects.toThrow(/append-only/);
  await expect(db().query("delete from audit_event where id = $1", [row!.id])).rejects.toThrow(/append-only/);
}

export function printPassed(file: string, ids: string[]): void {
  console.log(`${file}: passed obligation ids ${ids.join(", ")}`);
}
