// NL-96: start real runs for the CON-6/7/8 specs (upload, confirm every error through the choices route, call the real startRun route).
import { expect, test, type Page } from "@playwright/test";
import type { components } from "../../../src/lib/api-types";
import { PLANNING_TEXT, FAILED_TEXT } from "../../../src/features/unit-plan/plan-copy";
import { controlErrorText } from "../../../src/features/progress/run-copy";
import { ensureSeed, errorFindings, uploadFixture, getReport, postChoice, confirmUnitViaApi, type Uploaded } from "../con-3/helpers";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { randomBytes } from "node:crypto";
import { hash_password } from "@ls/core/auth/passwords";
import { signInAs, type Role, type TestUser } from "../support/users";

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** Like support/users.createUser, but the id is a valid `usr_` + 26-char ULID. createUser's `usr_e2e_<hex>` is rejected when the
 *  worker reads `confirmed_by` back from an intake choice (harness request: NL-90 support should mint valid ids). */
export async function createStaff(role: Role): Promise<TestUser> {
  const b = randomBytes(26);
  const id = `usr_${[...b].map((x) => CROCKFORD[x % 32]).join("")}`;
  const hex = randomBytes(6).toString("hex");
  const u: TestUser = { user_id: id, email: `${role}.${hex}@example.test`, name: `E2E ${role} ${hex}`, role, synthetic: true, password: randomBytes(12).toString("base64url") };
  await db().query("insert into app_user (id, email, name, role, synthetic, password_hash) values ($1,$2,$3,$4,$5,$6)", [u.user_id, u.email, u.name, u.role, u.synthetic, hash_password(u.password)]);
  return u;
}

export type RunProgress = components["schemas"]["RunProgress"];
export type PlanResponse = components["schemas"]["UnitPlan"];
export const COPY = { PLANNING_TEXT, FAILED_TEXT, controlErrorText };
export const ROWS = [8, 9, 25];
export const L4 = "G6.U4.L4";
export const L5 = "G6.U4.L5";
const origin = () => ({ Origin: getStack().baseURL });

const openRuns: StartedRun[] = [];
export interface StartedRun { run_id: string; up: Uploaded; user: TestUser; unitKey: string }

/** Upload issued.csv as a fresh author, confirm all 6 errors through the API, start a run over `rows`. */
export async function startRun(page: Page, rows: number[] = ROWS, cap_usd = 13): Promise<StartedRun> {
  await ensureSeed();
  // A second run in the same test reuses the page's author session (signing in twice is not possible).
  const session = await page.request.get("/api/session");
  let user: TestUser;
  if (session.ok()) {
    const u = ((await session.json()) as { user: { user_id: string; email: string; name: string; role: Role } }).user;
    user = { ...u, synthetic: true, password: "" };
  } else {
    user = await createStaff("author");
    await signInAs(page, user);
  }
  const up = await uploadFixture(page, "issued.csv");
  const report = await getReport(page, up.outline_version_id);
  for (const f of errorFindings(report)) {
    const r = await postChoice(page, up.outline_version_id, { target_id: f.finding_id, kind: "confirm_fix", value: f.proposed_fix });
    expect(r.status(), await r.text()).toBe(200);
  }
  await confirmUnitViaApi(page, up.outline_version_id);
  const [pv] = await db().query<{ id: string }>("select id from prompt_version order by created_at desc limit 1");
  const res = await page.request.post("/api/runs", {
    data: { outline_version_id: up.outline_version_id, mode: "run", scope: { kind: "rows", rows }, prompt_version_id: pv!.id, cap_usd },
    headers: origin(),
  });
  expect(res.status(), await res.text()).toBe(201);
  const run = (await res.json()) as { run_id: string };
  const started = { run_id: run.run_id, up, user, unitKey: up.unit_key };
  openRuns.push(started);
  return started;
}

/** Another signed-in staff member (valid ids) on the given page. */
export async function signInStaff(page: Page, role: Role): Promise<TestUser> {
  const u = await createStaff(role);
  await signInAs(page, u);
  return u;
}

export const progressUrl = (r: StartedRun) => `/units/${r.unitKey}/runs/${r.run_id}`;
export const planUrl = (r: StartedRun) => `${progressUrl(r)}/plan`;

export async function getProgress(page: Page, runId: string): Promise<RunProgress> {
  const res = await page.request.get(`/api/runs/${runId}/progress`);
  expect(res.status()).toBe(200);
  return (await res.json()) as RunProgress;
}
export function control(page: Page, runId: string, action: "cancel" | "retry_failed" | "resume") {
  return page.request.post(`/api/runs/${runId}/actions`, { data: { action }, headers: origin() });
}

export async function runState(runId: string): Promise<string> {
  return (await db().query<{ state: string }>("select state from run where id=$1", [runId]))[0]!.state;
}
export async function waitSql<T>(read: () => Promise<T>, ok: (v: T) => boolean, ms = 60_000, every = 100): Promise<T> {
  const end = Date.now() + ms;
  let v = await read();
  while (!ok(v) && Date.now() < end) {
    await new Promise((r) => setTimeout(r, every));
    v = await read();
  }
  expect(ok(v), `condition not met within ${ms} ms; last: ${JSON.stringify(v)}`).toBe(true);
  return v;
}
export const waitRun = (runId: string, states: string[], ms = 90_000) => waitSql(() => runState(runId), (s) => states.includes(s), ms);
export const jobStatus = async (runId: string, lesson: string) =>
  (await db().query<{ status: string }>("select status from lesson_job where run_id=$1 and lesson_id=$2 and kind='lesson'", [runId, lesson]))[0]?.status ?? "none";

export async function auditCount(): Promise<number> {
  return db().count("audit_event");
}
/** Row count and a content hash per table: any insert, update or delete changes it. */
export async function snapshot(tables: string[]): Promise<Record<string, { n: number; hash: string | null }>> {
  const out: Record<string, { n: number; hash: string | null }> = {};
  for (const t of tables) {
    if (!/^[a-z_]+$/.test(t)) throw new Error(`bad table ${t}`);
    const r = await db().query<{ n: number; h: string | null }>(`select count(*)::int n, md5(string_agg(x::text, '|' order by x::text)) h from ${t} x`);
    out[t] = { n: r[0]!.n, hash: r[0]!.h };
  }
  return out;
}
export const FLEX = "G6.U4.FLEX-1a";

import type { Browser } from "@playwright/test";
const shared = new Map<string, Promise<StartedRun>>();
/** One finished run per script for a whole spec file (the obligation cases only read it). Needs a worker for `script`. */
export function sharedRun(browser: Browser, baseURL: string, script: string, rows: number[] = ROWS): Promise<StartedRun> {
  const key = `${test.info().file}|${script}`; // one run per spec file: a file's afterAll stops its worker
  const hit = shared.get(key);
  if (hit) return hit;
  const made = (async () => {
    const { startWorker } = await import("./worker-harness");
    const ctx = await browser.newContext({ baseURL });
    const page = await ctx.newPage();
    const run = await startRun(page, rows);
    await startWorker({ script });
    await waitRun(run.run_id, ["partial", "complete"]);
    await ctx.close();
    return run;
  })();
  shared.set(key, made);
  return made;
}

const TERMINAL = ["complete", "partial", "capped", "cancelled"];
/** test.afterEach: let in-flight work finish, cancel every run the test left open, wait for it to stop, then stop the workers. */
export async function settleAll(page: Page): Promise<void> {
  const { killAllWorkers, releaseAllHolds } = await import("./worker-harness");
  releaseAllHolds();
  const runs = openRuns.splice(0);
  try {
    for (const r of runs) {
      if (TERMINAL.includes(await runState(r.run_id))) continue;
      await page.request.post(`/api/runs/${r.run_id}/actions`, { data: { action: "cancel" }, headers: origin() }).catch(() => undefined);
    }
    const end = Date.now() + 30_000;
    for (const r of runs) while (!TERMINAL.includes(await runState(r.run_id)) && Date.now() < end) await new Promise((ok) => setTimeout(ok, 200));
    await new Promise((ok) => setTimeout(ok, 800)); // let the last in-flight job write its outcome
  } finally {
    await killAllWorkers();
  }
}
