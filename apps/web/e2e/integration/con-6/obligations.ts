// NL-96: the obligation checks that WF-5, WF-6 and WF-21 share (each *-obligations.spec.ts calls these with its own WF row).
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { control } from "./helpers";
import type { StartedRun } from "./helpers";
import { signInStaff } from "./helpers";

export const ROOT = resolve(__dirname, "../../../../..");
export const WEB = resolve(ROOT, "apps/web");
const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });

export function keysOf(v: unknown, out: string[] = []): string[] {
  if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) { out.push(k); keysOf(x, out); }
  return out;
}

export async function readsOf(req: APIRequestContext, run: StartedRun) {
  const progress = await (await req.get(`/api/runs/${run.run_id}/progress`)).json();
  const plan = await (await req.get(`/api/runs/${run.run_id}/plan`)).json();
  return { progress, plan };
}

/** GR-13: staff roles only; no student or teacher keys in the responses (the plan's prose may say "teacher": keys are checked). */
export async function gr13(page: Page, run: StartedRun): Promise<void> {
  const roles = await db().query<{ role: string }>("select distinct role from app_user");
  for (const r of roles) expect(["author", "reviewer", "approver"]).toContain(r.role);
  const { progress, plan } = await readsOf(page.request, run);
  const actionBody = await (await control(page, run.run_id, "resume")).json(); // refused (409/403): still a response body
  expect(keysOf([progress, plan, actionBody]).filter((k) => /student|teacher/i.test(k))).toEqual([]);
}

/** GR-9: the restricted folder is ignored, untracked, and no con-6 file (other than the obligation files) names it. */
export function gr9(): void {
  expect(spawnSync("git", ["check-ignore", "-q", "docs/source/restricted/x"], { cwd: ROOT }).status).toBe(0);
  expect(spawnSync("git", ["ls-files", "docs/source/restricted"], { cwd: ROOT, encoding: "utf8" }).stdout.trim()).toBe("");
  const needle = ["docs", "source", "restricted"].join("/");
  for (const f of walk(join(WEB, "e2e/integration/con-6")).filter((p) => p.endsWith(".ts") && !/-obligations\.spec\.ts$|obligations\.ts$/.test(p))) {
    expect(readFileSync(f, "utf8"), f).not.toContain(needle);
  }
}

/** R-54 / CON-G1: no cookie is UNAUTHENTICATED; a reviewer's control call is ROLE_FORBIDDEN on the server. */
export async function r54(page: Page, run: StartedRun, playwright: { request: { newContext(o: object): Promise<APIRequestContext> } }, baseURL: string): Promise<void> {
  const bare = await playwright.request.newContext({ baseURL });
  for (const path of [`/api/runs/${run.run_id}/progress`, `/api/runs/${run.run_id}/plan`]) {
    const r = await bare.get(path);
    expect(r.status(), path).toBe(401);
    expect(((await r.json()) as { error: { code: string } }).error.code).toBe("UNAUTHENTICATED");
  }
  await bare.dispose();
  const ctx = await page.context().browser()!.newContext({ baseURL });
  const p = await ctx.newPage();
  await signInStaff(p, "reviewer");
  const res = await control(p, run.run_id, "cancel");
  expect(res.status()).toBe(403);
  expect(((await res.json()) as { error: { code: string } }).error.code).toBe("ROLE_FORBIDDEN");
  await ctx.close();
}

/** CON-G8: no key that carries minutes or review time, so no person name can sit beside one. */
export async function conG8(page: Page, run: StartedRun): Promise<void> {
  const { progress, plan } = await readsOf(page.request, run);
  expect(keysOf([progress, plan]).filter((k) => /minutes|review_time|duration/i.test(k))).toEqual([]);
}

/** OBS-7: no cookie value, password, provider key or restricted text in the stack logs, the worker lines or any table. */
export async function obs7(page: Page, user: { password: string }, worker: string[]): Promise<void> {
  const cookies = (await page.context().cookies()).map((c) => c.value).filter((v) => v.length > 8);
  const haystack = [...getStack().logs(), ...worker, await db().dumpAll()].join("\n");
  for (const c of cookies) expect(haystack).not.toContain(c);
  expect(haystack).not.toContain(user.password);
  expect(haystack).not.toMatch(/sk-ant-[A-Za-z0-9_-]{8,}/);
  expect(haystack).not.toMatch(/ANTHROPIC_API_KEY\s*[=:]\s*\S+/);
  expect(haystack).not.toContain(["docs", "source", "restricted"].join("/"));
}

/** OBS-11: the WF row names this ticket's capture test and the spec file exists. */
export function obs11(wf: string, tag: string, specFile: string): void {
  const doc = readFileSync(join(ROOT, "docs/design/observability.md"), "utf8");
  const row = doc.split("\n").find((l) => l.startsWith(`| ${wf} |`));
  expect(row, `${wf} row`).toBeDefined();
  expect(row).toContain(tag);
  expect(existsSync(join(WEB, "e2e/integration/con-6", specFile))).toBe(true);
  expect(readFileSync(join(WEB, "e2e/integration/con-6", specFile), "utf8")).toContain(tag);
}
