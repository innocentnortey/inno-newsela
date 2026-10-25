// NL-114 helpers: the one WP-1 lesson (G6.U4.L4) generated through the real run route, reviewers signed in on the second web
// (stack16.ts), the worker driver (driver16.ts), the candidate routes, and the SQL the specs read. Ids only are ever printed.
import { spawn } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { components } from "../../../src/lib/api-types";
import { authorSession, createUlidUser } from "../con-21/helpers";
import { db } from "../support/db";
import { getStack } from "../support/real-stack";
import { signInAs, type Role, type TestUser } from "../support/users";
import { startStack16, type Stack16 } from "./stack16";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- response bodies are probed field by field in specs
export type Json = Record<string, any>;
export type Candidate = components["schemas"]["Candidate"];
export const LESSON = "G6.U4.L4";
export const UNIT_KEY = "g6-u4";
export const LESSON_KEY = "L4";
export const scr9 = `/units/${UNIT_KEY}/lessons/${LESSON_KEY}`;
export const scr12 = (candidateId: string): string => `${scr9}/candidates/${candidateId}`;
export const SHOTS = "e2e/__screenshots__/integration/con-16";
const CWD = resolve(__dirname, "../../..");

// ---- stack ----
let stack: Stack16 | undefined;
export async function stack16(): Promise<Stack16> {
  stack ??= await startStack16();
  return stack;
}
export async function stopStack16(): Promise<void> {
  const s = stack;
  stack = undefined;
  await s?.stop();
}

// ---- driver ----
function runDriver(args: string[]): Promise<{ finished: boolean }> {
  return new Promise((ok, fail) => {
    const child = spawn("npx", ["tsx", "e2e/integration/con-16/driver16.ts", ...args], {
      cwd: CWD,
      env: { PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: getStack().databaseUrl } as unknown as NodeJS.ProcessEnv,
    });
    mkdirSync(resolve(CWD, "test-results"), { recursive: true });
    let out = "";
    let err = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString()));
    child.stderr.on("data", (d: Buffer) => {
      err += d.toString();
      appendFileSync(resolve(CWD, "test-results", "con-16-driver.log"), d);
    });
    child.on("exit", (code) => {
      if (code !== 0) return fail(new Error(`driver16 ${args.join(" ")} exited ${code}: ${err.slice(-1500)}`));
      ok(JSON.parse(out.trim().split("\n").pop() as string) as { finished: boolean });
    });
  });
}
/** Drains the candidate job on the scripted stub. `delayMs` holds the model call so the job sits in `drafting`. */
export const driveCandidate = (mode: Mode, runId: string, delayMs = 0, editText?: string) =>
  runDriver(["candidate", mode, runId, String(delayMs), ...(editText ? [editText] : [])]);
export type Mode = "good" | "fail" | "markup" | "edit";
/** Same, but not awaited: returns the promise so a spec can observe `drafting` meanwhile. */
export const driveCandidateBg = driveCandidate;

// ---- the lesson under test ----
export async function ensureLesson(browser: Browser): Promise<void> {
  const have = await db().query<{ id: string }>("select id from lesson where id=$1 and current_version_id is not null", [LESSON]);
  if (have.length > 0) return;
  const ctx = await browser.newContext({ baseURL: getStack().baseURL });
  const page = await ctx.newPage();
  try {
    const { up } = await authorSession(page);
    const [pv] = await db().query<{ id: string }>("select id from prompt_version order by id limit 1");
    const res = await page.request.post("/api/runs", {
      data: { outline_version_id: up.outline_version_id, mode: "run", scope: { kind: "rows", rows: [8] }, prompt_version_id: pv!.id, cap_usd: 13 },
      headers: { Origin: getStack().baseURL },
    });
    expect(res.status(), await res.text()).toBe(201);
    const { run_id } = (await res.json()) as { run_id: string };
    await runDriver(["parent", "good", run_id]);
  } finally {
    await ctx.close();
  }
  const [row] = await db().query<{ state: string }>("select state from lesson where id=$1", [LESSON]);
  expect(row?.state, "the parent run must leave G6.U4.L4 as a generated draft").toBe("draft");
}

export const L5 = "G6.U4.L5";
/** G6.U4.L5 whose only run failed, so it has no version: the `generation_failed` lesson of AC-7(b). */
export async function ensureFailedLesson(browser: Browser): Promise<void> {
  const have = await db().query<{ id: string }>("select id from lesson where id=$1 and state='generation_failed' and current_version_id is null", [L5]);
  if (have.length > 0) return;
  const ctx = await browser.newContext({ baseURL: getStack().baseURL });
  const page = await ctx.newPage();
  try {
    const { up } = await authorSession(page);
    const [pv] = await db().query<{ id: string }>("select id from prompt_version order by id limit 1");
    const res = await page.request.post("/api/runs", {
      data: { outline_version_id: up.outline_version_id, mode: "run", scope: { kind: "rows", rows: [9] }, prompt_version_id: pv!.id, cap_usd: 13 },
      headers: { Origin: getStack().baseURL },
    });
    expect(res.status(), await res.text()).toBe(201);
    const { run_id } = (await res.json()) as { run_id: string };
    await runDriver(["parent", "fail", run_id]);
  } finally {
    await ctx.close();
  }
  const [row] = await db().query<{ state: string; current_version_id: string | null }>("select state, current_version_id from lesson where id=$1", [L5]);
  expect(row, "L5 must be generation_failed with no version").toMatchObject({ state: "generation_failed", current_version_id: null });
}

/** The page's /collab websocket piped to our collab child with the session cookie (NEXT_PUBLIC_COLLAB_URL is build-time). Copied from con-12/bridge.ts. */
export async function bridgeCollab(s: Session, port: number): Promise<void> {
  const c = (await s.context.cookies()).find((x) => x.name === "ls_session");
  if (!c) throw new Error("no session cookie");
  const cookie = `ls_session=${c.value}`;
  await s.page.routeWebSocket(/\/collab/, (ws) => {
    const upstream = new WebSocket(`ws://127.0.0.1:${port}`, { headers: { cookie } } as never);
    upstream.binaryType = "arraybuffer";
    const pending: (string | Buffer)[] = [];
    let open = false;
    upstream.addEventListener("open", () => {
      open = true;
      for (const m of pending.splice(0)) upstream.send(m as never);
    });
    ws.onMessage((m) => (open ? upstream.send(m as never) : void pending.push(m)));
    upstream.addEventListener("message", (e) => {
      const d = e.data as string | ArrayBuffer;
      ws.send(typeof d === "string" ? d : Buffer.from(d));
    });
    upstream.addEventListener("close", () => void ws.close().catch(() => {}));
    upstream.addEventListener("error", () => void ws.close().catch(() => {}));
    ws.onClose(() => {
      try {
        upstream.close();
      } catch {
        /* already closed */
      }
    });
  });
}

export interface Session { context: BrowserContext; page: Page; user: TestUser; origin: string }
/**
 * A fresh context signed in as a fresh user of `role` on the second web (the one wired to our collab). The user id is ULID-shaped
 * (createUlidUser): the web's StoreAck schema parses `stored_by` as a UserId, so a `usr_e2e_<hex>` id makes a good adopt fail as
 * COLLAB_UNAVAILABLE (collab.bad_body). Same seam family as the con-21 run-start finding; recorded in the devlog.
 */
export async function session(browser: Browser, role: Role): Promise<Session> {
  const s = await stack16();
  const context = await browser.newContext({ baseURL: s.webURL });
  const page = await context.newPage();
  const user = await signInAs(page, await createUlidUser(role));
  return { context, page, user, origin: s.webURL };
}

export const api = {
  async post(p: Page, origin: string, path: string, data?: unknown, headers: Record<string, string> = {}) {
    const res = await p.request.post(path, { ...(data === undefined ? {} : { data }), headers: { Origin: origin, ...headers } });
    return { status: res.status(), headers: res.headers(), body: (await res.json().catch(() => ({}))) as Json };
  },
  async get(p: Page, path: string) {
    const res = await p.request.get(path);
    return { status: res.status(), body: (await res.json().catch(() => ({}))) as Json };
  },
};
export const regenerate = (s: Session, note?: string, headers?: Record<string, string>, lesson = LESSON) =>
  api.post(s.page, s.origin, `/api/lessons/${lesson}/candidates`, note === undefined ? {} : { note }, headers);
export const getCandidate = (s: Session, id: string, lesson = LESSON) => api.get(s.page, `/api/lessons/${lesson}/candidates/${id}`);
export const adopt = (s: Session, id: string, body: { scope: "whole" } | { scope: "section"; section_address?: string }, headers?: Record<string, string>, lesson = LESSON) =>
  api.post(s.page, s.origin, `/api/lessons/${lesson}/candidates/${id}/adopt`, body, headers);

/** Reviewer R1 puts the generated draft in review (the start_review transition the SCR-9 open performs). */
export async function ensureInReview(r1: Session): Promise<void> {
  const [row] = await db().query<{ state: string }>("select state from lesson where id=$1", [LESSON]);
  if (row?.state === "in_review") return;
  if (row?.state === "draft") {
    const r = await api.post(r1.page, r1.origin, `/api/lessons/${LESSON}/transitions`, { action: "start_review" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    return;
  }
  await setLessonState("in_review");
}
export async function setLessonState(state: string): Promise<void> {
  await db().query("update lesson set state=$2 where id=$1", [LESSON, state]);
}
/** Test hygiene: no candidate may stay queued or running into the next test (one candidate per lesson at a time). */
export async function settleCandidates(): Promise<void> {
  await db().query("update lesson_job set status='cancelled', finished_at=now() where kind='candidate' and status in ('queued','running')");
  // same seam defect as driver16.ts: a candidate run never leaves 'planning' by itself and would fill the claim window
  await db().query("update run set state='cancelled', finished_at=now() where kind='candidate' and state in ('planning','running')");
}

// ---- readers ----
export async function liveHash(lesson = LESSON): Promise<{ lesson_hash: string; doc_hash: string | null; versions: number; current_version_id: string | null }> {
  const [l] = await db().query<{ current_version_id: string | null; content_hash: string }>(
    "select l.current_version_id, v.content_hash from lesson l join lesson_version v on v.id=l.current_version_id where l.id=$1",
    [lesson],
  );
  const [d] = await db().query<{ content_hash: string }>("select content_hash from lesson_doc where lesson_id=$1 order by seq desc limit 1", [lesson]);
  const versions = await db().count("lesson_version", "lesson_id=$1", [lesson]);
  return { lesson_hash: l!.content_hash, doc_hash: d?.content_hash ?? null, versions, current_version_id: l!.current_version_id };
}
export async function counts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const t of ["run", "lesson_job", "spend_reservation", "lesson_version", "lesson_doc", "audit_event", "model_call"]) out[t] = await db().count(t);
  return out;
}
export async function candidateStatuses(s: Session, id: string, until: (c: Candidate) => boolean, ms = 60_000): Promise<string[]> {
  const seen: string[] = [];
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const r = await getCandidate(s, id);
    const c = r.body as unknown as Candidate;
    if (seen.at(-1) !== c.status) seen.push(c.status);
    if (until(c)) return seen;
    await new Promise((x) => setTimeout(x, 2000));
  }
  return seen;
}
/** Regenerates and drains on the stub; returns the ready (or failed) candidate. */
export async function makeCandidate(s: Session, mode: Mode = "good", opts: { note?: string; editText?: string; lesson?: string } = {}): Promise<Candidate> {
  const lesson = opts.lesson ?? LESSON;
  const r = await regenerate(s, opts.note, undefined, lesson);
  expect(r.status, JSON.stringify(r.body)).toBe(202);
  const id = r.body["candidate_id"] as string;
  await driveCandidate(mode, id, 0, opts.editText);
  const g = await getCandidate(s, id, lesson);
  expect(g.status).toBe(200);
  return g.body as unknown as Candidate;
}
export const mkRequestId = (): string => `req_e2e_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
